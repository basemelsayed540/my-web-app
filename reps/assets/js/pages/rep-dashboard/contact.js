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

        let user = RepsSession.requireUser(['rep', 'مندوب فرعي'], 'login.html');
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
        
        let repNotifications = JSON.parse(localStorage.getItem(REP_NOTIFICATIONS_KEY) || '[]');
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

        
