function renderAccountsList() {
            const container = document.getElementById('accountsListContainer');
            if (!container) return;
            if (subRepAccounts.length === 0) {
                container.innerHTML = '<div class="col-span-full text-center p-8 text-slate-500 font-bold glass rounded-2xl">لا توجد حسابات مناديب فرعيين مرتبطة بحسابك حالياً.</div>';
                return;
            }

            container.innerHTML = subRepAccounts.map(acc => `
                <div class="glass p-5 rounded-[2rem] flex items-center justify-between border border-slate-100 dark:border-slate-800/60 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all hover:shadow-md bg-white/50 dark:bg-slate-900/40">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xl shadow-sm">
                            ${(acc.full_name || acc.username || 'م')[0]}
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-800 dark:text-white text-base">${acc.full_name || acc.username}</h3>
                            <p class="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                <i class="fas fa-phone-alt"></i> ${acc.phone || '---'}
                            </p>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <span class="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black border border-emerald-100">
                             مفعل
                        </span>
                        <div class="flex items-center gap-1">
                            <button onclick="openEditUserModal('${acc.id}')" class="w-10 h-10 bg-indigo-50 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-indigo-300 rounded-xl transition-all flex items-center justify-center" title="تعديل">
                                <i class="fas fa-pen text-xs"></i>
                            </button>
                            <button onclick="deleteSubRepAccount('${acc.id}', '${acc.full_name || acc.username}')" class="w-10 h-10 bg-rose-50 dark:bg-rose-900/40 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 rounded-xl transition-all flex items-center justify-center" title="مسح">
                                <i class="fas fa-trash-alt text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        function renderSubRepStats() {
            const container = document.getElementById('subRepStatsContainer');
            if (!container) return;
            if (subRepAccounts.length === 0) {
                container.innerHTML = '<div class="text-center p-8 text-slate-500 font-bold glass rounded-2xl">لا توجد مناديب فرعيون لعرض إحصائياتهم.</div>';
                return;
            }

            container.innerHTML = subRepAccounts.map(acc => {
                const name = acc.full_name || acc.username;
                const repShipments = allShipments.filter(s => s.المندوب === name || s.المندوب === acc.username);
                const total = repShipments.length;
                const delivered = repShipments.filter(s => getShipmentDisplayStatus(s) === 'تم التوصيل').length;
                const returned = repShipments.filter(s => getShipmentDisplayStatus(s) === 'مرتجع' || getShipmentDisplayStatus(s) === 'مروض').length;
                const postponed = repShipments.filter(s => getShipmentDisplayStatus(s) === 'مؤجل').length;
                const cancelled = repShipments.filter(s => getShipmentDisplayStatus(s) === 'الغاء').length;
                const inProgress = total - (delivered + returned + postponed + cancelled);

                const statusBadge = acc.approved 
                    ? '<span class="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full uppercase border border-emerald-100 dark:border-emerald-500/20">مفعل</span>'
                    : '<span class="text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-3 py-1 rounded-full uppercase border border-rose-100 dark:border-rose-500/20">معلق</span>';
                
                const approvalBtn = acc.approved
                    ? `<button onclick="toggleAccountApproval('${acc.id}', false)" class="w-10 h-10 bg-rose-50 dark:bg-slate-700 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-300 rounded-xl transition-all flex items-center justify-center" title="تعطيل الحساب"><i class="fas fa-user-slash text-xs"></i></button>`
                    : `<button onclick="toggleAccountApproval('${acc.id}', true)" class="w-10 h-10 bg-emerald-50 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white text-emerald-600 dark:text-emerald-300 rounded-xl transition-all flex items-center justify-center" title="تفعيل الحساب"><i class="fas fa-user-check text-xs"></i></button>`;

                return `
                    <div class="glass p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 mb-4 bg-white/40 dark:bg-slate-900/40">
                        <div class="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
                            <h3 class="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                                <i class="fas fa-user-circle text-indigo-500"></i> ${name}
                            </h3>
                            <div class="flex items-center gap-2">
                                ${statusBadge}
                                <span class="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full uppercase">تقرير المندوب</span>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
                            <div class="bg-indigo-50/50 dark:bg-indigo-500/10 p-3 rounded-2xl text-center border border-indigo-100/50 dark:border-indigo-500/20">
                                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1">الإجمالي</p>
                                <p class="text-xl font-black text-indigo-600 dark:text-indigo-400">${total}</p>
                            </div>
                            <div class="bg-emerald-50/50 dark:bg-emerald-500/10 p-3 rounded-2xl text-center border border-emerald-100/50 dark:border-emerald-500/20">
                                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1">تم التوصيل</p>
                                <p class="text-xl font-black text-emerald-600 dark:text-emerald-400">${delivered}</p>
                            </div>
                            <div class="bg-rose-50/50 dark:bg-rose-500/10 p-3 rounded-2xl text-center border border-rose-100/50 dark:border-rose-500/20">
                                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1">مرتجع</p>
                                <p class="text-xl font-black text-rose-600 dark:text-rose-400">${returned}</p>
                            </div>
                            <div class="bg-amber-50/50 dark:bg-amber-500/10 p-3 rounded-2xl text-center border border-amber-100/50 dark:border-amber-500/20">
                                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1">مؤجل</p>
                                <p class="text-xl font-black text-amber-600 dark:text-amber-400">${postponed}</p>
                            </div>
                            <div class="bg-red-50/50 dark:bg-red-500/10 p-3 rounded-2xl text-center border border-red-100/50 dark:border-red-500/20">
                                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1">إلغاء</p>
                                <p class="text-xl font-black text-red-600 dark:text-red-400">${cancelled}</p>
                            </div>
                            <div class="flex items-center justify-center gap-2">
                                ${approvalBtn}
                                <button onclick="openEditUserModal('${acc.id}')" class="w-10 h-10 bg-indigo-50 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-indigo-300 rounded-xl transition-all flex items-center justify-center" title="تعديل">
                                    <i class="fas fa-pen text-xs"></i>
                                </button>
                                <button onclick="deleteSubRepAccount('${acc.id}', '${name}')" class="w-10 h-10 bg-rose-50 dark:bg-slate-700 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-300 rounded-xl transition-all flex items-center justify-center" title="حذ">
                                    <i class="fas fa-trash text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Pulse effect for pending approvals
            const hasPending = subRepAccounts.some(u => !u.approved);
            const navBtn = document.getElementById('nav-accounts');
            if (navBtn) {
                if (hasPending) navBtn.classList.add('pulse-highlight-red');
                else navBtn.classList.remove('pulse-highlight-red');
            }
        }

        async function toggleAccountApproval(id, newStatus) {
            try {
                await invokeUsersAdminAction('subrep_toggle_approval', {
                    targetUserId: id,
                    newStatus
                }, user);

                Swal.fire({
                    icon: 'success',
                    title: newStatus ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب',
                    timer: 1500,
                    showConfirmButton: false
                });
                await fetchSubRepAccounts();
                renderAccountsList();
            } catch (error) {
                Swal.fire('خطأ', error.message, 'error');
            }
        }

        async function deleteSubRepAccount(id, name) {
            const confirmed = await Swal.fire({
                title: 'هل أنت متأكد؟',
                text: `هل تريد مسح المندوب الفرعي "${name}" نهائياً من حسابك؟`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#e11d48',
                cancelButtonColor: '#94a3b8',
                confirmButtonText: 'نعم، قم بالمسح',
                cancelButtonText: 'إلغاء',
                customClass: {
                    popup: 'rounded-[2rem]',
                    confirmButton: 'rounded-xl font-bold',
                    cancelButton: 'rounded-xl font-bold'
                }
            });

            if (confirmed.isConfirmed) {
                Swal.fire({ title: 'جاري المسح...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                try {
                    await invokeUsersAdminAction('subrep_delete_user', {
                        targetUserId: id
                    }, user);
                    Swal.fire('تم المسح', `تم مسح المندوب ${name} بنجاح.`, 'success');
                    await fetchSubRepAccounts();
                    renderAccountsList();
                    renderSubRepStats();
                    populateSubRepAssignTools();
                    renderFilterOptions(); // update filters removing this sub-rep
                } catch (error) {
                    Swal.fire('خطأ', error.message || 'حدث خطأ أثناء المسح', 'error');
                }
            }
        }

        function openEditUserModal(id) {
            const acc = subRepAccounts.find(u => String(u.id) === String(id));
            if (!acc) return;

            document.getElementById('editUserId').value = acc.id;
            document.getElementById('editUserName').value = acc.full_name || acc.username;
            document.getElementById('editUserPhone').value = acc.phone || '';
            document.getElementById('editUserPassword').value = '';

            document.getElementById('editUserModal').classList.remove('hidden');
            document.getElementById('editUserModal').classList.add('flex');
        }

        function closeEditUserModal() {
            document.getElementById('editUserModal').classList.add('hidden');
            document.getElementById('editUserModal').classList.remove('flex');
        }

        document.getElementById('editUserForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editUserId').value;
            const full_name = document.getElementById('editUserName').value.trim();
            const phone = document.getElementById('editUserPhone').value.trim();
            const password = document.getElementById('editUserPassword').value;

            const updateData = {
                username: full_name,

                phone: phone
            };

            if (password) {
                updateData.password = await hashPassword(password);
            }

            try {
                await invokeUsersAdminAction('subrep_update_user', {
                    targetUserId: id,
                    ...updateData
                }, user);

                Swal.fire('تم', 'تم تحديث بيانات الحساب بنجاح', 'success');
                closeEditUserModal();
                await fetchSubRepAccounts();
                renderAccountsList();
                populateFilters();
            } catch (error) {
                Swal.fire('خطأ', error.message, 'error');
            }
        });

        document.getElementById('userForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('newUserName').value.trim();
            const phone = document.getElementById('newUserPhone').value.trim();
            const password = document.getElementById('newUserPassword').value;
            const parentId = user.id;

            try {
                await invokeUsersAdminAction('subrep_create_user', {
                    username,
                    phone,
                    password: await hashPassword(password),
                    email: `${phone}@delegate.local`,
                    parent_id: parentId
                }, user);

                Swal.fire('تم', 'تم إنشاء الحساب بنجاح', 'success');
                document.getElementById('userForm').reset();
                await fetchSubRepAccounts();
                renderAccountsList();
                populateFilters();
            } catch (error) {
                Swal.fire('خطأ', error.message, 'error');
            }
        });

        function toggleSidebar() {
            const sidebar = document.getElementById('subRepSidebar');
            const overlay = document.getElementById('sidebarOverlay');

            if (sidebar?.classList.contains('translate-x-full')) {
                sidebar.classList.remove('translate-x-full');
                sidebar.classList.add('translate-x-0');
                overlay?.classList.remove('hidden');
            } else if (sidebar) {
                sidebar.classList.add('translate-x-full');
                sidebar.classList.remove('translate-x-0');
                overlay?.classList.add('hidden');
            }
        }