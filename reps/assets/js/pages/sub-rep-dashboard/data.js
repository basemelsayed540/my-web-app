async function fetchShipments() {
                // 1. Fetch managed sub-delegates first
                await fetchSubRepAccounts();

                // 2. Build list of names (Self + Delegates + Warehouse) to see the full pool
                const myManagedNames = [
                    user.username, 
                    user.full_name, 
                    ...subRepAccounts.map(u => u.username), 
                    ...subRepAccounts.map(u => u.full_name), 
                    ...subRepAccounts.map(u => u.phone), 
                    user.phone, 
                    `PRIVATE:${user.username}` // Include hidden uploads
                ].filter(Boolean);
                const uniqueManagedNames = [...new Set(myManagedNames)].filter(name => {
                    const u = subRepAccounts.find(x => (x.username === name || x.full_name === name || x.phone === name));
                    if (!u) return true; // It's likely the current user themselves
                    return u.role === 'sub-rep'; // Only keep if they are an Advanced Rep
                });

                const { data, error } = await supabaseClient
                    .from(CONFIG.TABLES.SHIPMENTS)
                    .select('*')
                    .in('المندوب', uniqueManagedNames)
                    .order('كود الشحنة', { ascending: false });

                if (error) {
                    console.error(error);
                    Swal.fire('خطأ', 'فشل في تحميل البيانات', 'error');
                    return;
                }

                allShipments = (data || []).map(normalizeShipmentPriceField); // Test match successful
                restoreFollowerUiState();
                populateSubRepAssignTools();
                populateFilters();
                renderTable();
            }

            let subRepAccounts = [];
            async function fetchSubRepAccounts() { // Filtered by Parent ID
                try {
                    const result = await invokeUsersAdminAction('subrep_list_users', {}, user);
                    subRepAccounts = result?.users || [];
                } catch (error) {
                    console.warn("ملاحظة: تعذر جلب حسابات التابعين.", error);
                }
            }

            function populateFilters() {
                const currentZone = document.getElementById('filterZone').value;
                const currentSender = document.getElementById('filterSender').value;
                const currentAgent = document.getElementById('filterAgent')?.value || '';
                const currentUpdate = document.getElementById('filterUpdate').value;
                const currentStatus = document.getElementById('filterStatus')?.value || '';
                const currentSubRep = document.getElementById('filterSubRepName')?.value || '';
                const currentRep = document.getElementById('filterRep')?.value || '';

                const commonCondition = s => (!currentStatus || getShipmentDisplayStatus(s) === currentStatus) && 
                                             (!currentSubRep || (String(s['المندوب الفرعي'] || '').trim() || 'بدون مندوب') === currentSubRep) &&
                                             (!currentRep || String(s.المندوب || '').trim() === currentRep) &&
                                             (!currentAgent || String(s['اسم الموظ'] || '').trim() === currentAgent);

                const zonesData = allShipments.filter(s => (!currentSender || s.الراسل === currentSender) && (!currentUpdate || getShipmentDailyValue(s) === currentUpdate) && commonCondition(s));
                const zones = [...new Set(zonesData.map(s => s.الزون).filter(Boolean))].sort();

                const sendersData = allShipments.filter(s => (!currentZone || s.الزون === currentZone) && (!currentUpdate || getShipmentDailyValue(s) === currentUpdate) && commonCondition(s));
                const senders = [...new Set(sendersData.map(s => s.الراسل).filter(Boolean))].sort();

                const agentsData = allShipments.filter(s => (!currentZone || s.الزون === currentZone) && (!currentSender || s.الراسل === currentSender) && (!currentUpdate || getShipmentDailyValue(s) === currentUpdate) &&
                                                            (!currentStatus || getShipmentDisplayStatus(s) === currentStatus) &&
                                                            (!currentSubRep || (String(s['المندوب الفرعي'] || '').trim() || 'بدون مندوب') === currentSubRep) &&
                                                            (!currentRep || String(s.المندوب || '').trim() === currentRep));
                const agents = [...new Set(agentsData.map(s => String(s['اسم الموظ'] || '').trim()).filter(Boolean))].sort();

                const updatesData = allShipments.filter(s => (!currentZone || s.الزون === currentZone) && (!currentSender || s.الراسل === currentSender) && (!currentAgent || String(s['اسم الموظ'] || '').trim() === currentAgent) && commonCondition(s));
                const updates = [...new Set(updatesData.map(s => getShipmentDailyValue(s)).filter(Boolean))].sort().reverse();

                const statusesData = allShipments.filter(s => (!currentZone || s.الزون === currentZone) && (!currentSender || s.الراسل === currentSender) && (!currentAgent || String(s['اسم الموظ'] || '').trim() === currentAgent) && (!currentUpdate || getShipmentDailyValue(s) === currentUpdate) && 
                                                            (!currentSubRep || (String(s['المندوب الفرعي'] || '').trim() || 'بدون مندوب') === currentSubRep) &&
                                                            (!currentRep || String(s.المندوب || '').trim() === currentRep));
                const statuses = [...new Set(statusesData.map(s => getShipmentDisplayStatus(s)).filter(Boolean))].sort();

                const subrepsData = allShipments.filter(s => (!currentZone || s.الزون === currentZone) && (!currentSender || s.الراسل === currentSender) && (!currentAgent || String(s['اسم الموظ'] || '').trim() === currentAgent) && (!currentUpdate || getShipmentDailyValue(s) === currentUpdate) && 
                                                            (!currentStatus || getShipmentDisplayStatus(s) === currentStatus) &&
                                                            (!currentRep || String(s.المندوب || '').trim() === currentRep));
                const subreps = [...new Set(subrepsData.map(s => String(s['المندوب الفرعي'] || '').trim() || 'بدون مندوب'))].sort();

                const repsData = allShipments.filter(s => (!currentZone || s.الزون === currentZone) && (!currentSender || s.الراسل === currentSender) && (!currentAgent || String(s['اسم الموظ'] || '').trim() === currentAgent) && (!currentUpdate || getShipmentDailyValue(s) === currentUpdate) && 
                                                            (!currentStatus || getShipmentDisplayStatus(s) === currentStatus) &&
                                                            (!currentSubRep || (String(s['المندوب الفرعي'] || '').trim() || 'بدون مندوب') === currentSubRep));
                const reps = [...new Set(repsData.map(s => String(s.المندوب || '').trim()).filter(Boolean))].sort();

                fillSelect('filterStatus', statuses);
                fillSelect('filterZone', zones);
                fillSelect('filterSender', senders);
                fillSelect('filterAgent', agents);

                const filterSubRepSelect = document.getElementById('filterSubRepName');
                if (filterSubRepSelect) {
                    filterSubRepSelect.innerHTML = '<option value="">كافة المناديب</option>';
                    subreps.forEach(val => {
                        filterSubRepSelect.innerHTML += `<option value="${val}">${val}</option>`;
                    });
                    if (subreps.includes(currentSubRep)) {
                        filterSubRepSelect.value = currentSubRep;
                    }
                }

                fillSelect('filterRep', reps);

                const updateSelect = document.getElementById('filterUpdate');
                updateSelect.innerHTML = '<option value="" class="text-slate-800 bg-white">كل اليوميات</option>';
                updates.forEach(val => {
                    updateSelect.innerHTML += `<option value="${val}" class="text-slate-800 bg-white">${val}</option>`;
                });
                updateSelect.value = currentUpdate;
            }

            function fillSelect(id, values) {
                const select = document.getElementById(id);
                const current = select.value;
                select.innerHTML = select.options[0].outerHTML; // Keep first default option
                values.forEach(val => {
                    select.innerHTML += `<option value="${val}">${val}</option>`;
                });
                if (id === 'filterUpdate') {
                    const savedDate = getSavedDateFilter();
                    select.value = current || (savedDate && values.includes(savedDate) ? savedDate : '');
                } else {
                    select.value = current;
                }
            }

            function isPriceEditShipment(shipment) {
                const normalizedStatus = String(shipment?.الحالة || '').trim();
                const normalizedReason = String(shipment?.['سبب الحالة'] || shipment?.سبب_الحالة || '').trim();
                return normalizedStatus === 'تعديل سعر' || normalizedReason === 'تعديل سعر' || normalizedReason === 'شحن';
            }

            function isPendingStatus(status) {
                const normalizedStatus = String(status || '').trim();
                return normalizedStatus === '' || normalizedStatus === 'قيد' || normalizedStatus === 'قيد التنيذ' || normalizedStatus === 'قيد التوصيل';
            }

            function isRejectedStatus(status) {
                const normalizedStatus = String(status || '').trim();
                return normalizedStatus === 'رض' || normalizedStatus === 'رفض' || normalizedStatus === 'مروض' || normalizedStatus === 'الغاء' || normalizedStatus === 'إلغاء';
            }

            function getShipmentDisplayStatus(shipment) {
                const normalizedStatus = String(shipment?.الحالة || '').trim();
                if (isPriceEditShipment(shipment)) return 'تعديل سعر';
                if (isPendingStatus(normalizedStatus)) return 'قيد التوصيل';
                if (normalizedStatus === 'تأجيل' || normalizedStatus === 'مؤجل') return 'مؤجل';
                if (isRejectedStatus(normalizedStatus)) return 'رفض';
                if (normalizedStatus === 'تم' || normalizedStatus === 'تم التسليم') return 'تم التوصيل';
                return normalizedStatus || 'قيد التوصيل';
            }

            function getShipmentDisplayReason(shipment) {
                if (isPriceEditShipment(shipment)) return 'تعديل سعر';
                return shipment['سبب الحالة'] || shipment.سبب_الحالة || '';
            }



            document.getElementById('filterUpdate').addEventListener('change', (event) => {
                saveDateFilter(event.target.value);
            });

            
