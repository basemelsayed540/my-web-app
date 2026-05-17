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

            // تصفية الإشعارات: منع ظهور إشعار إذا كان المستخدم الحالي هو من قام بالتحديث
            // الهدف هو إظهار إشعارات الإدارة فقط
            const currentUser = typeof RepsSession !== 'undefined' ? RepsSession.getStoredUser() : null;
            const currentUserName = (currentUser?.full_name || currentUser?.username || '').trim();
            const actionUser = String(shipment['اسم الموظف'] || shipment['اسم الموظ'] || shipment['اسم_الموظف'] || '').trim();

            if (currentUserName && actionUser === currentUserName) {
                return; // لا تضف إشعاراً إذا كان المندوب هو من قام بالعملية
            }

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

            if (typeof AppCrypto !== 'undefined') {
                AppCrypto.setItem(REP_NOTIFICATIONS_KEY, repNotifications);
            } else {
                localStorage.setItem(REP_NOTIFICATIONS_KEY, JSON.stringify(repNotifications));
            }
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
            const badge = document.getElementById('repUnreadBadge');
            const unreadCount = repNotifications.filter(n => !n.read).length;

            if (badge) {
                if (unreadCount > 0) {
                    badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
                    badge.classList.remove('hidden');
                    badge.classList.add('flex');
                } else {
                    badge.classList.add('hidden');
                    badge.classList.remove('flex');
                }
            }

            // Sync with Native Icon Badge
            try {
                if (typeof Capacitor !== 'undefined' && Capacitor.Plugins.LocalNotifications) {
                    // For Android, usually dismissal of notifications clears the badge,
                    // but we can try to set it explicitly if needed by re-scheduling or using a dedicated badge plugin if available.
                }
            } catch (e) {}

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
            if (typeof AppCrypto !== 'undefined') {
                AppCrypto.setItem(REP_NOTIFICATIONS_KEY, repNotifications);
            } else {
                localStorage.setItem(REP_NOTIFICATIONS_KEY, JSON.stringify(repNotifications));
            }
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
            if (typeof AppCrypto !== 'undefined') {
                AppCrypto.setItem(REP_NOTIFICATIONS_KEY, repNotifications);
            } else {
                localStorage.setItem(REP_NOTIFICATIONS_KEY, JSON.stringify(repNotifications));
            }
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

        
