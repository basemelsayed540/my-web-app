const { createClient } = supabase;
        const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        const REP_NOTIFICATIONS_KEY = 'rep_local_notifications';

        let user = RepsSession.requireUser(['rep', 'مندوب فرعي'], 'login.html');
        let repNotifications = JSON.parse(localStorage.getItem(REP_NOTIFICATIONS_KEY) || '[]');
        let isNotificationsPanelOpen = false;
        let isQuickActionsMenuOpen = false;

        function el(id) {
            return document.getElementById(id);
        }

        function setNotificationsButtonActive(active) {
            const notifBtn = el('nav-btn-notifications');
            if (!notifBtn) return;
            notifBtn.classList.toggle('text-sky-800', active);
            notifBtn.classList.toggle('dark:text-cyan-300', active);
            notifBtn.classList.toggle('text-slate-500', !active);
            notifBtn.classList.toggle('dark:text-slate-200', !active);
        }

        function updateRepNotifUI() {
            const badge = el('repUnreadBadge');
            if (!badge) return;
            const unreadCount = repNotifications.filter(n => !n.read).length;
            badge.innerText = unreadCount > 99 ? '99+' : String(unreadCount);
            badge.classList.toggle('hidden', unreadCount <= 0);
            if (isNotificationsPanelOpen) renderRepNotifications();
        }

        function renderRepNotifications() {
            const container = el('repNotificationsContainer');
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

            container.innerHTML = repNotifications.map(n => `
                <div class="p-4 rounded-[1.5rem] flex items-start gap-3 border transition-all ${n.read ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800' : 'bg-gradient-to-l from-cyan-50 via-sky-50 to-white dark:from-cyan-950/40 dark:via-slate-900 dark:to-slate-900 border-cyan-200 dark:border-cyan-800 shadow-md shadow-cyan-100/60 dark:shadow-none ring-1 ring-cyan-100 dark:ring-cyan-900/40'}">
                    <div class="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${n.read ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300' : 'bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 ring-4 ring-white dark:ring-slate-900'}">
                        <i class="fas fa-bell"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start gap-3">
                            <h4 class="text-xs font-black text-slate-800 dark:text-white">${n.client || n.order_id || 'إشعار جديد'}</h4>
                            <span class="text-[9px] text-slate-400 dark:text-slate-300 font-bold">${n.time || ''}</span>
                        </div>
                        <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-1">${n.type || 'تحديث جديد'}</p>
                    </div>
                </div>
            `).join('');
        }

        function markAllRepNotificationsAsRead() {
            repNotifications = repNotifications.map(item => ({ ...item, read: true }));
            localStorage.setItem(REP_NOTIFICATIONS_KEY, JSON.stringify(repNotifications));
            updateRepNotifUI();
        }

        function clearRepNotifications() {
            repNotifications = [];
            localStorage.setItem(REP_NOTIFICATIONS_KEY, JSON.stringify(repNotifications));
            updateRepNotifUI();
        }

        function openRepNotificationsPanel() {
            const panel = el('repNotificationsPanel');
            if (!panel) return;
            isNotificationsPanelOpen = true;
            panel.classList.remove('hidden');
            setNotificationsButtonActive(true);
            renderRepNotifications();
        }

        function closeRepNotificationsPanel() {
            const panel = el('repNotificationsPanel');
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
            closeQuickActionsMenu();
            openRepNotificationsPanel();
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
            if (shouldOpen) closeRepNotificationsPanel();
            menu.classList.toggle('hidden', !shouldOpen);
            isQuickActionsMenuOpen = shouldOpen;
        }

        function handleGpsButtonClick() {
            if (!navigator.geolocation) {
                Swal.fire('تنبيه', 'المتصفح لا يدعم خدمة الموقع على هذا الجهاز', 'warning');
                return;
            }

            navigator.geolocation.getCurrentPosition(
                () => {
                    Swal.fire({
                        toast: true,
                        position: 'top-start',
                        icon: 'success',
                        title: 'تم تفعيل الوصول إلى الموقع',
                        showConfirmButton: false,
                        timer: 2000
                    });
                },
                () => {
                    Swal.fire('تنبيه', 'يرجى السماح بالوصول إلى الموقع من إعدادات المتصفح', 'warning');
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }

        startStoredUserSessionGuard(supabaseClient, {
            allowedRoles: ['rep', 'مندوب فرعي'],
            onValidUser: (latestUser) => {
                user = latestUser;
                const repNameEl = document.getElementById('repName');
                if (repNameEl) repNameEl.innerText = latestUser.full_name || latestUser.username || latestUser.phone;
                document.getElementById('profileName').innerText = latestUser.full_name || latestUser.username || 'مندوب';
                document.getElementById('profilePhone').innerText = latestUser.phone || 'غير مسجل';
            }
        });

        const repNameEl = document.getElementById('repName');
        if (repNameEl) repNameEl.innerText = user.full_name || user.username || user.phone;
        document.getElementById('profileName').innerText = user.full_name || user.username || 'مندوب';
        document.getElementById('profilePhone').innerText = user.phone || 'غير مسجل';

        async function changePassword(e) {
            e.preventDefault();
            
            const oldPass = document.getElementById('oldPassword').value;
            const newPass = document.getElementById('newPassword').value;
            const confirmPass = document.getElementById('confirmPassword').value;
            const btn = document.getElementById('submitBtn');

            if (newPass !== confirmPass) {
                Swal.fire('خطأ', 'كلمة المرور الجديدة غير متطابقة', 'error');
                return;
            }

            if(newPass.length < 4) {
                 Swal.fire('تنبيه', 'كلمة المرور يجب أن تكون 4 أحرف على الأقل', 'warning');
                 return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';

            try {
                if (!(await verifyCurrentPasswordSecure(oldPass))) {
                    Swal.fire('خطأ', 'كلمة المرور الحالية غير صحيحة', 'error');
                    btn.disabled = false;
                    btn.innerHTML = 'حفظ كلمة المرور';
                    return;
                }

                // 2. Update to new password
                const hashedNewPass = await hashPassword(newPass);
                try {
                    await invokeUsersAuthAction('change_password', {
                        oldPassword: oldPass,
                        newPasswordHash: hashedNewPass
                    });
                    Swal.fire('تم بنجاح', 'تم تغيير كلمة المرور، يرجى تسجيل الدخول مجدداً', 'success').then(() => {
                        logout();
                    });
                } catch (updateError) {
                    Swal.fire('خطأ', updateError.message || 'فشل في تحديث كلمة المرور', 'error');
                }

            } catch (err) {
                console.error(err);
                Swal.fire('خطأ', 'حدث خطأ غير متوقع', 'error');
            }

            btn.disabled = false;
            btn.innerHTML = 'حفظ كلمة المرور';
        }

        function logout() {
            RepsSession.clear();
        }

        RepsTheme.apply();

        el('quickActionsToggleBtn')?.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleQuickActionsMenu();
        });
        el('nav-btn-notifications')?.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleRepNotificationsPanel();
        });
        el('themeToggleBtn')?.addEventListener('click', () => {
            toggleTheme();
            closeQuickActionsMenu();
        });
        el('gpsToggleBtn')?.addEventListener('click', () => {
            handleGpsButtonClick();
            closeQuickActionsMenu();
        });
        el('logoutMenuBtn')?.addEventListener('click', () => {
            closeQuickActionsMenu();
            logout();
        });
        el('markAllRepNotificationsReadBtn')?.addEventListener('click', markAllRepNotificationsAsRead);
        el('clearRepNotificationsBtn')?.addEventListener('click', clearRepNotifications);
        document.addEventListener('click', (event) => {
            const quickActionsMenu = el('quickActionsMenu');
            const quickActionsBtn = el('quickActionsToggleBtn');
            if (isQuickActionsMenuOpen && quickActionsMenu && quickActionsBtn && !quickActionsMenu.contains(event.target) && !quickActionsBtn.contains(event.target)) {
                closeQuickActionsMenu();
            }
            const notifPanel = el('repNotificationsPanel');
            const notifBtn = el('nav-btn-notifications');
            if (isNotificationsPanelOpen && notifPanel && notifBtn && !notifPanel.contains(event.target) && !notifBtn.contains(event.target)) {
                closeRepNotificationsPanel();
            }
        });
        updateRepNotifUI();
