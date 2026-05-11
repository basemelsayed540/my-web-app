async function updateShipmentInline(id, field, value) {
                const sIndex = allShipments.findIndex(x => String(x.id) === String(id));
                if (sIndex === -1) return;
                
                // For Status, we use getShipmentDisplayStatus. For others, direct mapping.
                const oldVal = field === 'الحالة' ? getShipmentDisplayStatus(allShipments[sIndex]) : field === 'سبب الحالة' ? getShipmentDisplayReason(allShipments[sIndex]) : allShipments[sIndex][field];
                
                // Prevent unnecessary DB calls
                if (String(oldVal || '').trim() === String(value || '').trim()) return;

                // Update UI locally for responsiveness
                allShipments[sIndex] = normalizeShipmentPriceField({ ...allShipments[sIndex], [field]: value });
                const updateData = { [field]: value };

                if (field === 'الحالة') {
                    allShipments[sIndex]['تاريخ التحديث'] = new Date().toISOString().split('T')[0];
                    allShipments[sIndex]['الابيديت'] = allShipments[sIndex]['تاريخ التحديث'];
                    updateData['تاريخ التحديث'] = allShipments[sIndex]['تاريخ التحديث'];
                    updateData['تاريخ الحالة'] = allShipments[sIndex]['تاريخ التحديث'];
                    const allChecked = checkedCount === checkboxes.length;
                    const someChecked = checkedCount > 0;
                    selectAll.checked = allChecked;
                    selectAll.indeterminate = !allChecked && someChecked;
                }
                
                const globalSelectAllText = document.getElementById('globalSelectAllText');
                const globalDeleteBtnText = document.getElementById('globalDeleteBtnText');
                if (globalSelectAllText) {
                    globalSelectAllText.innerText = `تحديد الكل (${checkedCount})`;
                }
                if (globalDeleteBtnText) {
                    globalDeleteBtnText.innerText = `مسح المحدد (${checkedCount})`;
                }
                const btnAssignBtnText = document.getElementById('btnAssignBtnText');
                const assignRepVal = document.getElementById('assignSubRep')?.value;
                if (btnAssignBtnText) {
                    btnAssignBtnText.innerText = assignRepVal ? `تطبيق التعيين (${checkedCount})` : `تطبيق التعيين`;
                }
                if (document.getElementById('massUpdateCount')) document.getElementById('massUpdateCount').innerText = checkedCount;
            }

            let _subRepAssignDebounce = null;
            function updateSubRepAssignButtons() {
                const newRepName = (document.getElementById('subRepNewRepName')?.value || '').trim();
                document.querySelectorAll('.subrep-assign-btn').forEach(btn => {
                    btn.innerText = newRepName || '—';
                    btn.title = newRepName ? `تعيين: ${newRepName}` : 'اكتب اسم المندوب أولاً';
                });
                clearTimeout(_subRepAssignDebounce);
                _subRepAssignDebounce = setTimeout(() => renderTable(), 300);
            }

            async function assignNewRepToShipment(id) {
                const newRepName = document.getElementById('subRepNewRepName')?.value.trim();
                if (!newRepName) {
                    Swal.fire('تنبيه', 'يرجى كتابة اسم المندوب ي حقل التعيين أولاً', 'warning');
                    return;
                }

                const { error } = await supabaseClient
                    .from(CONFIG.TABLES.SHIPMENTS)
                    .update(toServerShipmentPayload({ 
                        [SHIPMENT_SUBREP_FIELD_LEGACY]: newRepName,
                        [SHIPMENT_SUBREP_FIELD]: 'مندوب متقدم'
                    }))
                    .eq('id', id);
                if (!error) {
                    Swal.fire({
                        icon: 'success',
                        title: 'تم التعيين بنجاح',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 1500
                    });
                    const index = allShipments.findIndex(s => String(s.id) === String(id));
                    if (index !== -1) {
                        allShipments[index][SHIPMENT_SUBREP_FIELD] = 'مندوب متقدم';
                        allShipments[index][SHIPMENT_SUBREP_FIELD_LEGACY] = newRepName;
                    }
                    renderTable();
                } else {
                    Swal.fire('خطأ', 'فشل في التعيين السريع', 'error');
                }
            }

            function toggleAssignPulse(val) {
                const btn = document.getElementById('btnAssignSubRep');
                const btnText = document.getElementById('btnAssignBtnText');
                if (!btn) return;
                
                const checkedCount = document.querySelectorAll('.subrep-row-checkbox:checked').length;
                
                if (val) {
                    // Start strong pulse
                    btn.classList.add('animate-pulse', 'ring-4', 'ring-rose-400', 'shadow-rose-500/50', 'shadow-2xl', 'scale-105');
                    btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                    btn.classList.add('bg-rose-600', 'hover:bg-rose-700');
                    if (btnText) btnText.innerText = `تطبيق التعيين (${checkedCount})`;
                } else {
                    // Stop pulse
                    btn.classList.remove('animate-pulse', 'ring-4', 'ring-rose-400', 'shadow-rose-500/50', 'shadow-2xl', 'scale-105', 'bg-rose-600', 'hover:bg-rose-700');
                    btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
                    if (btnText) btnText.innerText = `تطبيق التعيين`;
                }
            }

            async function assignSubRepToVisible() {
                const repName = document.getElementById('assignSubRep').value;
                if (!repName) {
                    Swal.fire('تنبيه', 'يرجى اختيار مندوب للتعيين أولاً', 'warning');
                    return;
                }

                const selectedCheckboxes = document.querySelectorAll('.subrep-row-checkbox:checked');
                let targetIds = [];
                let isSelectedBase = false;

                if (selectedCheckboxes.length > 0) {
                    targetIds = Array.from(selectedCheckboxes).map(cb => cb.value);
                    isSelectedBase = true;
                } else {
                    const visible = getVisibleShipments();
                    if (visible.length === 0) {
                        Swal.fire('تنبيه', 'لا توجد شحنات ظاهرة أو محددة للتعيين', 'warning');
                        return;
                    }
                    targetIds = visible.map(s => s.id);
                }

                const { isConfirmed } = await Swal.fire({
                    title: 'تأكيد التعيين الجماعي',
                    html: `هل أنت متأكد من نقل <b class="text-indigo-600">${targetIds.length}</b> شحنة من الشحنات ${isSelectedBase ? 'المحددة' : 'الظاهرة'} إلى المندوب: <b class="text-indigo-600">${repName}</b>؟`,
                    icon: 'warning',
                    

                    showCancelButton: true,
                    confirmButtonText: 'نعم، تأكيد التعيين',
                    cancelButtonText: 'إلغاء',
                    confirmButtonColor: '#4f46e5'



                });

                if (!isConfirmed) return;

                const { error } = await supabaseClient
                    .from(CONFIG.TABLES.SHIPMENTS)
                    .update(toServerShipmentPayload({ 
                        [SHIPMENT_SUBREP_FIELD_LEGACY]: repName,
                        [SHIPMENT_SUBREP_FIELD]: 'مندوب متقدم'
                    }))
                    .in('id', targetIds);

                if (error) {
                    Swal.fire('خطأ', 'فشل في تعيين المندوب: ' + error.message, 'error');
                } else {
                    // البحث عن بيانات المندوب لإرسال إشعار واتساب
                    const subRep = subRepAccounts.find(u => (u.username === repName || u.full_name === repName));

                    if (subRep && subRep.phone) {
                        let phone = subRep.phone.trim();
                        if (phone.startsWith('0')) phone = '2' + phone; // إضافة مفتاح الدولة لمصر

                        const message = `مرحباً ${repName}،\nتم إسناد عدد (${targetIds.length}) شحنة جديدة إليك بنجاح.\nيرجى الدخول إلى لوحة المندوب الخاصة بك لبدء التوصيل.`;
                        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

                        Swal.fire({
                            icon: 'success',
                            title: 'تم التعيين بنجاح',
                            text: `تم تعيين الشحنات لـ ${repName}. هل تريد إرسال إشعار WhatsApp الآن؟`,
                            showCancelButton: true,
                            confirmButtonText: 'إرسال WhatsApp',
                            cancelButtonText: 'إغلاق',
                            confirmButtonColor: '#25D366'
                        }).then((waRes) => {
                            if (waRes.isConfirmed) {
                                window.open(waUrl, '_blank');
                            }
                        });
                    } else {
                        Swal.fire({
                            icon: 'success',
                            title: 'تم التعيين',
                            text: `تم تعيين ${repName} على ${targetIds.length} شحنة بنجاح`,
                            timer: 2500,
                            showConfirmButton: false
                        });
                    }
                    
                    toggleAssignPulse('');
                    document.getElementById('assignSubRep').value = '';
                    await fetchShipments();
                }
            }

            function toggleAllSubRepRowsGlobal() {
                const checkboxes = document.querySelectorAll('.subrep-row-checkbox');
                let allChecked = Array.from(checkboxes).every(cb => cb.checked);
                
                // If all are checked, uncheck them. Otherwise, check them all.
                checkboxes.forEach(cb => cb.checked = !allChecked);
                updateSubRepRowSelection();
            }

            async function deleteSelectedShipmentsSubRep() {
                const selectedCheckboxes = document.querySelectorAll('.subrep-row-checkbox:checked');
                if (selectedCheckboxes.length === 0) {
                    Swal.fire('تنبيه', 'يرجى تحديد الشحنات التي تريد مسحها أولاً', 'warning');
                    return;
                }

                const targetIds = Array.from(selectedCheckboxes).map(cb => cb.value);
                const targetShipmentCodes = Array.from(new Set(
                    Array.from(selectedCheckboxes)
                        .map(cb => String(cb.dataset.shipmentCode || '').trim())
                        .filter(Boolean)
                ));

                if (targetShipmentCodes.length !== targetIds.length) {
                    Swal.fire('خطأ', 'تعذر تحديد كود شحنة واحدة أو أكثر، لذلك تم إيقاف المسح لحماية البيانات.', 'error');
                    return;
                }

                // Ask for admin password
                const { value: password } = await Swal.fire({
                    title: 'تأكيد المسح الجماعي',
                    html: `هل أنت متأكد من مسح <b>(${targetIds.length})</b> شحنة نهائياً؟<br><br><span class="text-rose-600 font-bold text-sm">هذا الإجراء لا يمكن التراجع عنه.</span><br><br>يرجى إدخال كلمة مرور الحساب للتأكيد:`,
                    
                    inputPlaceholder: 'كلمة المرور',
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

                if (!password) return;

                // Validate password
                if (!(await verifyCurrentPasswordSecure(password))) {
                    Swal.fire('خطأ', 'كلمة المرور غير صحيحة، تم إلغاء المسح.', 'error');
                    return;
                }

                try {
                    Swal.fire({ title: 'جاري المسح...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    
                    // Track before deleting
                    const deletedShipmentsContext = allShipments.filter(s => targetIds.includes(String(s.id)));
                    deletedShipmentsContext.forEach(s => saveAuditLog('تم مسحها', s));

                    const { error } = await supabaseClient
                        .from(CONFIG.TABLES.SHIPMENTS)
                        .delete()
                        .in('كود الشحنة', targetShipmentCodes);

                    if (error) throw error;

                    Swal.fire('تم المسح', `تم مسح ${targetIds.length} شحنة نهائياً بنجاح`, 'success');
                    await fetchShipments();

                } catch (err) {
                    console.error("Delete Selected Error:", err);
                    Swal.fire('خطأ', 'حدث خطأ أثناء المسح: ' + err.message, 'error');
                }
            }

            async function transferToWarehouse() {
                const selectedCheckboxes = document.querySelectorAll('.subrep-row-checkbox:checked');
                if (selectedCheckboxes.length === 0) {
                    Swal.fire('تنبيه', 'يرجى تحديد الشحنات التي تريد تحويلها للمخزن أولاً عبر المربعات بجانب كل شحنة', 'warning');
                    return;
                }

                const targetIds = Array.from(selectedCheckboxes).map(cb => cb.value);

                const res = await Swal.fire({
                    title: 'تأكيد التحويل؟',
                    text: `هل أنت متأكد من تحويل (${targetIds.length}) شحنة مختارة إلى المخزن؟`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، تحويل',
                    cancelButtonText: 'إلغاء',
                    confirmButtonColor: '#334155',
                });

                if (!res.isConfirmed) return;

                try {
                    const { error } = await supabaseClient
                        .from(CONFIG.TABLES.SHIPMENTS)
                        .update(toServerShipmentPayload({ 
                            [SHIPMENT_SUBREP_FIELD_LEGACY]: 'مخزن',
                            [SHIPMENT_SUBREP_FIELD]: 'مندوب متقدم'
                        }))
                        .in('id', targetIds);

                    if (error) throw error;

                    Swal.fire({
                        icon: 'success',
                        title: 'تم التحويل للمخزن',
                        text: `تم تحويل ${targetIds.length} شحنة إلى المخزن بنجاح`,
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });

                    await fetchShipments();
                } catch (err) {
                    Swal.fire('خطأ', 'فشل في عملية التحويل: ' + err.message, 'error');
                }
            }

            async function massUpdateStatus() {
                const statusSelect = document.getElementById('massStatusSelect');
                const targetStatus = statusSelect.value;
                if (!targetStatus) {
                    Swal.fire('تنبيه', 'يرجى اختيار حالة الوجهة أولاً', 'warning');
                    return;
                }

                const selectedCheckboxes = document.querySelectorAll('.subrep-row-checkbox:checked');
                if (selectedCheckboxes.length === 0) {
                    Swal.fire('تنبيه', 'يرجى تحديد الشحنات المراد تحويلها أولاً عبر الجدول', 'warning');
                    return;
                }

                const targetIds = Array.from(selectedCheckboxes).map(cb => cb.value);

                const res = await Swal.fire({
                    title: 'تأكيد التحويل الجماعي؟',
                    html: `هل أنت متأكد من تغيير حالة <b class="text-indigo-600">(${targetIds.length})</b> شحنة إلى: <b class="text-indigo-600">${targetStatus}</b>؟`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، قم بالتحويل',
                    cancelButtonText: 'إلغاء',
                    confirmButtonColor: '#4f46e5',
                });

                if (!res.isConfirmed) return;

                try {
                    Swal.fire({ title: 'جاري التحويل...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    
                    const updateData = {
                        'الحالة': targetStatus,
                        'تاريخ التحديث': new Date().toISOString().split('T')[0],
                        'تاريخ الحالة': new Date().toISOString().split('T')[0]
                    };

                    const { error } = await supabaseClient
                        .from(CONFIG.TABLES.SHIPMENTS)
                        .update(toServerShipmentPayload(updateData))
                        .in('id', targetIds);

                    if (error) throw error;

                    Swal.fire({
                        icon: 'success',
                        title: 'تم التحويل بنجاح',
                        text: `تم تحديث حالة ${targetIds.length} شحنة بنجاح`,
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });

                    statusSelect.value = '';
                    await fetchShipments();
                } catch (err) {
                    Swal.fire('خطأ', 'فشل في عملية التحويل الجماعي: ' + err.message, 'error');
                }
            }


            
