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

        
