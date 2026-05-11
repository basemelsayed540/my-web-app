function logout() {
            clearStoredUserSession();
        }

        function toggleTheme() {
            const body = document.body;
            const icon = el('themeIcon');
            const isDark = body.classList.toggle('dark');

            icon.className = isDark ? 'fas fa-sun text-xl' : 'fas fa-moon text-xl';
            localStorage.setItem('rep-theme', isDark ? 'dark' : 'light');
        }

        // Apply theme on load
        if (localStorage.getItem('rep-theme') === 'dark') {
            document.body.classList.add('dark');
            el('themeIcon').className = 'fas fa-sun text-xl';
        }

        // Real-time listener
        const channel = supabaseClient
            .channel('public:elsayed')
            .on('postgres_changes', { event: '*', schema: 'public', table: CONFIG.TABLES.SHIPMENTS }, async (payload) => {
                const event = payload.eventType;
                const newRow = payload.new;
                const oldRow = payload.old;
                const repIdentifiers = new Set(getRepIdentifiers().map(normalizeComparableValue));

                if (event === 'INSERT') {
                    if (shipmentBelongsToRep(newRow, repIdentifiers)) {
                        addRepNotification('added', newRow);
                    }
                } else if (event === 'UPDATE') {
                    const localOld = lastServerShipmentsMap.get(String(newRow.id)) || allShipments.find(s => String(s.id) === String(newRow.id));
                    const wasMine = localOld && shipmentBelongsToRep(localOld, repIdentifiers);
                    const currentRepInRows = newRow.hasOwnProperty('المندوب') ? newRow.المندوب : (localOld ? localOld.المندوب : null);
                    const isMine = shipmentBelongsToRep({ ...localOld, ...newRow, المندوب: currentRepInRows }, repIdentifiers);

                    const merged = { ...localOld, ...newRow };
                    if (!wasMine && isMine) addRepNotification('added', merged);
                    else if (wasMine && !isMine) addRepNotification('removed', merged);
                    else if (wasMine && isMine && localOld) {
                        const hasChanges = Object.keys(newRow).some(k => {
                            if (['t_updated', 'تاريخ التحديث', 'updated_at'].includes(k)) return false;
                            return String(newRow[k] || '').trim() !== String(localOld[k] || '').trim();
                        });
                        if (hasChanges) {
                            if (newRow.hasOwnProperty('الحالة') && localOld.الحالة !== newRow.الحالة) {
                                addRepNotification('status_changed', merged);
                                showShipmentUpdateNotification('status_changed', merged);
                            } else {
                                addRepNotification('updated', merged);
                                showShipmentUpdateNotification('updated', merged);
                            }
                        }
                    }
                    
                } else if (event === 'DELETE') {
                    const localDeleted = lastServerShipmentsMap.get(String(oldRow.id)) || allShipments.find(s => String(s.id) === String(oldRow.id));
                    if (localDeleted && shipmentBelongsToRep(localDeleted, repIdentifiers)) {
                        addRepNotification('deleted', localDeleted);
                    }
                }

                const shouldGlowDateFilter =
                    event === 'INSERT' ||
                    event === 'DELETE' ||
                    (event === 'UPDATE' && String(oldRow?.الحالة || '').trim() !== String(newRow?.الحالة || '').trim());
                if (shouldGlowDateFilter) triggerDateFilterGlow();
                await fetchShipments({ skipChangeNotifications: true });
                console.log('تحديث جديد للشحنات');
            })
            .subscribe();

        supabaseClient
            .channel('public:settlements_rep_lock')
            .on('postgres_changes', { event: '*', schema: 'public', table: CONFIG.TABLES.SETTLEMENTS }, payload => {
                triggerDateFilterGlow();
                fetchShipments({ skipChangeNotifications: true });
            })
            .subscribe();

        function startShipmentsPolling() {
            if (shipmentsPollTimer) clearInterval(shipmentsPollTimer);
            shipmentsPollTimer = setInterval(() => {
                fetchShipments();
            }, 20000);
        }


        function toggleShipmentSelection(id) {
            if (document.getElementById('bulkUpdateBtn')?.dataset.loading === 'true') return;
            const shipment = allShipments.find(s => String(s.id) === String(id));
            if (!isShipmentBulkEditable(shipment)) return;
            const strId = String(id);
            if (selectedShipmentIdsForBulk.has(strId)) {
                selectedShipmentIdsForBulk.delete(strId);
            } else {
                selectedShipmentIdsForBulk.add(strId);
            }
            updateBulkActionBar();
        }

        function toggleSelectAll(checkbox) {
            if (document.getElementById('bulkUpdateBtn')?.dataset.loading === 'true') return;
            const isChecked = checkbox.checked;
            const currentlyRenderedCheckboxes = document.querySelectorAll('.bulk-item-checkbox:not(:disabled)');
            
            currentlyRenderedCheckboxes.forEach(cb => {
                const id = cb.getAttribute('data-id');
                if(id) {
                    cb.checked = isChecked;
                    if (isChecked) {
                        selectedShipmentIdsForBulk.add(String(id));
                    } else {
                        selectedShipmentIdsForBulk.delete(String(id));
                    }
                }
            });
            updateBulkActionBar();
        }

        function updateBulkActionBar() {
            if (typeof updateBulkActionBar.debouncer !== 'undefined') {
                clearTimeout(updateBulkActionBar.debouncer);
            }
            updateBulkActionBar.debouncer = setTimeout(() => {
                const countBadge = document.getElementById('selectedCountBadge');
                const inlineSummary = document.getElementById('selectedInlineSummary');
                if (countBadge) {
                    countBadge.innerText = selectedShipmentIdsForBulk.size;
                }
                if (inlineSummary) {
                    inlineSummary.classList.toggle('hidden', selectedShipmentIdsForBulk.size === 0);
                    inlineSummary.classList.toggle('flex', selectedShipmentIdsForBulk.size > 0);
                }
                
                const currentlyRenderedCheckboxes = document.querySelectorAll('.bulk-item-checkbox:not(:disabled)');
                const selectAllCb = document.getElementById('selectAllCheckbox');
                const bulkStatusSelect = document.getElementById('bulkStatusSelect');
                const bulkUpdateBtn = document.getElementById('bulkUpdateBtn');
                if (selectAllCb && currentlyRenderedCheckboxes.length > 0) {
                    const allChecked = Array.from(currentlyRenderedCheckboxes).every(cb => cb.checked);
                    const anyChecked = Array.from(currentlyRenderedCheckboxes).some(cb => cb.checked);
                    selectAllCb.checked = allChecked;
                    selectAllCb.indeterminate = anyChecked && !allChecked;
                } else if (selectAllCb) {
                    selectAllCb.checked = false;
                    selectAllCb.indeterminate = false;
                }

                if (bulkUpdateBtn) {
                    bulkUpdateBtn.disabled = selectedShipmentIdsForBulk.size === 0 || !bulkStatusSelect?.value || bulkUpdateBtn.dataset.loading === 'true';
                }
            }, 10);
        }

        function getBulkEditableSelectedShipments() {
            return Array.from(selectedShipmentIdsForBulk)
                .map(id => allShipments.find(s => String(s.id) === String(id)))
                .filter(Boolean)
                .filter(isShipmentBulkEditable);
        }

        function setBulkUpdateLoadingState(isLoading) {
            const bulkUpdateBtn = document.getElementById('bulkUpdateBtn');
            const bulkStatusSelect = document.getElementById('bulkStatusSelect');
            const selectAllCb = document.getElementById('selectAllCheckbox');

            if (bulkUpdateBtn) {
                bulkUpdateBtn.dataset.loading = isLoading ? 'true' : 'false';
                bulkUpdateBtn.disabled = isLoading || selectedShipmentIdsForBulk.size === 0 || !bulkStatusSelect?.value;
                bulkUpdateBtn.textContent = isLoading ? 'جاري التحديث...' : 'تحديث جماعي';
            }
            if (bulkStatusSelect) bulkStatusSelect.disabled = isLoading;
            if (selectAllCb) selectAllCb.disabled = isLoading;

            document.querySelectorAll('.bulk-item-checkbox').forEach(cb => {
                if (isLoading) {
                    cb.dataset.prevDisabled = cb.disabled ? 'true' : 'false';
                    cb.disabled = true;
                } else {
                    cb.disabled = cb.dataset.prevDisabled === 'true';
                    delete cb.dataset.prevDisabled;
                }
            });
        }

        function resetBulkSelectionUi() {
            selectedShipmentIdsForBulk.clear();
            const bulkStatusSelect = document.getElementById('bulkStatusSelect');
            const selectAllCb = document.getElementById('selectAllCheckbox');
            if (bulkStatusSelect) bulkStatusSelect.value = '';
            if (selectAllCb) {
                selectAllCb.checked = false;
                selectAllCb.indeterminate = false;
            }
            updateBulkActionBar();
        }

        async function applyBulkUpdate() {
            pruneBulkSelection();
            if (selectedShipmentIdsForBulk.size === 0) {
                Swal.fire('تنبيه', 'يرجى تحديد شحنة واحدة على الأقل', 'warning');
                return;
            }

            const status = document.getElementById('bulkStatusSelect').value;
            if (!status) {
                Swal.fire('تنبيه', 'يرجى اختيار الحالة', 'warning');
                return;
            }

            let reason = '';
            if (status === 'رفض') {
                reason = await promptRejectReason('تأكيد');
                if (!reason) return;
            }

            let confirmText = `هل أنت متأكد من تحديث حالة (${selectedShipmentIdsForBulk.size}) شحنة إلى "${status === 'تم' ? 'تم التسليم' : status}"؟`;
            
            const confirmed = await Swal.fire({
                title: 'تأكيد التحديث الجماعي',
                text: confirmText,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'نعم، قم بالتحديث',
                cancelButtonText: 'إلغاء',
                confirmButtonColor: '#4f46e5'
            });

            if (!confirmed.isConfirmed) return;

            const totalSelectedCount = selectedShipmentIdsForBulk.size;
            const editableShipments = getBulkEditableSelectedShipments();
            const skippedCount = totalSelectedCount - editableShipments.length;

            if (editableShipments.length === 0) {
                Swal.fire('تنبيه', 'لا توجد شحنات قابلة للتحديث ضمن التحديد الحالي', 'warning');
                resetBulkSelectionUi();
                return;
            }

            setBulkUpdateLoadingState(true);

            try {
                Swal.fire({
                    title: 'جاري التحديث...',
                    text: `يتم الآن تحديث ${editableShipments.length} شحنة`,
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                let successCount = 0;
                let failedCount = 0;
                const updates = [];
                
                for (const s of editableShipments) {
                    const id = s.id;
                    const normalizedStatus = status;
                    const updatePayload = { الحالة: normalizedStatus };
                    
                    if (status === 'رفض' || status === 'الغاء') {
                        updatePayload.الحالة = 'الغاء';
                        updatePayload['سبب الحالة'] = reason;
                    } else if (status === 'مؤجل') {
                        updatePayload['سبب الحالة'] = 'مؤجل';
                    } else if (status === 'تم') {
                        updatePayload.السعر_بعد_التعديل = Number(getShipmentAmount(s)) || 0;
                    }

                    updates.push(supabaseClient
                        .from(CONFIG.TABLES.SHIPMENTS)
                        .update(toServerShipmentPayload(updatePayload))
                        .eq('id', Number(id) || id)
                        .then(({error}) => {
                            if (!error) {
                                s.الحالة = updatePayload.الحالة;
                                if (updatePayload['سبب الحالة']) s['سبب الحالة'] = updatePayload['سبب الحالة'];
                                if (updatePayload.السعر_بعد_التعديل !== undefined) s.السعر_بعد_التعديل = updatePayload.السعر_بعد_التعديل;
                                if (normalizedStatus === 'تم' || normalizedStatus === 'شحن') lockShipmentForFurtherUpdates(s.id);
                                successCount++;
                            } else {
                                failedCount++;
                            }
                        })
                        .catch(() => {
                            failedCount++;
                        }));
                }

                await Promise.allSettled(updates);
                resetBulkSelectionUi();
                await fetchShipments();
                Swal.close();

                const summaryParts = [];
                if (successCount > 0) summaryParts.push(`تم تحديث ${successCount} شحنة`);
                if (skippedCount > 0) summaryParts.push(`تم استبعاد ${skippedCount} شحنة غير قابلة للتعديل`);
                if (failedCount > 0) summaryParts.push(`فشل تحديث ${failedCount} شحنة`);

                const hasFailures = failedCount > 0;
                Swal.fire({
                    icon: hasFailures ? 'warning' : 'success',
                    title: hasFailures ? 'تم التحديث جزئيًا' : 'تم التحديث بنجاح',
                    text: summaryParts.join(' | '),
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 4000
                });
            } finally {
                setBulkUpdateLoadingState(false);
            }
        }

        // Map Variables
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

        