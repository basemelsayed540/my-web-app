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

        function normalizeShipmentPriceField(record) {
            return normalizeShipmentRecordHeaders(record);
        }

        function toServerShipmentPayload(payload) {
            return buildShipmentServerPayload(payload);
        }

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

        async function recordShipmentContactAttempt(shipmentId, options = {}) {
            const shipment = getShipmentById(shipmentId);
            if (!shipment) return false;

            const attempts = getShipmentCallAttempts(shipment) + 1;
            const attemptedAt = new Date().toISOString();
            const method = options.method || 'تسجيل تواصل';

            const { error } = await supabaseClient
                .from(CONFIG.TABLES.SHIPMENTS)
                .update({
                    call_attempts: attempts,
                    last_contact_at: attemptedAt,
                    last_contact_method: method
                })
                .eq('id', Number(shipmentId) || shipmentId);

            if (!error) {
                shipment['عدد المحاولات'] = attempts;
                shipment.call_attempts = attempts;
                shipment['آخر محاولة تواصل'] = attemptedAt;
                shipment.last_contact_at = attemptedAt;
                shipment['آخر وسيلة تواصل'] = method;
                shipment.last_contact_method = method;
                renderShipments();
            } else {
                console.warn('تعذر تحديث عدد المحاولات:', error.message || error);
            }

            if (CONFIG.TABLES.CALLS_LOG) {
                const { error: logError } = await supabaseClient
                    .from(CONFIG.TABLES.CALLS_LOG)
                    .insert({
                        shipment_code: shipment['كود الشحنة'] || shipment.order_id || null,
                        rep_name: shipment.المندوب || null,
                        method,
                        result: options.result || 'opened',
                        created_at: attemptedAt
                    });

                if (logError) {
                    console.warn('تعذر حفظ سجل التواصل:', logError.message || logError);
                }
            }

            return !error;
        }

        const CONTACT_RESULT_PRESETS = {
            whatsapp: [
                'تم التواصل واتساب',
                'الرقم غير مسجل واتساب',
                'رقم غير صحيح'
            ],
            call: [
                'تم الرد',
                'لم يرد',
                'رقم غير صحيح'
            ],
            manual: [
                'تم الرد',
                'لم يرد',
                'تم التواصل واتساب',
                'الرقم غير مسجل واتساب',
                'رقم غير صحيح'
            ]
        };
        let pendingContactOutcomePrompt = null;
        let isContactOutcomePromptOpen = false;

        function getContactResultOptions(method) {
            const normalizedMethod = String(method || '').trim();
            if (normalizedMethod.includes('واتساب')) {
                return {
                    title: 'ما نتيجة التواصل عبر واتساب؟',
                    options: CONTACT_RESULT_PRESETS.whatsapp
                };
            }

            if (normalizedMethod.includes('اتصال')) {
                return {
                    title: 'ما نتيجة الاتصال؟',
                    options: CONTACT_RESULT_PRESETS.call
                };
            }

            return {
                title: 'ما نتيجة التواصل؟',
                options: CONTACT_RESULT_PRESETS.manual
            };
        }

        async function promptForContactOutcome(context) {
            if (!context || isContactOutcomePromptOpen) return;
            isContactOutcomePromptOpen = true;

            try {
                const shipment = getShipmentById(context.shipmentId);
                if (!shipment) return;
                const { title, options } = getContactResultOptions(context.method);

                const { value: result } = await Swal.fire({
                    title,
                    html: `
                        <div class="space-y-3 text-right" dir="rtl">
                            <p class="text-sm font-bold text-slate-600">الشحنة: <span class="text-slate-900">#${shipment.order_id || shipment['كود الشحنة'] || shipment.id}</span></p>
                            <select id="swal-contact-result" class="swal2-input !m-0 !w-full border border-slate-200 rounded-lg">
                                <option value="">اختر النتيجة</option>
                                ${options.map((option) => `<option value="${option}">${option}</option>`).join('')}
                            </select>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'حفظ المحاولة',
                    cancelButtonText: 'تخطي',
                    preConfirm: () => {
                        const selectedResult = document.getElementById('swal-contact-result')?.value || '';
                        if (!selectedResult) {
                            Swal.showValidationMessage('يرجى اختيار نتيجة التواصل');
                            return false;
                        }
                        return selectedResult;
                    }
                });

                if (!result) return;

                const success = await recordShipmentContactAttempt(context.shipmentId, {
                    method: context.method,
                    result
                });

                if (success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'تم تسجيل نتيجة التواصل',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 1800
                    });
                }
            } finally {
                isContactOutcomePromptOpen = false;
            }
        }

        function queueContactOutcomePrompt(context) {
            pendingContactOutcomePrompt = {
                ...context,
                queuedAt: Date.now()
            };
        }

        async function flushPendingContactOutcomePrompt() {
            if (!pendingContactOutcomePrompt || isContactOutcomePromptOpen) return;
            const context = pendingContactOutcomePrompt;
            pendingContactOutcomePrompt = null;
            await promptForContactOutcome(context);
        }

        function openContactChannelAndWaitForOutcome(context, openCallback) {
            queueContactOutcomePrompt(context);
            openCallback();
        }

        let user = JSON.parse(localStorage.getItem('user'));
        if (!user || (user.role !== 'rep' && user.role !== 'مندوب فرعي')) {
            window.location.href = 'login.html';
        }
        startStoredUserSessionGuard(supabaseClient, {
            allowedRoles: ['rep', 'مندوب فرعي'],
            onValidUser: (latestUser) => {
                user = latestUser;
                const repName = document.getElementById('repName');
                if (repName) repName.innerText = latestUser.full_name || latestUser.username || latestUser.phone;

                if(!trackingSystem) {
                    trackingSystem = new RepTrackingSystem(supabaseClient, latestUser);
                    updateTrackingUI();
                }
                ensureGpsReadyAndLoadShipments(false);
            }
        });

        document.getElementById('repName').innerText = user.full_name || user.username || user.phone;

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
        let isNotificationsPanelOpen = false;
        let shipmentsDataVersion = 0;
        let searchRenderTimer = null;
        let lastServerShipmentsMap = new Map();
        let shipmentsPollTimer = null;

        function shouldStoreRepNotification(type) {
            return ['added', 'removed', 'deleted', 'status_changed'].includes(type);
        }

        function isDuplicateRepNotification(type, shipment) {
            const lastNotification = repNotifications[0];
            if (!lastNotification) return false;

            const currentOrderId = String(shipment?.order_id || shipment?.كود_الشحنة || shipment?.الكود || shipment?.id || '---').trim();
            const lastOrderId = String(lastNotification.order_id || '').trim();
            const sameNotification = lastNotification.type === type && lastOrderId === currentOrderId;
            if (!sameNotification) return false;

            const lastCreatedAt = Number(lastNotification.createdAt || 0);
            return Date.now() - lastCreatedAt < 15000;
        }

        function addRepNotification(type, shipment) {
            if (!shouldStoreRepNotification(type) || !shipment || isDuplicateRepNotification(type, shipment)) return;

            const notif = {
                id: Date.now() + Math.random(),
                type: type, // 'added', 'removed', 'deleted', 'status_changed'
                order_id: shipment.order_id || shipment.كود_الشحنة || shipment.الكود || '---',
                client: shipment.اسم_العميل || '---',
                employee: shipment['اسم الموظف'] || '---',
                newStatus: shipment.الحالة || '---',
                isWarehouse: normalizeComparableValue(shipment.المندوب) === normalizeComparableValue('مخزن'),
                time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                date: new Date().toLocaleDateString('ar-EG'),
                createdAt: Date.now(),
                read: false
            };
            repNotifications.unshift(notif);
            if (repNotifications.length > 30) repNotifications.pop();
            localStorage.setItem(REP_NOTIFICATIONS_KEY, JSON.stringify(repNotifications));
            updateRepNotifUI();
        }

        function invalidateShipmentRenderCache() {
            lastFilterSignature = '';
            lastMetaSignature = '';
            cachedFilteredShipments = [];
            cachedScopedShipments = [];
        }

        function bumpShipmentsDataVersion() {
            shipmentsDataVersion += 1;
            invalidateShipmentRenderCache();
        }

        function updateRepNotifUI() {
            const unreadCount = repNotifications.filter(n => !n.read).length;
            if (isNotificationsPanelOpen) renderRepNotifications();
        }

        function setNotificationsButtonActive(active) {
            const notifBtn = document.getElementById('nav-btn-notifications');
            if (!notifBtn) return;
            notifBtn.classList.toggle('text-sky-800', active);
            notifBtn.classList.toggle('text-slate-400', !active);
        }

        function markAllRepNotificationsAsRead() {
            repNotifications = repNotifications.map(item => ({ ...item, read: true }));
            localStorage.setItem(REP_NOTIFICATIONS_KEY, JSON.stringify(repNotifications));
            renderRepNotifications();
            updateRepNotifUI();
        }

        function openRepNotificationsPanel() {
            const panel = document.getElementById('repNotificationsPanel');
            if (!panel) return;
            isNotificationsPanelOpen = true;
            panel.classList.remove('hidden');
            setNotificationsButtonActive(true);
            renderRepNotifications();
        }

        function closeRepNotificationsPanel() {
            const panel = document.getElementById('repNotificationsPanel');
            if (!panel) return;
            isNotificationsPanelOpen = false;
            panel.classList.add('hidden');
            setNotificationsButtonActive(false);
        }

        function toggleRepNotificationsPanel() {
            if (isNotificationsPanelOpen) {
                closeRepNotificationsPanel();
                return;
            }

            markAllRepNotificationsAsRead();
            openRepNotificationsPanel();
        }

        function clearRepNotifications() {
            repNotifications = [];
            localStorage.setItem(REP_NOTIFICATIONS_KEY, JSON.stringify(repNotifications));
            renderRepNotifications();
            updateRepNotifUI();
        }

        function renderRepNotifications() {
            const container = document.getElementById('repNotificationsContainer');
            if (!container) return;
            
            if (repNotifications.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-14 rounded-[1.75rem] bg-slate-50 dark:bg-slate-800/70 border border-dashed border-slate-200 dark:border-slate-700">
                        <div class="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
                            <i class="fas fa-bell-slash text-2xl"></i>
                        </div>
                        <h3 class="font-bold text-slate-800 dark:text-white">لا توجد إشعارات</h3>
                        <p class="text-[10px] text-slate-400 dark:text-slate-300 mt-1">سيتم إخطارك بكل جديد هنا</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = repNotifications.map(n => {
                let icon = 'fa-plus-circle text-emerald-500 bg-emerald-50';
                let text = 'شحنة جديدة بعهدتكم';
                if (n.type === 'removed') { 
                    icon = n.isWarehouse ? 'fa-warehouse text-slate-500 bg-slate-50' : 'fa-exchange-alt text-amber-500 bg-amber-50'; 
                    text = n.isWarehouse ? 'تم التحويل للمخزن' : 'تم سحب شحنة من عهدتكم'; 
                }
                if (n.type === 'deleted') { icon = 'fa-trash text-rose-500 bg-rose-50'; text = 'تم حذف شحنة من عهدتكم'; }
                if (n.type === 'status_changed') { icon = 'fa-info-circle text-cyan-600 bg-cyan-50'; text = `تم تغيير الحالة إلى (${n.newStatus})`; }
                if (n.type === 'updated') { icon = 'fa-edit text-sky-800 bg-cyan-50'; text = 'تم تحديث بيانات الشحنة'; }

                return `
                    <div class="p-4 rounded-[1.5rem] flex items-start gap-3 border transition-all ${n.read ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800' : 'bg-gradient-to-l from-cyan-50 via-sky-50 to-white dark:from-cyan-950/40 dark:via-slate-900 dark:to-slate-900 border-cyan-200 dark:border-cyan-800 shadow-md shadow-cyan-100/60 dark:shadow-none ring-1 ring-cyan-100 dark:ring-cyan-900/40'}">
                        <div class="w-10 h-10 ${icon} rounded-2xl flex items-center justify-center flex-shrink-0 ${n.read ? '' : 'ring-4 ring-white dark:ring-slate-900'}">
                            <i class="fas ${icon.split(' ')[0]}"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between items-start">
                                <h4 class="text-xs font-black text-slate-800 dark:text-white">${text}</h4>
                                <span class="text-[9px] text-slate-400 dark:text-slate-300 font-bold">${n.time}</span>
                            </div>
                            <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-1">المعرف: <span class="font-black text-black dark:text-white">${n.order_id}</span> | العميل: ${n.client}</p>
                            <p class="text-[10px] text-sky-800 dark:text-cyan-300 font-bold mt-1 leading-none flex items-center gap-1">
                                <i class="fas fa-user-edit text-[9px]"></i> بواسطة: ${n.employee}
                            </p>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function switchRepView(viewId, options = {}) {
            const { skipRender = false, skipSave = false } = options;
            if (viewId === 'favorites' && !statusFilterSelections.has(FAVORITES_FILTER_VALUE)) {
                statusFilterSelections.clear();
                statusFilterSelections.add(FAVORITES_FILTER_VALUE);
            }
            currentActiveView = viewId;
            const dashboardView = document.getElementById('dashboard-view');
            const dashBtn = document.getElementById('menuDashboardBtn');

            dashboardView?.classList.add('hidden');
            closeRepNotificationsPanel();

            [dashBtn].forEach(btn => {
                btn?.classList.remove('bg-cyan-50', 'dark:bg-cyan-950/30', 'text-sky-800', 'dark:text-cyan-300');
                btn?.classList.add('text-slate-700', 'dark:text-slate-100');
            });

            dashboardView?.classList.remove('hidden');
            if (viewId !== 'favorites') dashBtn?.classList.add('bg-cyan-50', 'dark:bg-cyan-950/30', 'text-sky-800', 'dark:text-cyan-300');
            if (!skipSave) saveRepUiState();
            if (!skipRender) renderShipments();
        }

        function syncQuickStatCards() {
            return;
        }

        function isMobileSwipeViewport() {
            return false;
        }

        function resetShipmentSwipeCard(card, animate = true) {
            if (!card) return;
            card.style.transition = animate ? 'transform 180ms ease, background 180ms ease' : '';
            card.style.transform = 'translateX(0px)';
            card.style.background = '';
        }

        function applyShipmentSwipeVisual(card, deltaX) {
            if (!card) return;
            const limitedX = Math.max(-120, Math.min(120, deltaX));
            const progress = Math.min(Math.abs(limitedX) / 120, 1);
            card.style.transition = 'none';
            card.style.transform = `translateX(${limitedX}px)`;

            if (limitedX > 0) {
                card.style.background = `linear-gradient(90deg, rgba(16,185,129,${0.18 + progress * 0.18}) 0%, rgba(255,255,255,0) 65%)`;
            } else if (limitedX < 0) {
                card.style.background = `linear-gradient(270deg, rgba(245,158,11,${0.18 + progress * 0.18}) 0%, rgba(255,255,255,0) 65%)`;
            } else {
                card.style.background = '';
            }
        }

        function canStartShipmentSwipe(target) {
            return !target.closest('button, a, input, select, textarea, label, [data-action]');
        }

        function closeQuickActionsMenu() {
            const menu = el('quickActionsMenu');
            if (!menu) return;
            menu.classList.add('hidden');
            isQuickActionsMenuOpen = false;
        }

        function toggleQuickActionsMenu(forceState = null) {
            const menu = el('quickActionsMenu');
            if (!menu) return;
            const shouldOpen = typeof forceState === 'boolean' ? forceState : menu.classList.contains('hidden');
            if (shouldOpen) {
                closeRepNotificationsPanel();
            }
            menu.classList.toggle('hidden', !shouldOpen);
            isQuickActionsMenuOpen = shouldOpen;
        }

        function setShipmentMenuMode(mode = 'copy') {}

        function openShipmentMenuAtPosition(shipmentId, left, top, mode = 'copy') {
            const menu = document.getElementById('shipmentMenu');
            if (!menu) return;

            const isOpenForSameShipment = activeShipmentMenuId === shipmentId && activeShipmentMenuMode === mode && !menu.classList.contains('hidden');
            if (isOpenForSameShipment) {
                closeShipmentMenu();
                return;
            }

            activeShipmentMenuId = shipmentId;
            activeShipmentMenuMode = mode;
            setShipmentMenuMode(mode);
            menu.classList.remove('hidden');
            setShipmentMenuActionState(isShipmentUpdateLocked(shipmentId));

            const menuWidth = 220;
            const menuHeight = menu.offsetHeight || 220;
            const resolvedLeft = Math.max(12, Math.min(left, window.innerWidth - menuWidth - 12));
            const resolvedTop = Math.max(12, Math.min(top, window.innerHeight - menuHeight - 12));

            menu.style.left = `${resolvedLeft}px`;
            menu.style.top = `${resolvedTop}px`;
        }

        async function handleShipmentSwipeAction(shipmentId, direction) {
            if (!shipmentId) return;

            if (direction === 'right') {
                await updateStatus(shipmentId, 'تم التسليم');
                return;
            }

            const card = document.querySelector(`[data-shipment-card][data-id="${shipmentId}"]`);
            if (!card) return;

            const rect = card.getBoundingClientRect();
            openShipmentMenuAtPosition(
                shipmentId,
                rect.left + 12,
                rect.top + Math.min(rect.height, 120)
            );
        }

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
        let isQuickActionsMenuOpen = false;

        function el(id) {
            return document.getElementById(id);
        }

        function getElementValue(id) {
            return el(id)?.value || '';
        }

        function getSingleSelectFilter(id) {
            const value = String(getElementValue(id) || '').trim();
            return !value || value === 'الكل' ? [] : [value];
        }

        function applyActiveSelectState(select, selectedArr, defaultValue = 'الكل') {
            if (!select) return;

            if (selectedArr.length > 0) {
                select.value = selectedArr[0];
                select.classList.add('bg-sky-800', 'text-white', 'border-sky-800', 'shadow-cyan-500/30');
                select.classList.remove('bg-white', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-200');
            } else {
                select.value = defaultValue;
                select.classList.remove('bg-sky-800', 'text-white', 'border-sky-800', 'shadow-cyan-500/30');
                select.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-200');
            }
        }

        function getSelectedStatuses() {
            return Array.from(statusFilterSelections).filter(status => status !== FAVORITES_FILTER_VALUE);
        }

        function isFavoritesFilterSelected() {
            return statusFilterSelections.has(FAVORITES_FILTER_VALUE);
        }

        function rememberCurrentNonFavoritesStatuses() {
            const statuses = getSelectedStatuses().filter(status => STATUS_OPTIONS.includes(status));
            if (statuses.length > 0) {
                lastNonFavoritesStatusSelections = new Set(statuses);
            }
        }

        function restoreStatusSelectionAfterFavorites() {
            statusFilterSelections.clear();
            const preferredStatuses = [...lastNonFavoritesStatusSelections].filter(status => STATUS_OPTIONS.includes(status));
            if (preferredStatuses.length > 0) {
                preferredStatuses.forEach(status => statusFilterSelections.add(status));
                return;
            }
            statusFilterSelections.add('قيد التوصيل');
        }

        function exitFavoritesView(options = {}) {
            restoreStatusSelectionAfterFavorites();
            switchRepView('dashboard', options);
            fillStatusDropdown();
        }

        function getSelectedDates() {
            return Array.from(dateFilterSelections);
        }

        function setGpsRequiredMessage(message) {
            const messageEl = el('gpsRequiredMessage');
            if (messageEl) messageEl.innerText = message;
        }

        function lockGpsGate(message) {
            if (!gpsEnforcementRequired) {
                unlockGpsGate();
                return;
            }
            gpsGateUnlocked = false;
            el('gpsRequiredOverlay')?.classList.remove('hidden');
            if (message) setGpsRequiredMessage(message);
            const list = el('shipmentsList');
            if (list) {
                list.innerHTML = `
                    <div class="text-center py-10 opacity-70">
                        <i class="fas fa-location-crosshairs text-5xl mb-3 text-sky-500"></i>
                        <p class="font-bold">يجب تشغيل الموقع أولًا لعرض الشحنات</p>
                    </div>
                `;
            }
        }

        function unlockGpsGate() {
            gpsGateUnlocked = true;
            el('gpsRequiredOverlay')?.classList.add('hidden');
        }

        async function ensureTrackingActivated() {
            if (!trackingSystem) return;
            try {
                if (!trackingSystem.isTracking) {
                    await trackingSystem.toggleShift();
                    updateTrackingUI();
                }
            } catch (error) { }
        }

        async function requestGpsAccessAndUnlock(forcePrompt = false) {
            await refreshGpsEnforcementSetting();
            if (!gpsEnforcementRequired) {
                unlockGpsGate();
                return true;
            }
            if (gpsGateCheckInFlight) return gpsGateUnlocked;
            gpsGateCheckInFlight = true;

            try {
                setGpsRequiredMessage('جاري التحقق من صلاحية الموقع...');

                if (!navigator.geolocation) {
                    lockGpsGate('هذا المتصفح لا يدعم تحديد الموقع. استخدم جهازًا يدعم GPS.');
                    return false;
                }

                if (!forcePrompt && navigator.permissions?.query) {
                    try {
                        const permission = await navigator.permissions.query({ name: 'geolocation' });
                        if (permission.state === 'denied') {
                            lockGpsGate('تم رفض صلاحية الموقع. فعّل الموقع من إعدادات المتصفح ثم أعد المحاولة.');
                            return false;
                        }
                    } catch (error) { }
                }

                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 12000,
                        maximumAge: 0
                    });
                });

                unlockGpsGate();
                await ensureTrackingActivated();
                return true;
            } catch (error) {
                lockGpsGate('يجب تشغيل GPS والسماح بالموقع أولًا حتى تتمكن من متابعة الشحنات.');
                return false;
            } finally {
                gpsGateCheckInFlight = false;
            }
        }

        async function enforceGpsStillEnabled() {
            await refreshGpsEnforcementSetting();
            if (!gpsEnforcementRequired) {
                unlockGpsGate();
                return;
            }
            if (!gpsGateUnlocked || gpsGateCheckInFlight) return;

            if (navigator.permissions?.query) {
                try {
                    const permission = gpsPermissionStatus || await navigator.permissions.query({ name: 'geolocation' });
                    gpsPermissionStatus = permission;
                    if (permission.state === 'denied') {
                        lockGpsGate('تم إيقاف صلاحية الموقع. يجب إعادة تفعيلها لمتابعة استخدام الحساب.');
                        return;
                    }
                } catch (error) { }
            }

            try {
                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: false,
                        timeout: 8000,
                        maximumAge: 15000
                    });
                });
            } catch (error) {
                lockGpsGate('تم إيقاف GPS أو تعذر الوصول للموقع. فعّل الموقع من جديد للمتابعة.');
            }
        }

        async function startGpsEnforcement() {
            await refreshGpsEnforcementSetting({ force: true });
            if (navigator.permissions?.query) {
                try {
                    gpsPermissionStatus = await navigator.permissions.query({ name: 'geolocation' });
                    gpsPermissionStatus.onchange = () => {
                        if (!gpsEnforcementRequired) return;
                        if (gpsPermissionStatus.state === 'denied') {
                            lockGpsGate('تم إيقاف صلاحية الموقع. يجب إعادة تفعيلها لمتابعة استخدام الحساب.');
                            return;
                        }
                        if (gpsPermissionStatus.state === 'granted') {
                            ensureGpsReadyAndLoadShipments(false);
                        }
                    };
                } catch (error) { }
            }

            if (gpsEnforcementTimer) clearInterval(gpsEnforcementTimer);
            gpsEnforcementTimer = setInterval(() => {
                enforceGpsStillEnabled();
            }, 300000);

            if (gpsSettingsRefreshTimer) clearInterval(gpsSettingsRefreshTimer);
            gpsSettingsRefreshTimer = setInterval(async () => {
                const previous = gpsEnforcementRequired;
                const current = await refreshGpsEnforcementSetting({ force: true });
                if (!current) {
                    unlockGpsGate();
                    return;
                }
                if (!previous && current) {
                    ensureGpsReadyAndLoadShipments(false);
                }
            }, GPS_ENFORCEMENT_REFRESH_MS);
        }

        async function ensureGpsReadyAndLoadShipments(forcePrompt = false) {
            const isRequired = await refreshGpsEnforcementSetting();
            if (!isRequired) {
                unlockGpsGate();
                fetchShipments();
                return true;
            }
            const isReady = await requestGpsAccessAndUnlock(forcePrompt);
            if (isReady) fetchShipments();
            return isReady;
        }

        function getSelectedZones() {
            return Array.from(zoneFilterSelections);
        }

        function getSelectedSenders() {
            return Array.from(senderFilterSelections);
        }

        function setDateSelection(value) {
            const normalizedValue = String(value || '').trim();
            dateFilterSelections.clear();
            if (normalizedValue) {
                dateFilterSelections.add(normalizedValue);
            }

            saveDateFilter(normalizedValue);
            saveRepUiState();
            stopDateFilterGlow();
            renderShipments();
        }

        function toggleDateSelection(value) {
            setDateSelection(value);
        }

        function toggleZoneSelection(value) {
            const normalizedValue = String(value || '').trim();
            if (!normalizedValue) return;

            zoneFilterSelections.clear();
            if (normalizedValue !== 'الكل') {
                zoneFilterSelections.add(normalizedValue);
            }

            saveRepUiState();
            renderShipments();
        }

        function toggleStatusSelection(value) {
            const normalizedValue = String(value || '').trim();
            const previousStatuses = getSelectedStatuses().filter(status => STATUS_OPTIONS.includes(status));
            statusFilterSelections.clear();

            if (normalizedValue === FAVORITES_FILTER_VALUE) {
                if (previousStatuses.length > 0) {
                    lastNonFavoritesStatusSelections = new Set(previousStatuses);
                }
                statusFilterSelections.add(FAVORITES_FILTER_VALUE);
                saveRepUiState();
                switchRepView('favorites');
                return;
            }

            if (normalizedValue) {
                statusFilterSelections.add(normalizedValue);
                lastNonFavoritesStatusSelections = new Set([normalizedValue]);
            }

            if (currentActiveView === 'favorites') {
                switchRepView('dashboard', { skipRender: true });
            }
            saveRepUiState();
            syncQuickStatCards();
            renderShipments();
        }

        function toggleSenderSelection(value) {
            const normalizedValue = String(value || '').trim();
            if (!normalizedValue) return;

            senderFilterSelections.clear();
            if (normalizedValue !== 'الكل') {
                senderFilterSelections.add(normalizedValue);
            }

            saveRepUiState();
            renderShipments();
        }

        function clearAllRepFilters() {
            dateFilterSelections.clear();
            statusFilterSelections.clear();
            zoneFilterSelections.clear();
            senderFilterSelections.clear();
            const searchInput = el('searchInput');
            if (searchInput) searchInput.value = '';
            saveDateFilter('');
            if (currentActiveView === 'favorites') {
                switchRepView('dashboard', { skipRender: true, skipSave: true });
            }
            saveRepUiState();
            fillStatusDropdown();
            syncQuickStatCards();
            renderShipments();
        }

        function renderActiveFilterSummary() {
            const summaryEl = el('activeFiltersSummary');
            const clearBtn = el('clearFiltersBtn');
            if (!summaryEl || !clearBtn) return;

            const chips = [];
            const selectedDates = getSelectedDates();
            const selectedStatuses = getSelectedStatuses();
            const selectedZones = getSelectedZones();
            const selectedSenders = getSelectedSenders();
            const searchValue = String(getElementValue('searchInput') || '').trim();

            if (selectedDates.length > 0) chips.push(`اليومية: ${selectedDates[0]}`);
            if (selectedStatuses.length > 0) chips.push(`الحالة: ${selectedStatuses[0]}`);
            if (selectedZones.length > 0) chips.push(`الزون: ${selectedZones[0]}`);
            if (selectedSenders.length > 0) chips.push(`الراسل: ${selectedSenders[0]}`);
            if (searchValue) chips.push(`بحث: ${searchValue}`);

            if (chips.length === 0) {
                summaryEl.innerHTML = `<span class="text-[11px] font-black text-slate-400 dark:text-slate-500">لا توجد فلاتر مفعلة</span>`;
                clearBtn.classList.add('hidden');
                return;
            }

            summaryEl.innerHTML = chips.map((chip) => `
                <span class="filter-summary-chip">${chip}</span>
            `).join('');
            clearBtn.classList.remove('hidden');
        }

        function stopDateFilterGlow() {
            const dateSelect = el('filterDateSelect');
            if (dateFilterGlowTimeout) {
                clearTimeout(dateFilterGlowTimeout);
                dateFilterGlowTimeout = null;
            }
            dateSelect?.classList.remove('rep-date-filter-glow');
        }

        function triggerDateFilterGlow() {
            const dateSelect = el('filterDateSelect');
            if (!dateSelect) return;

            if (dateFilterGlowTimeout) {
                clearTimeout(dateFilterGlowTimeout);
                dateFilterGlowTimeout = null;
            }

            dateSelect.classList.add('rep-date-filter-glow');
            dateFilterGlowTimeout = setTimeout(() => {
                dateSelect.classList.remove('rep-date-filter-glow');
                dateFilterGlowTimeout = null;
            }, 12000);
        }

        function focusDateFilterPicker() {
            const dateSelect = el('filterDateSelect');
            if (!dateSelect) return;

            triggerDateFilterGlow();
            dateSelect.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

            setTimeout(() => {
                dateSelect.focus({ preventScroll: true });
                if (typeof dateSelect.showPicker === 'function') {
                    try {
                        dateSelect.showPicker();
                        return;
                    } catch (error) { }
                }
                dateSelect.click();
            }, 180);
        }

        function promptOpenDateFilterIfNeeded() {}

        function saveRepUiState() {
            try {
                localStorage.setItem(REP_UI_STATE_KEY, JSON.stringify({
                    view: currentActiveView,
                    search: getElementValue('searchInput'),
                    date: getSelectedDates(),
                    status: isFavoritesFilterSelected() ? [FAVORITES_FILTER_VALUE] : getSelectedStatuses(),
                    lastNonFavoriteStatus: [...lastNonFavoritesStatusSelections],
                    zone: getSelectedZones(),
                    sender: getSelectedSenders(),
                    displayLimit: currentDisplayLimit
                }));
            } catch (error) { }
        }

        function restoreRepUiState() {
            let state = null;
            try {
                state = JSON.parse(localStorage.getItem(REP_UI_STATE_KEY) || 'null');
            } catch (error) { }

            if (state && state.date) {
                const dates = Array.isArray(state.date) ? state.date : [state.date];
                dates.map(d => String(d || '').trim()).filter(Boolean).forEach(d => dateFilterSelections.add(d));
            } else {
                const legacyDate = getSavedDateFilter();
                const normalizedLegacyDate = String(legacyDate || '').trim();
                if (normalizedLegacyDate) dateFilterSelections.add(normalizedLegacyDate);
            }

            if (state && state.status) {
                const statuses = Array.isArray(state.status) ? state.status : [state.status];
                statusFilterSelections.clear();
                statuses.map(s => String(s || '').trim()).filter(Boolean).forEach(s => statusFilterSelections.add(s));
            }
            if (state && state.lastNonFavoriteStatus) {
                const lastStatuses = Array.isArray(state.lastNonFavoriteStatus) ? state.lastNonFavoriteStatus : [state.lastNonFavoriteStatus];
                lastNonFavoritesStatusSelections = new Set(
                    lastStatuses.map(s => String(s || '').trim()).filter(s => STATUS_OPTIONS.includes(s))
                );
            }
            if (state && state.zone) {
                const zones = Array.isArray(state.zone) ? state.zone : [state.zone];
                zones.map(z => String(z || '').trim()).filter(Boolean).forEach(z => zoneFilterSelections.add(z));
            }

            if (!state) return;

            if (state && state.sender) {
                const senders = Array.isArray(state.sender) ? state.sender : [state.sender];
                senders.map(s => String(s || '').trim()).filter(Boolean).forEach(s => senderFilterSelections.add(s));
            }

            const savedDisplayLimit = Number(state?.displayLimit || 40);
            if (!Number.isNaN(savedDisplayLimit) && savedDisplayLimit >= 40) {
                currentDisplayLimit = savedDisplayLimit;
            }

            if (!state) return;

            const searchInput = el('searchInput');

            if (searchInput) searchInput.value = state.search || '';
            if (!isFavoritesFilterSelected()) rememberCurrentNonFavoritesStatuses();

            const savedView = String(state.view || '').trim();
            if (savedView === 'favorites' || savedView === 'dashboard') {
                switchRepView(savedView, { skipRender: true, skipSave: true });
            }
        }

        