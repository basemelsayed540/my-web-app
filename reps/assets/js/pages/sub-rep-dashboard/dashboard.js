function populateSubRepAssignTools() {
                const assignSelect = document.getElementById('assignSubRep');
                if (!assignSelect) return;

                // Build assign select options (accounts only + warehouse)
                const accountNames = subRepAccounts.map(u => u.username || u.full_name).filter(Boolean);
                if (!accountNames.includes('مخزن')) accountNames.push('مخزن');

                const prevVal = assignSelect.value;
                assignSelect.innerHTML = '<option value="">اختر مندوباً للتعيين</option>';
                accountNames.forEach(name => {
                    assignSelect.innerHTML += `<option value="${name}">${name}</option>`;
                });
                if (accountNames.includes(prevVal)) assignSelect.value = prevVal;
            }

            function toggleStatFilter(status) {
                if (globalStatFilter === status) {
                    globalStatFilter = ''; // Clear filter if clicked twice
                } else {
                    globalStatFilter = status;
                }
                currentPage = 1;
                renderTable();
            }

            function resetAllFilters() {
                globalStatFilter = '';
                if (document.getElementById('searchInput')) document.getElementById('searchInput').value = '';
                if (document.getElementById('filterStatus')) document.getElementById('filterStatus').value = '';
                if (document.getElementById('filterSubRepName')) document.getElementById('filterSubRepName').value = '';
                if (document.getElementById('filterZone')) document.getElementById('filterZone').value = '';
                if (document.getElementById('filterSender')) document.getElementById('filterSender').value = '';
                if (document.getElementById('filterAgent')) document.getElementById('filterAgent').value = '';
                if (document.getElementById('filterUpdate')) document.getElementById('filterUpdate').value = '';

                populateSubRepAssignTools();

                currentPage = 1;
                renderTable();

                Swal.fire({
                    icon: 'info',
                    title: 'تم إعادة ضبط جميع الفلاتر',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000
                });
            }

            function updateDashboardStats(shipments) {
                const subRepNamesShort = subRepAccounts.map(u => u.username).filter(Boolean); // TARGETED
                const subRepNamesFull = subRepAccounts.map(u => u.full_name).filter(Boolean);

                const noDelegate = shipments.filter(s => {
                    const rep = s['المندوب الفرعي'];
                    return !subRepNamesShort.includes(rep) && !subRepNamesFull.includes(rep) && rep !== 'مخزن';
                }).length;
                const noAmountCount = 0; if(false){ const _removed = shipments.filter(s => {
                    const amt = String(s.المبلغ || '').trim();
                    return !amt || amt === '0' || amt === '0.0' || amt === '0.00';
                }).length; }
                const warehouseCount = shipments.filter(s => s['المندوب الفرعي'] === 'مخزن').length;
                const doneCount = shipments.filter(s => getShipmentDisplayStatus(s) === 'تم التوصيل').length;
                const amendedCount = shipments.filter(s => getShipmentDisplayStatus(s) === 'تعديل سعر').length;
                const rejectedCount = shipments.filter(s => getShipmentDisplayStatus(s) === 'رفض').length;
                const postponedCount = shipments.filter(s => getShipmentDisplayStatus(s) === 'مؤجل').length;
                const inDeliveryCount = shipments.filter(s => getShipmentDisplayStatus(s) === 'قيد التوصيل').length;

                let totalAmount = 0;
                shipments.forEach(s => {
                    const status = getShipmentDisplayStatus(s);
                    if (status === 'تم التوصيل' || status === 'تعديل سعر') {
                        const priceStr = s.السعر_بعد_التعديل || s.المبلغ || '0';
                        const price = parseFloat(String(priceStr).replace(/[^0-9.-]+/g, "")) || 0;
                        totalAmount += price; // SUCCESS
                    }
                });

                const container = document.getElementById('dashboardStatsContainer');
                if (container) {
                    const getActiveClass = (s) => globalStatFilter === s ? 'highlight-active scale-[1.03] shadow-xl ring-2 ring-indigo-300 dark:ring-indigo-500/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 -translate-y-0.5' : 'hover:-translate-y-0.5 hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-900/90 dark:hover:border-slate-600/80';

                    const cardStyle = "flex-shrink-0 min-w-[100px] md:min-w-[120px] p-3 rounded-2xl border flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-200 active:scale-95 backdrop-blur-sm";

                    container.innerHTML = `<!-- HELLO -->
                    <button onclick="resetAllFilters()" class="${cardStyle} bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900/40 shadow-sm ${getActiveClass('')}">
                        <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">الكل</span>
                        <span class="text-base font-black text-indigo-600 dark:text-indigo-500">${shipments.length}</span>
                    </button>
                    <button onclick="toggleStatFilter('بدون مندوب')" class="${cardStyle} bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm ${getActiveClass('بدون مندوب')}">
                        <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">بدون مندوب</span>
                        <span class="text-base font-black text-slate-700 dark:text-slate-200">${noDelegate}</span>
                    </button>
                    <button style="display:none" onclick="toggleStatFilter('بدون مبلغ')" class="${cardStyle} bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/40 shadow-sm ${getActiveClass('بدون مبلغ')}">
                        <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">---</span>
                        <span class="text-base font-black text-rose-600 dark:text-rose-500">${noAmountCount}</span>
                    </button>
                    <button onclick="toggleStatFilter('مخزن')" class="${cardStyle} bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/40 shadow-sm ${getActiveClass('مخزن')}">
                        <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">المخزن</span>
                        <span class="text-base font-black text-amber-600 dark:text-amber-500">${warehouseCount}</span>
                    </button>
                    <button onclick="toggleStatFilter('تم التوصيل')" class="${cardStyle} bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/40 shadow-sm ${getActiveClass('تم التوصيل')}">
                        <span class="text-[10px] font-bold text-slate-500">تم التوصيل</span>
                        <span class="text-base font-black text-emerald-600">${doneCount}</span>
                    </button>
                    <button onclick="toggleStatFilter('تعديل سعر')" class="${cardStyle} bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800/30 shadow-sm ${getActiveClass('تعديل سعر')}">
                        <span class="text-[10px] font-bold text-slate-500">تعديل سعر</span>
                        <span class="text-base font-black text-indigo-600">${amendedCount}</span>
                    </button>
                    <button onclick="toggleStatFilter('رفض')" class="${cardStyle} bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-800/30 shadow-sm ${getActiveClass('رفض')}">
                        <span class="text-[10px] font-bold text-slate-500">مرفوض/مرتجع</span>
                        <span class="text-base font-black text-rose-600">${rejectedCount}</span>
                    </button>
                    <button onclick="toggleStatFilter('مؤجل')" class="${cardStyle} bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-800/30 shadow-sm ${getActiveClass('مؤجل')}">
                        <span class="text-[10px] font-bold text-slate-500">مؤجل</span>
                        <span class="text-base font-black text-amber-600">${postponedCount}</span>
                    </button>
                    <button onclick="toggleStatFilter('قيد التوصيل')" class="${cardStyle} bg-white dark:bg-slate-800 border-sky-200 dark:border-sky-800/30 shadow-sm ${getActiveClass('قيد التوصيل')}">
                        <span class="text-[10px] font-bold text-slate-500">قيد التوصيل</span>
                        <span class="text-base font-black text-sky-600">${inDeliveryCount}</span>
                    </button>
                    <div class="flex-shrink-0 min-w-[110px] bg-gradient-to-br from-indigo-600 to-indigo-800 p-3 rounded-2xl shadow-md flex flex-col justify-center items-center text-center">
                        <span class="text-[10px] font-bold text-indigo-200">التوريد</span>
                        <span class="text-base font-black text-white" dir="ltr">${totalAmount.toLocaleString()}</span>
                    </div>
                `;
                }
            }

            function getVisibleShipments() {
                const fStatus = document.getElementById('filterStatus')?.value || '';
                const fSubRep = document.getElementById('filterSubRepName')?.value || '';
                const fZone = document.getElementById('filterZone').value;
                const fSender = document.getElementById('filterSender').value;
                const fAgent = document.getElementById('filterAgent')?.value || '';
                const fUpdate = document.getElementById('filterUpdate').value;
                const fRep = document.getElementById('filterRep')?.value || '';
                const searchQ = document.getElementById('searchInput').value.trim().toLowerCase();

                return allShipments.filter(s => {
                    if (fStatus && getShipmentDisplayStatus(s) !== fStatus) return false;
                    if (fSubRep && (String(s['المندوب الفرعي'] || '').trim() || 'بدون مندوب') !== fSubRep) return false;
                    if (fZone && s.الزون !== fZone) return false;
                    if (fSender && s.الراسل !== fSender) return false;
                    if (fAgent && String(s['اسم الموظ'] || '').trim() !== fAgent) return false;
                    if (fUpdate && getShipmentDailyValue(s) !== fUpdate) return false;
                    if (fRep && String(s.المندوب || '').trim() !== fRep) return false;

                    // Add global stat filter logic
                    if (globalStatFilter) {
                        if (globalStatFilter === 'بدون مندوب') {
                            const subRepNamesShort = subRepAccounts.map(u => u.username).filter(Boolean);
                            const subRepNamesFull = subRepAccounts.map(u => u.full_name).filter(Boolean);
                            const rep = s['المندوب الفرعي'];
                            if (subRepNamesShort.includes(rep) || subRepNamesFull.includes(rep) || rep === 'مخزن') return false;
                        } else if (globalStatFilter === 'بدون مبلغ') {
                            const amt = String(s.المبلغ || '').trim();
                            if (amt && amt !== '0' && amt !== '0.0' && amt !== '0.00') return false;
                        } else if (globalStatFilter === 'مخزن') {
                            if (s['المندوب الفرعي'] !== 'مخزن') return false;
                        } else if (globalStatFilter === 'رفض') {
                            const status = getShipmentDisplayStatus(s);
                            if (status !== 'رفض') return false;
                        } else {
                            if (getShipmentDisplayStatus(s) !== globalStatFilter) return false;
                        }
                    }

                    if (searchQ && searchQ.length >= 3) {
                        const matchOrderId = String(s.order_id || '').toLowerCase().includes(searchQ);
                        const matchName = String(s.اسم_العميل || '').toLowerCase().includes(searchQ);
                        const matchPhone = String(s.الهات || '').toLowerCase().includes(searchQ);
                        const matchAltPhone = String(s.هات_بديل || '').toLowerCase().includes(searchQ);
                        if (!matchOrderId && !matchName && !matchPhone && !matchAltPhone) return false;
                    }
                    return true;
                });
            }

            function renderTable() {
                const filtered = getVisibleShipments();
                updateDashboardStats(filtered);
                const tbody = document.getElementById('shipmentsTableBody');
                const pagination = document.getElementById('paginationContainer');

                if (filtered.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="13" class="text-center p-8 text-slate-500 font-bold">لا توجد شحنات مطابقة للفلاتر</td></tr>`;
                    pagination.innerHTML = '';
                    saveFollowerUiState();
                    return;
                }

                const totalPages = Math.ceil(filtered.length / itemsPerPage);
                if (currentPage > totalPages) currentPage = totalPages;
                const startIndex = (currentPage - 1) * itemsPerPage;
                const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

                const newRepName = (document.getElementById('subRepNewRepName')?.value || '').trim();
                tbody.innerHTML = paginated.map(s => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                    <td class="px-2 py-2 text-center">
                        <input class="subrep-row-checkbox rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 outline-none w-3.5 h-3.5 cursor-pointer" type="checkbox" value="${s.id}" data-shipment-code="${s['كود الشحنة'] || s.order_id || ''}" onclick="updateSubRepRowSelection()">
                    </td>
                    <td class="px-1 py-2 text-center">
                        ${newRepName
                        ? `<button class="subrep-assign-btn bg-amber-500 text-white text-[10px] font-black py-1 px-2 rounded-md shadow-sm hover:bg-amber-600 transition-colors cursor-pointer w-full" title="تعيين: ${newRepName}" onclick="assignNewRepToShipment('${s.id}')">${newRepName}</button>`
                        : `<button class="subrep-assign-btn bg-slate-100 text-slate-400 text-[10px] py-1 px-2 rounded-md border border-slate-200 cursor-not-allowed w-full" disabled><i class='fas fa-user-plus'></i></button>`
                    }
                    </td>
                    <td class="px-2 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[120px] truncate" title="${s.اسم_العميل || ''}">${s.اسم_العميل || '---'}</td>
                    <td class="px-2 py-2 text-[11px] text-slate-600 dark:text-slate-400 leading-tight max-w-[100px] truncate" title="${s.العنوان || ''}">${s.العنوان || '---'}</td>
                    <td class="px-2 py-2 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">${s.الزون || '---'}</td>
                    <td class="px-2 py-2 text-xs text-slate-700 dark:text-slate-300 max-w-[80px] truncate" title="${s.المنتج || ''}">${s.المنتج || '---'}</td>
                    <td class="px-2 py-2 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">${s.الراسل || '---'}</td>
                    <td class="px-2 py-2 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">${s['اسم الموظ'] || '---'}</td>
                    <td class="px-2 py-2 text-xs font-bold whitespace-nowrap">
                        ${(() => {
                        const subRepNamesShort = subRepAccounts.map(u => u.username).filter(Boolean);
                        const subRepNamesFull = subRepAccounts.map(u => u.full_name).filter(Boolean);
                        const rep = s['المندوب الفرعي'];
                        if (subRepNamesShort.includes(rep) || subRepNamesFull.includes(rep)) {
                            return `<span class="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">${rep}</span>`;
                        } else if (rep === 'مخزن') {
                            return `<span class="text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100 flex items-center justify-center gap-1 w-full"><i class="fas fa-warehouse text-[10px]"></i> مخزن</span>`;
                        } else {
                            return `<span class="text-slate-400 font-normal">-- بدون مندوب --</span>`;
                        }
                    })()}
                    </td>
                    <td class="px-2 py-2 whitespace-nowrap text-center">
                        <select onchange="updateShipmentInline('${s.id}', 'الحالة', this.value)" class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${getShipmentDisplayStatus(s) === 'تم التوصيل' ? 'text-emerald-600 font-bold' : 'text-slate-700 dark:text-white'} text-[10px] font-black rounded px-1 py-1 w-[80px] outline-none focus:border-indigo-500 text-center">
                            <option value="">--</option>
                            <option value="قيد التوصيل" ${getShipmentDisplayStatus(s) === 'قيد التوصيل' || getShipmentDisplayStatus(s) === 'قيد التنيذ' ? 'selected' : ''}>قيد التوصيل</option>
                            <option value="تم التوصيل" ${getShipmentDisplayStatus(s) === 'تم التوصيل' ? 'selected' : ''}>تم التوصيل</option>
                            <option value="تعديل سعر" ${getShipmentDisplayStatus(s) === 'تعديل سعر' ? 'selected' : ''}>تعديل سعر</option>
                            <option value="مؤجل" ${getShipmentDisplayStatus(s) === 'مؤجل' ? 'selected' : ''}>مؤجل</option>
                            <option value="مرفوض" ${getShipmentDisplayStatus(s) === 'مرفوض' || getShipmentDisplayStatus(s) === 'مروض' ? 'selected' : ''}>مرفوض</option>
                            <option value="مرتجع" ${getShipmentDisplayStatus(s) === 'مرتجع' ? 'selected' : ''}>مرتجع</option>
                            <option value="إلغاء" ${getShipmentDisplayStatus(s) === 'إلغاء' || getShipmentDisplayStatus(s) === 'الغاء' ? 'selected' : ''}>إلغاء</option>
                        </select>
                    </td>
                    <td class="px-2 py-2 text-[10px] text-slate-500 max-w-[100px]">
                        <input type="text" onblur="updateShipmentInline('${s.id}', 'سبب الحالة', this.value)" value="${getShipmentDisplayReason(s) || ''}" placeholder="بدون سبب" class="w-full bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-solid focus:border-indigo-500 outline-none text-[10px] text-center dark:text-slate-300 placeholder-slate-400">
                    </td>
                    <td class="px-2 py-2 text-xs font-black text-slate-700 whitespace-nowrap">${s.المبلغ ? s.المبلغ : '0'}</td>
                    <td class="px-2 py-2 text-xs font-black text-emerald-600 whitespace-nowrap text-center">
                        <input type="text" onblur="updateShipmentInline('${s.id}', 'السعر_بعد_التعديل', this.value)" value="${s.السعر_بعد_التعديل ? s.السعر_بعد_التعديل : ''}" placeholder="" class="w-16 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-solid focus:border-emerald-500 outline-none text-xs font-black text-emerald-600 dark:text-emerald-400 text-center placeholder-slate-400">
                    </td>
                    <td class="px-2 py-2 text-center">
                        <div class="flex items-center justify-center gap-1">
                            ${renderShipmentContactActions(s)}
                            <button onclick="toggleShipmentMenu(event, '${s.id}')" class="table-action-btn flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:text-indigo-600" title="خيارات">
                                <i class="fas fa-ellipsis-v text-xs"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

                renderPagination(totalPages);
                updateSubRepRowSelection();
                saveFollowerUiState();
            }

            
