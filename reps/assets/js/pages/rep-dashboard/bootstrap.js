const { createClient } = supabase;
        const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        const SHIPMENT_PRICE_FIELD = 'السعر بعد التعديل';
        const SHIPMENT_PRICE_FIELD_LEGACY = 'السعر_بعد_التعديل';
        const SHIPMENT_CODE_FIELD = 'كود الشحنة';
        const SHIPMENT_CODE_FIELD_LEGACY = 'order_id';
        const GPS_ENFORCEMENT_SYSTEM_PHONE_PREFIX = '__gps_enforcement_rep__:';
        const GPS_ENFORCEMENT_STORAGE_KEY_PREFIX = 'gpsEnforcementRequired:';
        const GPS_ENFORCEMENT_REFRESH_MS = 30000;

        let trackingSystem = null;
        let gpsEnforcementRequired = true;
        let gpsEnforcementLastFetchedAt = 0;
        let gpsEnforcementRefreshInFlight = null;

        // Initialize User Session early
        let user = (() => {
            if (typeof AppCrypto !== 'undefined') return AppCrypto.getItem('user');
            try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch(e) { return null; }
        })();

        if (!user || (user.role !== 'rep' && user.role !== 'مندوب فرعي' && user.role !== 'sub-rep')) {
            window.location.href = 'login.html';
        }

        function updateRepHeaderName(nextUser = user) {
            const repNameEl = document.getElementById('repName');
            if (!repNameEl) return;
            repNameEl.innerText = nextUser?.full_name || nextUser?.username || nextUser?.phone || 'المندوب';
        }

        updateRepHeaderName(user);

        // Define global variables used by other scripts
        let allShipments = [];
        let selectedShipmentIdsForBulk = new Set();
        let activeShipmentMenuId = null;
        let activeShipmentMenuMode = 'copy';
        let lockedShipmentIds = new Set();
        const REP_UI_STATE_KEY = 'repUiState';
        const REP_SEEN_SHIPMENTS_KEY_PREFIX = 'repSeenShipments:';
        const REP_UNREAD_SESSION_KEY = 'repUnreadShipments:';
        const REP_NOTIFICATIONS_KEY = 'rep_local_notifications';
        const REP_FAVORITES_KEY_PREFIX = 'repFavoriteShipments:';

        let repNotifications = (() => {
            if (typeof AppCrypto !== 'undefined') {
                return AppCrypto.getItem(REP_NOTIFICATIONS_KEY) || [];
            }
            return JSON.parse(localStorage.getItem(REP_NOTIFICATIONS_KEY) || '[]');
        })();

        let currentActiveView = 'dashboard';
        let favoriteShipmentIds = new Set();
        let lastNonFavoritesStatusSelections = new Set();
        let shipmentSwipeState = null;
        let suppressShipmentClickUntil = 0;
        let isQuickActionsMenuOpen = false;
        let isNotificationsPanelOpen = false;
        let shipmentsDataVersion = 0;
        let searchRenderTimer = null;
        let lastServerShipmentsMap = new Map();
        let shipmentsPollTimer = null;
        let lastFilterSignature = '';
        let lastMetaSignature = '';
        let cachedFilteredShipments = [];
        let cachedScopedShipments = [];
        window.lastFullRenderKey = '';
        window.lastDataHash = '';
        window.lastRenderedCount = 0;

        // General State Variables
        let notificationAudioContext = null;
        let dateFilterSelections = new Set();
        let statusFilterSelections = new Set();
        let zoneFilterSelections = new Set();
        let senderFilterSelections = new Set();
        const FAVORITES_FILTER_VALUE = '__favorites__';
        let dateFilterGlowTimeout = null;
        let hasPromptedDateFilterOnOpen = false;
        const STATUS_OPTIONS = ['قيد التوصيل', 'تم', 'مؤجل', 'رفض', 'تعديل سعر', 'شحن'];
        let gpsGateUnlocked = false;
        let gpsGateCheckInFlight = false;
        let gpsPermissionStatus = null;
        let gpsEnforcementTimer = null;
        let gpsSettingsRefreshTimer = null;
        let repStickyHeaderObserver = null;
        let currentFilterTab = 'date';
        let currentDisplayLimit = 40;
        let areShipmentDetailsExpanded = true;

        // Map State Variables
        let mapInstance = null;
        let mapRoutingControl = null;
        let repMarker = null;
        let destMarker = null;
        let mapWatchId = null;
        let mapCurrentShipmentId = null;
        let isNavigating = false;
        let mapCurrentRouteCoords = [];
        let mapSmartTracking = {
            lastProcTime: 0, lastLat: null, lastLng: null,
            calcDistMs: function(l1, ln1, l2, ln2) {
                const R = 6371e3; const p1 = l1 * Math.PI/180; const p2 = l2 * Math.PI/180;
                const a = Math.sin((l2-l1)*Math.PI/360)**2 + Math.cos(p1)*Math.cos(p2) * Math.sin((ln2-ln1)*Math.PI/360)**2;
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            }
        };

        function el(id) {
            return document.getElementById(id);
        }

        function updateTrackingUI() {
            const btn = document.getElementById('trackingToggleBtn');
            const icon = document.getElementById('trackingIcon');
            if(trackingSystem && trackingSystem.isTracking) {
                btn.classList.replace('text-slate-400', 'text-emerald-500');
                icon.classList.add('animate-pulse');
            } else {
                btn.classList.replace('text-emerald-500', 'text-slate-400');
                icon.classList.remove('animate-pulse');
            }
            updateGpsToggleButtonState();
        }

        function toggleTracking() {
            if(!trackingSystem) return;
            trackingSystem.toggleShift();
            updateTrackingUI();
        }

        const normalizeShipmentPriceField = RepsShipmentUtils.normalizeRecord;
        const toServerShipmentPayload = RepsShipmentUtils.toServerPayload;

        function getGpsEnforcementStorageKey() {
            return `${GPS_ENFORCEMENT_STORAGE_KEY_PREFIX}${String(user?.id || user?.phone || 'rep')}`;
        }

        function getRepGpsEnforcementSystemPhone() {
            return `${GPS_ENFORCEMENT_SYSTEM_PHONE_PREFIX}${String(user?.id || '')}`;
        }

        function getGpsEnforcementFallback() {
            const raw = localStorage.getItem(getGpsEnforcementStorageKey());
            if (raw === 'false') return false;
            if (raw === 'true') return true;
            return false;
        }

        function saveGpsEnforcementFallback(enabled) {
            localStorage.setItem(getGpsEnforcementStorageKey(), enabled ? 'true' : 'false');
        }

        async function refreshGpsEnforcementSetting(options = {}) {
            const force = !!options.force;
            const now = Date.now();

            if (!force && gpsEnforcementRefreshInFlight) {
                return gpsEnforcementRefreshInFlight;
            }

            if (!force && now - gpsEnforcementLastFetchedAt < GPS_ENFORCEMENT_REFRESH_MS) {
                return gpsEnforcementRequired;
            }

            gpsEnforcementRefreshInFlight = (async () => {
                let nextValue = getGpsEnforcementFallback();
                try {
                    const targetPhone = getRepGpsEnforcementSystemPhone();
                    if (!targetPhone || targetPhone === `${GPS_ENFORCEMENT_SYSTEM_PHONE_PREFIX}`) {
                        gpsEnforcementRequired = false;
                        gpsEnforcementLastFetchedAt = Date.now();
                        saveGpsEnforcementFallback(false);
                        return false;
                    }
                    const { data, error } = await supabaseClient
                        .from(CONFIG.TABLES.USERS)
                        .select('approved')
                        .eq('phone', targetPhone)
                        .maybeSingle();
                    if (error) throw error;
                    if (data) nextValue = Boolean(data.approved);
                } catch (error) { }

                gpsEnforcementRequired = nextValue;
                gpsEnforcementLastFetchedAt = Date.now();
                saveGpsEnforcementFallback(nextValue);
                return nextValue;
            })();

            try {
                return await gpsEnforcementRefreshInFlight;
            } finally {
                gpsEnforcementRefreshInFlight = null;
            }
        }

        function formatLastContactAt(value) {
            if (!value) return '';
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return '';
            return parsed.toLocaleString('ar-EG', {
                dateStyle: 'short',
                timeStyle: 'short'
            });
        }

        
