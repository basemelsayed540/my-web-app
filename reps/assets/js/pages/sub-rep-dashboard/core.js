const { createClient } = supabase;
            const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
            const SHIPMENT_PRICE_FIELD = 'السعر بعد التعديل';
            const SHIPMENT_PRICE_FIELD_LEGACY = 'السعر_بعد_التعديل';
            const SHIPMENT_CODE_FIELD = 'كود الشحنة';
            const SHIPMENT_CODE_FIELD_LEGACY = 'order_id';
            const SHIPMENT_COMMISSION_FIELD = 'عمولة المندوب';
            const SHIPMENT_COMMISSION_FIELD_LEGACY = 'عمولة_المندوب';
            const SHIPMENT_SUBREP_FIELD = 'نوع المندوب';
            const SHIPMENT_SUBREP_FIELD_LEGACY = 'المندوب الفرعي';

            function normalizeShipmentPriceField(record) {
                return normalizeShipmentRecordHeaders(record);
            }

            function toServerShipmentPayload(payload) {
                return buildShipmentServerPayload(payload);
            }

            let trackingSystem = null;

            function updateTrackingUI() {
                const btn = document.getElementById('trackingToggleBtn');
                const icon = document.getElementById('trackingIcon');
                if(trackingSystem && trackingSystem.isTracking) {
                    btn.classList.replace('text-slate-400', 'text-emerald-500');
                    btn.classList.replace('dark:text-slate-300', 'dark:text-emerald-500');
                    icon.classList.add('animate-pulse');
                } else {
                    btn.classList.replace('text-emerald-500', 'text-slate-400');
                    btn.classList.replace('dark:text-emerald-500', 'dark:text-slate-300');
                    icon.classList.remove('animate-pulse');
                }
            }

            function toggleTracking() {
                if(!trackingSystem) return;
                const isNowActive = trackingSystem.toggleShift();
                updateTrackingUI();
            }

            let user = JSON.parse(localStorage.getItem('user'));
            if (!user || user.role !== 'sub-rep') {
                window.location.href = 'login.html';
            }
            startStoredUserSessionGuard(supabaseClient, {
                allowedRoles: ['sub-rep'],
                onValidUser: (latestUser) => {
                    user = latestUser;
                    const subRepName = document.getElementById('subRepName');
                    if (subRepName) subRepName.innerText = latestUser.full_name || latestUser.username || latestUser.phone;
                    
                    if(!trackingSystem) {
                        trackingSystem = new RepTrackingSystem(supabaseClient, latestUser);
                        if (!trackingSystem.isTracking) {
                            trackingSystem.startTracking();
                        }
                        updateTrackingUI();
                    }
                }
            });

            document.getElementById('subRepName').innerText = user.full_name || user.username || user.phone;

            let allShipments = [];
            let currentPage = 1;
            let activeShipmentMenuId = null;
            let globalStatFilter = ''; // Added global stat filter
            const itemsPerPage = 999999;
            const FOLLOWER_UI_STATE_KEY = 'followerUiState';

            function saveFollowerUiState() {
                try {
                    localStorage.setItem(FOLLOWER_UI_STATE_KEY, JSON.stringify({
                        search: document.getElementById('searchInput')?.value || '',
                        status: document.getElementById('filterStatus')?.value || '',
                        subrep: document.getElementById('filterSubRepName')?.value || '',
                        zone: document.getElementById('filterZone')?.value || '',
                        sender: document.getElementById('filterSender')?.value || '',
                        agent: document.getElementById('filterAgent')?.value || '',
                        update: document.getElementById('filterUpdate')?.value || '',
                        rep: document.getElementById('filterRep')?.value || '',
                        currentPage
                    }));
                } catch (error) { }
            }

            function restoreFollowerUiState() {
                let state = null;
                try {
                    state = JSON.parse(localStorage.getItem(FOLLOWER_UI_STATE_KEY) || 'null');
                } catch (error) {
                    state = null;
                }

                if (!state) return;

                const searchInput = document.getElementById('searchInput');
                const filterStatus = document.getElementById('filterStatus');
                const filterSubRepName = document.getElementById('filterSubRepName');
                const filterZone = document.getElementById('filterZone');
                const filterSender = document.getElementById('filterSender');
                const filterAgent = document.getElementById('filterAgent');
                const filterUpdate = document.getElementById('filterUpdate');

                if (searchInput) searchInput.value = state.search || '';
                if (filterStatus) filterStatus.value = state.status || '';
                if (filterSubRepName) filterSubRepName.value = state.subrep || '';
                if (filterZone) filterZone.value = state.zone || '';
                if (filterSender) filterSender.value = state.sender || '';
                if (filterAgent) filterAgent.value = state.agent || '';
                if (filterUpdate) filterUpdate.value = state.update || '';
                currentPage = Number(state.currentPage) || 1;
            }

            let filterDebounceTimer;
            function debouncedFilterData() {
                clearTimeout(filterDebounceTimer);
                filterDebounceTimer = setTimeout(() => {
                    const searchInput = document.getElementById('searchInput');
                    const val = (searchInput?.value || '').trim();
                    if (val.length > 0 && val.length < 3) return; // Do not apply search yet
                    filterData();
                }, 350);
            }

            function filterData() {
                currentPage = 1;
                populateFilters();
                renderTable();
                saveFollowerUiState();
            }

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

            function renderPagination(totalPages) {
                const container = document.getElementById('paginationContainer');
                if (totalPages <= 1) {
                    container.innerHTML = '';
                    return;
                }

                let html = '';

                if (currentPage > 1) {
                    html += `<button onclick="goToPage(${currentPage - 1})" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center font-bold text-sm shadow-sm"><i class="fas fa-chevron-left text-xs"></i></button>`;
                }

                let startP = Math.max(1, currentPage - 2);
                let endP = Math.min(totalPages, currentPage + 2);

                if (startP > 1) {
                    html += `<button onclick="goToPage(1)" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center font-bold text-sm shadow-sm">1</button>`;
                    if (startP > 2) html += `<span class="px-1 py-1 text-slate-400">...</span>`;
                }

                for (let i = startP; i <= endP; i++) {
                    if (i === currentPage) {
                        html += `<button class="w-8 h-8 rounded-lg bg-indigo-600 border border-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-md pointer-events-none">${i}</button>`;
                    } else {
                        html += `<button onclick="goToPage(${i})" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center font-bold text-sm shadow-sm">${i}</button>`;
                    }
                }

                if (endP < totalPages) {
                    if (endP < totalPages - 1) html += `<span class="px-1 py-1 text-slate-400">...</span>`;
                    html += `<button onclick="goToPage(${totalPages})" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center font-bold text-sm shadow-sm">${totalPages}</button>`;
                }

                if (currentPage < totalPages) {
                    html += `<button onclick="goToPage(${currentPage + 1})" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center font-bold text-sm shadow-sm"><i class="fas fa-chevron-right text-xs"></i></button>`;
                }

                container.innerHTML = html;
            }

            function goToPage(page) {
                currentPage = page;
                renderTable();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                saveFollowerUiState();
            }

            function getShipmentById(id) {
                return allShipments.find(s => String(s.id) === String(id));
            }

            function getShipmentPhone(shipment, key) {
                return (shipment[key] || '').toString().trim();
            }

            function hasShipmentPhone(shipment, key) {
                return Boolean(getShipmentPhone(shipment, key));
            }

            function renderShipmentContactActions(shipment) {
                const primary = hasShipmentPhone(shipment, 'الهات') ? `
                <button onclick='shareWhatsApp(${JSON.stringify(shipment).replace(/'/g, "&apos;")}, "الهات")' class="bg-[#25D366] text-white p-2 rounded-lg shadow-sm hover:bg-[#1ebd5a] transition-colors focus:ring-2 focus:ring-[#25D366] focus:ring-offset-1 tooltip" title="واتساب الهاتف">
                    <i class="fab fa-whatsapp text-lg"></i>
                </button>
            ` : '';

                const secondary = hasShipmentPhone(shipment, 'هات_بديل') ? `
                <button onclick='shareWhatsApp(${JSON.stringify(shipment).replace(/'/g, "&apos;")}, "هات_بديل")' class="bg-[#25D366] text-white p-2 rounded-lg shadow-sm hover:bg-[#1ebd5a] transition-colors focus:ring-2 focus:ring-[#25D366] focus:ring-offset-1 tooltip" title="واتساب الهاتف البديل">
                    <i class="fab fa-whatsapp text-lg"></i>
                </button>
            ` : '';

                return `${primary}${secondary}`;
            }

            function formatShipmentCopyText(shipment) {
                const getValue = (value) => {
                    if (value === null || value === undefined || value === '') return '---';
                    return String(value);
                };

                return [
                    `اسم العميل: ${getValue(shipment.اسم_العميل)}`,
                    `العنوان: ${getValue(shipment.العنوان)}`,
                    `الزون: ${getValue(shipment.الزون)}`,
                    `المنتج: ${getValue(shipment.المنتج)}`,
                    `الهاتف: ${getValue(shipment.الهات)}`,
                    `هاتف بديل: ${getValue(shipment.هات_بديل)}`,
                    `المبلغ: ${getValue(shipment.المبلغ)}`,
                    `الكود: ${getValue(shipment.الكود)}`,
                    `الراسل: ${getValue(shipment.الراسل)}`,
                    `المندوب: ${getValue(shipment.المندوب)}`
                ].join('\n');
            }

            function closeShipmentMenu() {
                const menu = document.getElementById('shipmentMenu');
                menu.classList.add('hidden');
                activeShipmentMenuId = null;
            }

            function toggleShipmentMenu(event, shipmentId) {
                event.stopPropagation();
                const menu = document.getElementById('shipmentMenu');
                const isOpenForSameShipment = activeShipmentMenuId === shipmentId && !menu.classList.contains('hidden');

                if (isOpenForSameShipment) {
                    closeShipmentMenu();
                    return;
                }

                activeShipmentMenuId = shipmentId;
                menu.classList.remove('hidden');

                const menuWidth = 220;
                const menuHeight = 64;
                const left = Math.max(12, Math.min(event.clientX - menuWidth + 20, window.innerWidth - menuWidth - 12));
                const top = Math.max(12, Math.min(event.clientY + 12, window.innerHeight - menuHeight - 12));

                menu.style.left = `${left}px`;
                menu.style.top = `${top}px`;
            }

            async function copyShipmentData(id) {
                const shipment = getShipmentById(id);
                if (!shipment) return;

                try {
                    await navigator.clipboard.writeText(formatShipmentCopyText(shipment));
                    closeShipmentMenu();
                    Swal.fire({
                        icon: 'success',
                        title: 'تم نسخ بيانات الشحنة',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 1800
                    });
                } catch (error) {
                    closeShipmentMenu();
                    Swal.fire('خطأ', 'فشل نسخ بيانات الشحنة', 'error');
                }
            }

            function copyShipmentDataFromMenu() {
                if (!activeShipmentMenuId) return;
                copyShipmentData(activeShipmentMenuId);
            }

            async function shareWhatsApp(shipment, phoneKey = 'الهات') {
                // Template: اسم العميل، العنوان، الزون، المنتج، الهاتف، هاتف بديل، المبلغ، المكتب، الكود، والمندوب
                const info = [
                    `📦 *بيانات الشحنة:* #${shipment.order_id || '---'}`,
                    `👤 *العميل:* ${shipment.اسم_العميل || '---'}`,
                    ` *العنوان:* ${shipment.العنوان || '---'}`,
                    `🗺 *الزون:* ${shipment.الزون || '---'}`,
                    ` *المنتج:* ${shipment.المنتج || '---'}`,
                    `💰 *المبلغ المطلوب:* ${shipment.المبلغ ? shipment.المبلغ + ' ج.م' : '---'}`,
                    `📱 *الهاتف:* ${shipment.الهات || '---'}`,
                    `📱 *هاتف بديل:* ${shipment.هات_بديل || '---'}`,
                    ` *المكتب (الراسل):* ${shipment.الراسل || '---'}`,
                    `🚚 *المندوب:* ${shipment.المندوب || 'غير محدد'}`
                ].join('\n');

                try {
                    await navigator.clipboard.writeText(info);

                    // Construct WA link (prefer primary phone, format number if needed)
                    let tel = getShipmentPhone(shipment, phoneKey);
                    // Simple format to add +20 if it's an Egyptian 010/011/etc
                    if (tel.startsWith('01') && tel.length === 11) {
                        tel = '+20' + tel.substring(1);
                    } else {
                        tel = tel.replace(/\\D/g, '');
                    }

                    const waUrl = tel ?
                        `https://wa.me/${tel}?text=${encodeURIComponent(info)}` :
                        `https://wa.me/?text=${encodeURIComponent(info)}`; // fallback to contact picker

                    window.open(waUrl, '_blank');
                } catch (err) {
                    console.error('Failed to copy: ', err);
                    Swal.fire('خطأ', 'فشل في نسخ بيانات الشحنة', 'error');
                }
            }

            async function logout() {
                try {
                    if(trackingSystem && trackingSystem.isTracking) {
                        await trackingSystem.stopTracking();
                    }
                } catch(e) {
                    console.error('Logout tracking error', e);
                }
                clearStoredUserSession();
            }

            function toggleTheme() {
                const isDark = document.body.classList.toggle('dark');
                const icon = document.getElementById('themeIcon');
                if (icon) icon.className = isDark ? 'fas fa-sun text-xl' : 'fas fa-moon text-xl';
                localStorage.setItem('rep-theme', isDark ? 'dark' : 'light');
            }

            document.addEventListener('click', (event) => {
                const menu = document.getElementById('shipmentMenu');
                if (!menu.contains(event.target)) {
                    closeShipmentMenu();
                }
            });
            window.addEventListener('resize', closeShipmentMenu);
            window.addEventListener('scroll', closeShipmentMenu);

            if (localStorage.getItem('rep-theme') === 'dark') {
                document.body.classList.add('dark');
                const icon = document.getElementById('themeIcon');
                if (icon) icon.className = 'fas fa-sun text-xl';
            }

            // Real-time updates
            supabaseClient
                .channel('follower_shipments')
                .on('postgres_changes', { event: '*', schema: 'public', table: CONFIG.TABLES.SHIPMENTS }, async (payload) => {
                    await fetchShipments();
                    renderTable();
                    console.log('تم مزامنة الجدول الرعي');
                })
                .subscribe();

            