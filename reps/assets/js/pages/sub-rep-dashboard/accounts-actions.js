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
