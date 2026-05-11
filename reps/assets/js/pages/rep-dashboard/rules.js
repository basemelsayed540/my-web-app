function populateDropdowns() {
            const currentZone = getElementValue('filterZone');
            const currentSender = getElementValue('filterSender');

            const selectedStatuses = getSelectedStatuses();

            const checkStatus = (s) => {
                if (selectedStatuses.length === 0) return true;
                if (selectedStatuses.includes('قيد التوصيل') && isPendingStatus(s.الحالة)) return true;
                if (selectedStatuses.includes('تم') && isDeliveredStatus(s.الحالة, s)) return true;
                if (selectedStatuses.includes('تعديل سعر') && isPriceEditShipment(s)) return true;
                if (selectedStatuses.includes('مؤجل') && isDelayedStatus(s.الحالة)) return true;
                if (selectedStatuses.includes('رفض') && isRejectedStatus(s.الحالة)) return true;
                if (selectedStatuses.includes('شحن') && isShippingFeeShipment(s)) return true;
                return false;
            };

            const dates = [...new Set(allShipments
                .filter(s => 
                    (!currentZone || currentZone === 'الكل' || s.الزون === currentZone) &&
                    (!currentSender || currentSender === 'الكل' || s.الراسل === currentSender) &&
                    checkStatus(s)
                )
                .map(s => getShipmentDailyFilterValue(s))
                .filter(Boolean))].sort().reverse();
            const datesSet = new Set(dates);
            const normalizedSelectedDates = getSelectedDates().filter(date => datesSet.has(date));
            if (normalizedSelectedDates.length !== dateFilterSelections.size) {
                dateFilterSelections = new Set(normalizedSelectedDates);
                saveDateFilter(normalizedSelectedDates[0] || '');
                saveRepUiState();
            }
            const selectedDates = getSelectedDates();

            const zones = [...new Set(allShipments
                .filter(s => 
                    (selectedDates.length === 0 || selectedDates.includes(getShipmentDailyFilterValue(s))) && 
                    (!currentSender || currentSender === 'الكل' || s.الراسل === currentSender) &&
                    checkStatus(s)
                )
                .map(s => s.الزون)
                .filter(Boolean))].sort();

            const senders = [...new Set(allShipments
                .filter(s => 
                    (selectedDates.length === 0 || selectedDates.includes(getShipmentDailyFilterValue(s))) && 
                    (!currentZone || currentZone === 'الكل' || s.الزون === currentZone) &&
                    checkStatus(s)
                )
                .map(s => s.الراسل)
                .filter(Boolean))].sort();

            fillDateDropdown(dates);
            fillStatusDropdown();
            fillZoneDropdown(zones);
            fillSenderDropdown(senders);
        }

        function fillStatusDropdown() {
            const select = el('filterStatus');
            if (!select) return;
            
            const selectedDates = getSelectedDates();
            const currentZone = getElementValue('filterZone');
            const currentSender = getElementValue('filterSender');

            const scopedShipments = allShipments.filter(s => {
                const matchDate = selectedDates.length === 0 || selectedDates.includes(getShipmentDailyFilterValue(s));
                const matchZone = !currentZone || currentZone === 'الكل' || s.الزون === currentZone;
                const matchSender = !currentSender || currentSender === 'الكل' || s.الراسل === currentSender;
                return matchDate && matchZone && matchSender;
            });
            
            const counts = countShipmentsByStatus(scopedShipments);

            let optionsHtml = `<option value="">اختر الحالة...</option><option value="${FAVORITES_FILTER_VALUE}">عرض المفضلة (${favoriteShipmentIds.size})</option>`;
            STATUS_OPTIONS.forEach(opt => {
                const count = counts[opt] || 0;
                optionsHtml += `<option value="${opt}" class="text-slate-800 bg-white">${opt} (${count})</option>`;
            });

            select.innerHTML = optionsHtml;
            const selectedStatuses = getSelectedStatuses().filter(status => STATUS_OPTIONS.includes(status));
            if (isFavoritesFilterSelected()) {
                select.value = FAVORITES_FILTER_VALUE;
                select.classList.remove('bg-sky-800', 'text-white', 'border-sky-800', 'shadow-cyan-500/30');
                select.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-200');
            } else if (selectedStatuses.length > 0) {
                applyActiveSelectState(select, selectedStatuses, '');
            } else {
                select.value = '';
                select.classList.remove('bg-sky-800', 'text-white', 'border-sky-800', 'shadow-cyan-500/30');
                select.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-200');
            }
        }

        function fillDateDropdown(items) {
            const select = el('filterDateSelect');
            if (!select) return;

            const selectedValue = getSelectedDates()[0] || '';
            const narrowedData = filterShipmentsCollection(allShipments, {
                zones: getSingleSelectFilter('filterZone'),
                senders: getSingleSelectFilter('filterSender'),
                statuses: getSelectedStatuses()
            });

            const dateCounts = {};
            narrowedData.forEach(s => {
                const d = getShipmentDailyFilterValue(s);
                if (d) dateCounts[d] = (dateCounts[d] || 0) + 1;
            });

            let optionsHtml = '<option value="">اليومية</option>';
            if (!items || items.length === 0) {
                optionsHtml += '<option value="" disabled>لا يوجد يومية متاحة</option>';
            } else {
                items.forEach(item => {
                    const count = dateCounts[item] || 0;
                    optionsHtml += `<option value="${item.replace(/"/g, '&quot;')}" class="text-slate-800 bg-white">${item} (${count})</option>`;
                });
            }

            select.innerHTML = optionsHtml;
            applyActiveSelectState(select, selectedValue ? [selectedValue] : [], '');
        }

        function fillZoneDropdown(items) {
            const select = el('filterZone');
            if (!select) return;

            const selectedArr = getSelectedZones();
            
            const narrowedData = filterShipmentsCollection(allShipments, {
                dates: getSelectedDates(),
                senders: getSingleSelectFilter('filterSender'),
                statuses: getSelectedStatuses()
            });
            const zoneCounts = {};
            narrowedData.forEach(s => {
                const z = s.الزون;
                if (z) zoneCounts[z] = (zoneCounts[z] || 0) + 1;
            });

            let optionsHtml = `<option value="الكل" class="text-slate-800 bg-white">الزون: الكل</option>`;
            if (items && items.length > 0) {
                items.forEach(item => {
                    const count = zoneCounts[item] || 0;
                    optionsHtml += `<option value="${item}" class="text-slate-800 bg-white">${item} (${count})</option>`;
                });
            }

            select.innerHTML = optionsHtml;
            applyActiveSelectState(select, selectedArr);
        }

        function fillSenderDropdown(items) {
            const select = el('filterSender');
            if (!select) return;

            const selectedArr = getSelectedSenders();
            
            const narrowedData = filterShipmentsCollection(allShipments, {
                dates: getSelectedDates(),
                zones: getSingleSelectFilter('filterZone'),
                statuses: getSelectedStatuses()
            });
            const senderCounts = {};
            narrowedData.forEach(s => {
                const sn = s.الراسل;
                if (sn) senderCounts[sn] = (senderCounts[sn] || 0) + 1;
            });

            let optionsHtml = '<option value="الكل" class="text-slate-800 bg-white">الراسل: الكل</option>';
            if (items && items.length > 0) {
                items.forEach(item => {
                    const count = senderCounts[item] || 0;
                    optionsHtml += `<option value="${item}" class="text-slate-800 bg-white">${item} (${count})</option>`;
                });
            }

            select.innerHTML = optionsHtml;
            applyActiveSelectState(select, selectedArr);
        }

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

        function isDeliveredStatus(status, shipment = null) {
            const normalizedStatus = String(status || '').trim();
            if (shipment && isPriceEditShipment(shipment)) return false;
            if (shipment && isShippingFeeShipment(shipment)) return false;
            return normalizedStatus === 'تم' || normalizedStatus === 'تم التسليم';
        }

        function isPendingStatus(status) {
            const normalizedStatus = String(status || '').replace(/\s+/g, ' ').trim();
            return normalizedStatus === '' || normalizedStatus === 'قيد' || normalizedStatus === 'قيد التوصيل' || normalizedStatus === 'قيد التنفيذ';
        }

        function isDelayedStatus(status) {
            const normalizedStatus = String(status || '').trim();
            return normalizedStatus === 'مؤجل' || normalizedStatus === 'مؤجل';
        }

        function isRejectedStatus(status) {
            const normalizedStatus = String(status || '').trim();
            return normalizedStatus === 'رفض' || normalizedStatus === 'الغاء' || normalizedStatus === 'إلغاء';
        }

        function matchesSelectedStatuses(shipment, selectedStatuses = []) {
            if (!selectedStatuses || selectedStatuses.length === 0) return true;
            
            const shipmentStatus = getShipmentStatusLabel(shipment);
            return selectedStatuses.includes(shipmentStatus);
        }

        function matchesShipmentFilters(shipment, filters = {}) {
            const {
                search = '',
                dates = [],
                zones = [],
                senders = [],
                statuses = []
            } = filters;

            const normalizedSearch = String(search || '').trim().toLowerCase();
            if (normalizedSearch) {
                const orderId = String(shipment.order_id || '').toLowerCase();
                const phone = String(shipment.الهاتف || '').toLowerCase();
                const customer = String(shipment.اسم_العميل || '').toLowerCase();
                const altPhone = String(shipment['هاتف بديل'] || shipment.هاتف_بديل || shipment.هات_بديل || '').toLowerCase();
                if (!orderId.includes(normalizedSearch) && !phone.includes(normalizedSearch) && !customer.includes(normalizedSearch) && !altPhone.includes(normalizedSearch)) {
                    return false;
                }
            }

            if (dates.length > 0 && !dates.includes(getShipmentDailyFilterValue(shipment))) return false;
            if (zones.length > 0 && !zones.includes(shipment.الزون)) return false;
            if (senders.length > 0 && !senders.includes(shipment.الراسل)) return false;
            return matchesSelectedStatuses(shipment, statuses);
        }

        function filterShipmentsCollection(shipments, filters = {}) {
            return shipments.filter(shipment => matchesShipmentFilters(shipment, filters));
        }

        function countShipmentsByStatus(shipments) {
            return {
                'قيد التوصيل': shipments.filter(s => isPendingStatus(s.الحالة)).length,
                'تم': shipments.filter(s => isDeliveredStatus(s.الحالة, s)).length,
                'مؤجل': shipments.filter(s => isDelayedStatus(s.الحالة)).length,
                'رفض': shipments.filter(s => isRejectedStatus(s.الحالة)).length,
                'تعديل سعر': shipments.filter(s => isPriceEditShipment(s)).length,
                'شحن': shipments.filter(s => isShippingFeeShipment(s)).length
            };
        }

        function getShipmentStatusLabel(shipment) {
            if (isPendingStatus(shipment.الحالة)) return 'قيد التوصيل';
            if (isPriceEditShipment(shipment)) return 'تعديل سعر';
            if (isShippingFeeShipment(shipment)) return 'شحن';
            if (isDelayedStatus(shipment.الحالة)) return 'مؤجل';
            if (isRejectedStatus(shipment.الحالة)) return 'رفض';
            if (isDeliveredStatus(shipment.الحالة, shipment)) return 'تم';
            return shipment.الحالة || 'قيد التوصيل';
        }

        function shouldHideShipmentUpdateActions(shipment, selectedStatuses = []) {
            return (
                (selectedStatuses.length === 0 && (
                    isDeliveredStatus(shipment.الحالة, shipment) ||
                    isShippingFeeShipment(shipment) ||
                    isPriceEditShipment(shipment)
                )) ||
                (selectedStatuses.includes('تم') && isDeliveredStatus(shipment.الحالة, shipment)) ||
                (selectedStatuses.includes('شحن') && isShippingFeeShipment(shipment)) ||
                (selectedStatuses.includes('تعديل سعر') && isPriceEditShipment(shipment)) ||
                (selectedStatuses.includes('رفض') && isRejectedStatus(shipment.الحالة))
            );
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

        function isCommissionEligibleShipment(shipment) {
            const normalizedStatus = String(shipment?.الحالة || '').trim();
            // 'تم' = delivered, isPriceEditShipment = price edit (تعديل سعر), isShippingFeeShipment = shipping fee (شحن)
            return normalizedStatus === 'تم' || normalizedStatus === 'تم التسليم' || isPriceEditShipment(shipment) || isShippingFeeShipment(shipment);
        }

        function getDateFilteredShipments() {
            const selectedDates = getSelectedDates();
            if (selectedDates.length === 0) return allShipments;
            return filterShipmentsCollection(allShipments, { dates: selectedDates });
        }

        function updateFilterCounters() {
            const scopedShipments = getDateFilteredShipments();
            const total = scopedShipments.length;
            const delivered = scopedShipments.filter(s => isDeliveredStatus(s.الحالة, s)).length;
            const shipping = scopedShipments.filter(s => isShippingFeeShipment(s)).length;
            const inDelivery = scopedShipments.filter(s => isPendingStatus(s.الحالة)).length;
            const delayed = scopedShipments.filter(s => isDelayedStatus(s.الحالة)).length;
            const priceEdit = scopedShipments.filter(s => isPriceEditShipment(s)).length;
            const progress = total ? Math.round((delivered / total) * 100) : 0;

            el('progressPercent').innerText = progress;
            el('progressDelivered').innerText = delivered;
            el('progressShipping').innerText = shipping;
            el('progressPriceEdit').innerText = priceEdit;
            el('progressTotal').innerText = total;
            el('progressBar').style.width = `${progress}%`;
            el('repCommissionTotal').innerHTML = `${scopedShipments.filter(isCommissionEligibleShipment).reduce((acc, shipment) => acc + getShipmentCommission(shipment), 0)} <span class="text-sm text-slate-800 dark:text-white">ج.م</span>`;
            const remittanceShipments = scopedShipments.filter(s => isCommissionEligibleShipment(s) && !isShipmentLocked(s.id));
            const remittanceAmount = remittanceShipments.reduce((acc, shipment) => acc + getShipmentAmount(shipment), 0);
            el('repShippingStats').innerText = `المطلوب توريده: ${remittanceShipments.length} شحنة | ${remittanceAmount} ج.م`;
            syncQuickStatCards();
        }

        const ARABIC_DIGIT_MAP = {
            '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
            '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
        };
        let currentDisplayLimit = 40;
        let lastFilterSignature = '';
        let lastMetaSignature = '';
        let cachedFilteredShipments = [];
        let cachedScopedShipments = [];

        function normalizeArabicDigits(value) {
            return String(value || '').replace(/[٠-٩]/g, (digit) => ARABIC_DIGIT_MAP[digit] || digit);
        }

        function parseShipmentSortTimestamp(value) {
            const raw = normalizeArabicDigits(value).trim();
            if (!raw) return 0;

            const numericDate = raw.match(/^(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
            if (numericDate) {
                let first = Number(numericDate[1]);
                const second = Number(numericDate[2]);
                let third = Number(numericDate[3]);
                const hours = Number(numericDate[4] || 0);
                const minutes = Number(numericDate[5] || 0);
                const seconds = Number(numericDate[6] || 0);

                let year;
                let month;
                let day;
                if (String(first).length === 4) {
                    year = first;
                    month = second;
                    day = third;
                } else if (String(third).length === 4) {
                    day = first;
                    month = second;
                    year = third;
                } else {
                    year = third;
                    month = second;
                    day = first;
                }

                return new Date(year, Math.max(month - 1, 0), day, hours, minutes, seconds).getTime() || 0;
            }

            return Date.parse(raw) || 0;
        }

        function getShipmentSortTimestamp(shipment) {
            return parseShipmentSortTimestamp(
                shipment?.['تاريخ التحديث'] ||
                shipment?.تاريخ_التحديث ||
                shipment?.updated_at ||
                shipment?.created_at ||
                getShipmentUpdateValue(shipment)
            );
        }

        function getShipmentSortPriority(shipment) {
            if (isShipmentUpdateLocked(shipment?.id)) return 5;
            if (isPendingStatus(shipment?.الحالة)) return 0;
            if (isDelayedStatus(shipment?.الحالة)) return 1;
            if (isRejectedStatus(shipment?.الحالة)) return 2;
            if (isPriceEditShipment(shipment)) return 3;
            if (isDeliveredStatus(shipment?.الحالة, shipment) || isShippingFeeShipment(shipment)) return 4;
            return 6;
        }

        function sortShipmentsSmart(shipments) {
            return [...shipments].sort((a, b) => {
                const priorityDiff = getShipmentSortPriority(a) - getShipmentSortPriority(b);
                if (priorityDiff !== 0) return priorityDiff;

                const timeDiff = getShipmentSortTimestamp(b) - getShipmentSortTimestamp(a);
                if (timeDiff !== 0) return timeDiff;

                const amountDiff = getShipmentAmount(b) - getShipmentAmount(a);
                if (amountDiff !== 0) return amountDiff;

                const codeA = Number(normalizeArabicDigits(a?.order_id || a?.['كود الشحنة'] || a?.الكود || a?.id || 0));
                const codeB = Number(normalizeArabicDigits(b?.order_id || b?.['كود الشحنة'] || b?.الكود || b?.id || 0));
                return codeB - codeA;
            });
        }

        function buildRenderFilters() {
            return {
                search: document.getElementById('searchInput').value,
                dates: getSelectedDates(),
                zones: getSelectedZones(),
                senders: getSelectedSenders(),
                statuses: getSelectedStatuses()
            };
        }

        function getFilterSignature(filters) {
            return JSON.stringify({
                search: String(filters.search || '').trim().toLowerCase(),
                dates: [...(filters.dates || [])].sort(),
                zones: [...(filters.zones || [])].sort(),
                senders: [...(filters.senders || [])].sort(),
                statuses: [...(filters.statuses || [])].sort(),
                view: currentActiveView,
                favorites: [...favoriteShipmentIds],
                version: shipmentsDataVersion
            });
        }

        function getMetaSignature(filters) {
            return JSON.stringify({
                dates: [...(filters.dates || [])].sort(),
                zones: [...(filters.zones || [])].sort(),
                senders: [...(filters.senders || [])].sort(),
                statuses: [...(filters.statuses || [])].sort(),
                shipments: allShipments.length,
                locked: lockedShipmentIds.size,
                version: shipmentsDataVersion
            });
        }

        function loadMoreShipments() {
            currentDisplayLimit += 40;
            saveRepUiState();
            renderShipments(true);
        }

        function showAllShipments() {
            currentDisplayLimit = Math.max(allShipments.length, currentDisplayLimit, 40);
            saveRepUiState();
            renderShipments(true);
        }

        
