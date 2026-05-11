const { createClient } = supabase;
        const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        const SHIPMENT_PRICE_FIELD = 'السعر بعد التعديل';
        const SHIPMENT_PRICE_FIELD_LEGACY = 'السعر_بعد_التعديل';
        const SHIPMENT_CODE_FIELD = 'كود الشحنة';
        const SHIPMENT_CODE_FIELD_LEGACY = 'order_id';

        const normalizeShipmentPriceField = RepsShipmentUtils.normalizeRecord;

        let user = RepsSession.requireUser(['rep', 'مندوب فرعي'], 'login.html');
        startStoredUserSessionGuard(supabaseClient, {
            allowedRoles: ['rep', 'مندوب فرعي'],
            onValidUser: (latestUser) => {
                user = latestUser;
                const repName = document.getElementById('repName');
                if (repName) repName.innerText = latestUser.full_name || latestUser.username || latestUser.phone;
            }
        });

        const repName = document.getElementById('repName');
        if (repName) repName.innerText = user.full_name || user.username || user.phone;

        let allShipments = [];
        const WALLET_UI_STATE_KEY = 'walletUiState';
        let dateFilterSelections = new Set();

        function getSelectedDates() {
            return Array.from(dateFilterSelections);
        }

        function toggleDateSelection(value) {
            const normalizedValue = String(value || '').trim();
            if (!normalizedValue) return;

            if (dateFilterSelections.has(normalizedValue)) dateFilterSelections.delete(normalizedValue);
            else dateFilterSelections.add(normalizedValue);
            
            saveDateFilter(getSelectedDates()[0] || '');
            saveWalletUiState();
            updateWalletStats();
        }

        function saveWalletUiState() {
            localStorage.setItem(WALLET_UI_STATE_KEY, JSON.stringify({
                date: getSelectedDates()
            }));
        }

        function saveDateFilter(date) {
            localStorage.setItem('global-selected-abydet', date);
        }

        function getSavedDateFilter() {
            return localStorage.getItem('global-selected-abydet') || '';
        }

        function restoreWalletUiState() {
            let state = null;
            try {
                const raw = localStorage.getItem(WALLET_UI_STATE_KEY);
                state = JSON.parse(raw || 'null');
            } catch (error) {}

            if (state && state.date) {
                const dates = Array.isArray(state.date) ? state.date : [state.date];
                dates.map(d => String(d || '').trim()).filter(Boolean).forEach(d => dateFilterSelections.add(d));
            } else {
                const legacyDate = getSavedDateFilter();
                const normalizedLegacyDate = String(legacyDate || '').trim();
                if (normalizedLegacyDate) dateFilterSelections.add(normalizedLegacyDate);
            }
        }

        async function fetchShipments() {
            const identifiers = [user.username, user.phone, user.full_name].filter(Boolean);
            const orQuery = identifiers.map(id => `المندوب.eq."${id}",المندوب الفرعي.eq."${id}"`).join(',');

            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.SHIPMENTS)
                .select('*')
                .or(orQuery)
                .order('id', { ascending: false });

            if (error) {
                console.error(error);
                return;
            }

            allShipments = (data || []).map(normalizeShipmentPriceField);
            populateDates();
            restoreWalletUiState();
            updateWalletStats();
        }

        function populateDates() {
            const dates = [...new Set(allShipments.map(s => getShipmentDailyValue(s)).filter(Boolean))].sort().reverse();
            
            const datesSet = new Set(dates);
            const normalizedSelectedDates = getSelectedDates().filter(date => datesSet.has(date));
            
            if (normalizedSelectedDates.length !== dateFilterSelections.size) {
                dateFilterSelections = new Set(normalizedSelectedDates);
                saveDateFilter(normalizedSelectedDates[0] || '');
                saveWalletUiState();
            }

            fillDateDropdown(dates);
        }

        function fillDateDropdown(items) {
            const menu = document.getElementById('filterDateMenu');
            const label = document.getElementById('filterDateLabel');
            if (!menu || !label) return;
            
            const selectedArr = getSelectedDates();
            const filterBtn = document.getElementById('filterDateBtn');
            
            if (selectedArr.length > 0) {
                label.innerText = selectedArr.join(' - ');
                filterBtn?.classList.add('!bg-indigo-600', '!text-white', '!border-indigo-600');
                filterBtn?.classList.remove('bg-white', 'text-slate-600', 'dark:bg-slate-800', 'dark:text-white');
            } else {
                label.innerText = 'اختر اليومية';
                filterBtn?.classList.remove('!bg-indigo-600', '!text-white', '!border-indigo-600');
                filterBtn?.classList.add('bg-white', 'text-slate-600', 'dark:bg-slate-800', 'dark:text-white');
            }

            if (!items || items.length === 0) {
                menu.innerHTML = `
                    <div class="px-2 py-3 text-center text-[11px] font-bold text-slate-500 dark:text-slate-300">
                        لا توجد يوميات متاحة
                    </div>
                `;
                return;
            }

            const dateCounts = {};
            allShipments.forEach(s => {
                const d = getShipmentDailyValue(s);
                if (d) dateCounts[d] = (dateCounts[d] || 0) + 1;
            });

            menu.innerHTML = items.map(item => {
                const isSelected = dateFilterSelections.has(item);
                const count = dateCounts[item] || 0;
                return `
                    <label class="flex items-center justify-between gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors" onclick="event.stopPropagation()">
                        <div class="flex items-center gap-2">
                            <input type="checkbox" ${isSelected ? 'checked' : ''} onchange='toggleDateSelection(${JSON.stringify(item)})' class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300">
                            <span class="text-slate-700 dark:text-slate-200 font-bold">${item}</span>
                        </div>
                        <span class="bg-indigo-50 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full font-black">${count}</span>
                    </label>
                `;
            }).join('');
        }

        let currentWalletBalance = 0;
        let pendingOrderIds = [];
        let currentSettlementDate = '';

        function isPriceEditShipment(shipment) {
            const normalizedStatus = String(shipment?.الحالة || '').trim();
            const normalizedReason = String(shipment?.['سبب الحالة'] || shipment?.سبب_الحالة || '').trim();
            return normalizedStatus === 'تعديل سعر' || normalizedReason === 'تعديل سعر';
        }

        function isShippingFeeShipment(shipment) {
            const normalizedStatus = String(shipment?.الحالة || '').trim();
            const normalizedReason = String(shipment?.['سبب الحالة'] || shipment?.سبب_الحالة || '').trim();
            return normalizedStatus === 'شحن' || normalizedReason.includes('شحن');
        }

        function isDeliveredShipment(shipment) {
            const normalizedStatus = String(shipment?.الحالة || '').trim();
            if (isPriceEditShipment(shipment)) return false;
            if (isShippingFeeShipment(shipment)) return false;
            return normalizedStatus === 'تم' || normalizedStatus === 'تم التسليم';
        }

        function isRejectedShipment(shipment) {
            const normalizedStatus = String(shipment?.الحالة || '').trim();
            return normalizedStatus === 'رفض' || normalizedStatus === 'الغاء' || normalizedStatus === 'إلغاء';
        }

        function isDelayedShipment(shipment) {
            const normalizedStatus = String(shipment?.الحالة || '').trim();
            return normalizedStatus === 'تأجيل' || normalizedStatus === 'مؤجل';
        }

        function isPendingShipment(shipment) {
            const normalizedStatus = String(shipment?.الحالة || '').trim();
            return normalizedStatus === '' || normalizedStatus === 'قيد' || normalizedStatus === 'قيد التنفيذ' || normalizedStatus === 'قيد التوصيل';
        }

        function getShippingFeeFromReason(shipment) {
            // Extract numeric shipping fee from سبب_الحالة, e.g. "شحن 50" → 50
            const reason = String(shipment?.['سبب الحالة'] || shipment?.سبب_الحالة || '').trim();
            if (!reason.includes('شحن')) return 0;
            const match = reason.match(/[\d]+(?:[.,][\d]+)?/);
            if (match) {
                const val = parseFloat(match[0].replace(',', '.'));
                return isNaN(val) ? 0 : val;
            }
            return 0;
        }

        function getShipmentCommission(shipment) {
            let commissionValue = shipment?.['عمولة المندوب'];
            if (user && user.role === 'مندوب فرعي') {
                commissionValue = shipment?.['عمولة المندوب الفرعي'] || shipment?.عمولة_المندوب_الفرعي || 0;
            }
            const value = parseFloat(commissionValue || 0);
            return Number.isNaN(value) ? 0 : value;
        }

        function getShipmentAmount(shipment) {
            const value = parseFloat(shipment?.السعر_بعد_التعديل || shipment?.المبلغ || 0);
            return Number.isNaN(value) ? 0 : value;
        }

        function getAdjustedShipmentAmount(shipment) {
            const value = parseFloat(shipment?.السعر_بعد_التعديل || 0);
            return Number.isNaN(value) ? 0 : value;
        }

        function isCommissionEligibleShipment(shipment) {
            const normalizedStatus = String(shipment?.الحالة || '').trim();
            // 'تم' = delivered, isPriceEditShipment = 'تعديل سعر', isShippingFeeShipment = 'شحن'
            return normalizedStatus === 'تم' || normalizedStatus === 'تم التسليم' || isPriceEditShipment(shipment) || isShippingFeeShipment(shipment);
        }

        async function fetchSettlements() {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.SETTLEMENTS)
                .select('order_ids')
                .eq('rep_name', user.username || user.phone);
                
            let settledIds = new Set();
            if (data) {
                 data.forEach(row => {
                     try {
                         let ids = JSON.parse(row.order_ids);
                         ids.forEach(id => settledIds.add(id));
                     } catch(e) {}
                 });
            }
            return settledIds;
        }

        async function updateWalletStats() {
            const selectedDates = getSelectedDates();
            currentSettlementDate = selectedDates.join(', ');
            if (selectedDates.length === 0) {
                pendingOrderIds = [];
                currentWalletBalance = 0;
                document.getElementById('walletTotalCount').innerText = 0;
                document.getElementById('walletDeliveredCount').innerText = 0;
                document.getElementById('walletDeliveredAmount') && (document.getElementById('walletDeliveredAmount').innerText = `0 ج.م`);
                document.getElementById('walletPriceEditedCount').innerText = 0;
                document.getElementById('walletPriceEditedAmount') && (document.getElementById('walletPriceEditedAmount').innerText = `0 ج.م`);
                document.getElementById('walletRejectedCount').innerText = 0;
                document.getElementById('walletShippingCount').innerText = 0;
                document.getElementById('walletShippingAmount').innerText = `0 ج.م`;
                document.getElementById('walletShippingFeeAmount') && (document.getElementById('walletShippingFeeAmount').innerText = `0 ج.م`);
                document.getElementById('walletInTransitCount').innerText = 0;
                document.getElementById('walletDelayedCount').innerText = 0;
                document.getElementById('walletTotalMoney').innerHTML = `0 <span class="text-xs">ج.م</span>`;
                document.getElementById('walletCommissionTotal').innerHTML = `0 <span class="text-xs text-slate-800 dark:text-white">ج.م</span>`;
                document.getElementById('requestSettlementBtn').disabled = true;
                populateDates();
                saveWalletUiState();
                return;
            }

            let filteredByDate = allShipments.filter(s => selectedDates.includes(getShipmentDailyValue(s)));

            const deliveredShipments = filteredByDate.filter(s => isDeliveredShipment(s));
            const deliveredCount = deliveredShipments.length;
            const deliveredAmount = deliveredShipments.reduce((acc, shipment) => acc + getShipmentAmount(shipment), 0);
            
            const priceEditedShipments = filteredByDate.filter(s => isPriceEditShipment(s));
            const priceEditedCount = priceEditedShipments.length;
            const priceEditedAmount = priceEditedShipments.reduce((acc, shipment) => acc + getShipmentAmount(shipment), 0);
            const rejectedCount = filteredByDate.filter(s => isRejectedShipment(s)).length;
            const shippingShipments = filteredByDate.filter(s => isShippingFeeShipment(s));
            const inTransitCount = filteredByDate.filter(s => isPendingShipment(s)).length;
            let filtered = filteredByDate.filter(s => isCommissionEligibleShipment(s));

            const settledIds = await fetchSettlements();
            const unrequested = filtered.filter(s => !settledIds.has(s.id));

            pendingOrderIds = unrequested.map(s => s.id);
            currentWalletBalance = unrequested.reduce((acc, shipment) => acc + getAdjustedShipmentAmount(shipment), 0);
            const currentCommissionTotal = filteredByDate
                .filter(isCommissionEligibleShipment)
                .reduce((acc, shipment) => acc + getShipmentCommission(shipment), 0);
            // Sum numeric shipping fee values extracted from سبب_الحالة (e.g. "شحن 50" → 50)
            const shippingFeeFromReason = shippingShipments.reduce((acc, s) => acc + getShippingFeeFromReason(s), 0);
            const shippingAmount = shippingShipments.reduce((acc, shipment) => acc + getShipmentAmount(shipment), 0);

            document.getElementById('walletTotalCount').innerText = filteredByDate.length;
            document.getElementById('walletDeliveredCount').innerText = deliveredCount;
            document.getElementById('walletDeliveredAmount') && (document.getElementById('walletDeliveredAmount').innerText = `${deliveredAmount} ج.م`);
            document.getElementById('walletPriceEditedCount').innerText = priceEditedCount;
            document.getElementById('walletPriceEditedAmount') && (document.getElementById('walletPriceEditedAmount').innerText = `${priceEditedAmount} ج.م`);
            document.getElementById('walletRejectedCount').innerText = rejectedCount;
            document.getElementById('walletDelayedCount').innerText = filteredByDate.filter(s => isDelayedShipment(s)).length;
            document.getElementById('walletShippingCount').innerText = shippingShipments.length;
            // Show shipping fee from سبب_الحالة if available, otherwise fall back to total amount
            const shippingDisplayValue = shippingFeeFromReason > 0 ? shippingFeeFromReason : shippingAmount;
            document.getElementById('walletShippingAmount').innerText = `${shippingDisplayValue} ج.م`;
            document.getElementById('walletInTransitCount').innerText = inTransitCount;
            document.getElementById('walletTotalMoney').innerHTML = `${currentWalletBalance} <span class="text-xs">ج.م</span>`;
            document.getElementById('walletCommissionTotal').innerHTML = `${currentCommissionTotal} <span class="text-xs text-slate-800 dark:text-white">ج.م</span>`;
            const requestSettlementBtn = document.getElementById('requestSettlementBtn');
            if (requestSettlementBtn) {
                requestSettlementBtn.disabled = (currentWalletBalance <= 0 || pendingOrderIds.length === 0);
            }
            populateDates();
            saveWalletUiState();
        }

        document.addEventListener('click', (event) => {
            const dateBtn = document.getElementById('filterDateBtn');
            const dateMenu = document.getElementById('filterDateMenu');
            if (dateBtn && dateMenu && !dateBtn.contains(event.target) && !dateMenu.contains(event.target)) {
                dateMenu.classList.add('hidden');
            }
        });

        function logout() {
            RepsSession.clear();
        }

        RepsTheme.apply();

        // Real-time listener
        supabaseClient
            .channel('public:elsayed')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'elsayed' }, payload => {
                fetchShipments();
            })
            .subscribe();

        supabaseClient
            .channel('public:settlements_wallet')
            .on('postgres_changes', { event: '*', schema: 'public', table: CONFIG.TABLES.SETTLEMENTS }, payload => {
                updateWalletStats();
            })
            .subscribe();

        fetchShipments();
