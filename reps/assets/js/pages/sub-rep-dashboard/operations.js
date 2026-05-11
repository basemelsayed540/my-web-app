async function handleExcelUpload(input) {
                const file = input.files[0];
                if (!file) return;

                const extractMissingSchemaColumn = (message) => {
                    const match = String(message || '').match(/Could not find the '([^']+)' column of 'elsayed'/);
                    return match ? match[1] : '';
                };

                const omitFieldFromRows = (rows, fieldName) => rows.map(row => {
                    if (!fieldName || !Object.prototype.hasOwnProperty.call(row, fieldName)) return row;
                    const clone = { ...row };
                    delete clone[fieldName];
                    return clone;
                });

                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const targetSheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'data');
                        if (!targetSheetName) {
                            Swal.fire('تنبيه هام', 'يجب أن يحتوي مل الإكسل المروع على ورقة عمل (Sheet) باسم "data" لضمان صحة البيانات', 'warning');
                            input.value = '';
                            return;
                        }
                        const worksheet = workbook.Sheets[targetSheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet);

                        if (jsonData.length === 0) {
                            Swal.fire('تنبيه', 'المل المروع ارغ', 'warning');
                            return;
                        }

                        // Get today's date for 'الابيديت'
                        const today = new Date().toISOString().split('T')[0];

                        // Helper function to extract value regardless of column order, exact spacing, or underscores
                        const getVal = (row, ...possibleKeys) => {
                            for (const key of Object.keys(row)) {
                                const cleanKey = key.trim().replace(/_/g, ' ');
                                for (const pk of possibleKeys) {
                                    if (cleanKey === pk.trim().replace(/_/g, ' ')) {
                                        return row[key] !== undefined && row[key] !== null ? row[key] : '';
                                    }
                                }
                            }
                            return '';
                        };

                        const cleanNumericValue = (value, fallback = 0) => {
                            if (value === null || value === undefined || String(value).trim() === '') return fallback;
                            const cleaned = parseFloat(String(value).replace(/[^\d.-]/g, ''));
                            return Number.isNaN(cleaned) ? fallback : cleaned;
                        };

                        const normalizeExcelDateValue = (value, fallback = today) => {
                            if (value === null || value === undefined || String(value).trim() === '') return fallback;
                            if (typeof value === 'number' && Number.isFinite(value)) {
                                const utcDays = Math.floor(value - 25569);
                                const utcValue = utcDays * 86400;
                                const dateInfo = new Date(utcValue * 1000);
                                if (!Number.isNaN(dateInfo.getTime())) {
                                    return dateInfo.toISOString().split('T')[0];
                                }
                            }
                            const normalized = String(value).trim();
                            const parsed = new Date(normalized);
                            if (!Number.isNaN(parsed.getTime())) {
                                return parsed.toISOString().split('T')[0];
                            }
                            return normalized || fallback;
                        };

                        // Map Excel headers to DB columns matching standard names (Order independent)
                        const currentUName = user.full_name || user.username || 'مندوب';
                        const shipmentsToUpload = jsonData.map((row, index) => {
                            const amount = getVal(row, 'المبلغ', 'مبلغ', 'السعر');
                            let orderId = String(getVal(row, 'كود الشحنة', 'الكود', 'كود', 'order id', 'order_id')).trim();
                            
                            // Automatically generate a unique, non-repeating order ID if none exists
                            if (!orderId) {
                                const uniqueSuffix = Date.now() + '-' + Math.floor(Math.random() * 10000) + '-' + (index + 1);
                                orderId = 'SR-' + uniqueSuffix;
                            }

                            return {
                                'm': getVal(row, 'm', 'م'),
                                'الراسل': getVal(row, 'الراسل', 'الشركه', 'الشركة'),
                                'اسم العميل': getVal(row, 'اسم العميل', 'اسم_العميل', 'العميل'),
                                'الزون': getVal(row, 'الزون'),
                                'المنتج': getVal(row, 'المنتج', 'الصنف'),
                                'الهاتف': String(getVal(row, 'الهاتف', 'الهات', 'رقم الهات', 'موبايل')),
                                'هاتف بديل': String(getVal(row, 'هاتف بديل', 'هات بديل', 'هات_بديل', 'هاتف_بديل', 'رقم بديل')),
                                'العنوان': getVal(row, 'العنوان', 'العنوان بالكامل'),
                                'المبلغ': cleanNumericValue(amount),
                                'السعر بعد التعديل': cleanNumericValue(getVal(row, 'السعر بعد التعديل', 'السعر_بعد_التعديل'), cleanNumericValue(amount)),
                                'الصافي': cleanNumericValue(getVal(row, 'الصافي', 'الصاي')),
                                'الشحن': cleanNumericValue(getVal(row, 'الشحن')),
                                'عدد': getVal(row, 'عدد', 'كود اضافي', 'كود_اضافي'),
                                'تقفيل': String(getVal(row, 'تقفيل', 'تقيل') || ''),
                                'عمولة المندوب': cleanNumericValue(getVal(row, 'عمولة المندوب', 'عمولة_المندوب')),
                                'عمولة المندوب الفرعي': cleanNumericValue(getVal(row, 'عمولة المندوب الفرعي', 'عمولة_المندوب_الفرعي')),
                                'الحالة': getVal(row, 'الحالة', 'حالة', 'حالة الشحنة'),
                                'سبب الحالة': getVal(row, 'سبب الحالة', 'سبب_الحالة', 'السبب'),
                                'نوع المندوب': 'مندوب متقدم',
                                'المندوب الفرعي': getVal(row, 'المندوب الرعي', 'المندوب الفرعي', 'نوع المندوب'),
                                'ملاحظات': getVal(row, 'ملاحظات'),
                                'كود الشحنة': orderId,
                                'المندوب': getVal(row, 'المندوب', 'مندوب', 'اسم المندوب') || `PRIVATE:${user.username}`,
                                'اسم الموظف': getVal(row, 'اسم الموظف', 'اسم الموظ', 'اسم_الموظف') || currentUName,
                                'تاريخ التحديث': normalizeExcelDateValue(getVal(row, 'تاريخ التحديث', 'تاريخ_التحديث', 'الابيديت', 'التاريخ'), today),
                                'حدث': getVal(row, 'حدث'),
                                'اليومية': getVal(row, 'اليومية', 'اليوميه')
                            };
                        });
                        
                        shipmentsToUpload.forEach(s => saveAuditLog('تم رفع ملف اكسل', s));

                        Swal.fire({
                            title: 'جاري رفع الشحنات...',
                            html: `يتم معالجة ${shipmentsToUpload.length} شحنة`,
                            allowOutsideClick: false,
                            didOpen: () => { Swal.showLoading(); }
                        });

                        const saveShipmentRow = async (item) => {
                            const shipmentCode = String(item?.['كود الشحنة'] || item?.order_id || '').trim();
                            if (!shipmentCode) {
                                return { error: { message: 'تعذر العثور على كود الشحنة في أحد الصفوف.' } };
                            }

                            let sanitizedFields = { ...item };
                            delete sanitizedFields['كود الشحنة'];
                            delete sanitizedFields.order_id;

                            let existsRes = await supabaseClient
                                .from(CONFIG.TABLES.SHIPMENTS)
                                .select('m')
                                .eq('كود الشحنة', shipmentCode)
                                .limit(1);

                            if (existsRes.error) {
                                return { error: existsRes.error };
                            }

                            if (Array.isArray(existsRes.data) && existsRes.data.length > 0) {
                                let payload = toServerShipmentPayload(sanitizedFields);
                                let res = await supabaseClient
                                    .from(CONFIG.TABLES.SHIPMENTS)
                                    .update(payload)
                                    .eq('كود الشحنة', shipmentCode);

                                if (res.error) {
                                    const missingField = extractMissingSchemaColumn(res.error.message);
                                    if (missingField) {
                                        skippedSchemaField = skippedSchemaField || missingField;
                                        delete sanitizedFields[missingField];
                                        payload = toServerShipmentPayload(sanitizedFields);
                                        res = await supabaseClient
                                            .from(CONFIG.TABLES.SHIPMENTS)
                                            .update(payload)
                                            .eq('كود الشحنة', shipmentCode);
                                    }
                                }

                                return { error: res.error || null };
                            }

                            let insertPayload = toServerShipmentPayload(item);
                            let insertRes = await supabaseClient
                                .from(CONFIG.TABLES.SHIPMENTS)
                                .insert([insertPayload]);

                            if (insertRes.error) {
                                const missingField = extractMissingSchemaColumn(insertRes.error.message);
                                if (missingField) {
                                    skippedSchemaField = skippedSchemaField || missingField;
                                    const retryItem = { ...item };
                                    delete retryItem[missingField];
                                    insertPayload = toServerShipmentPayload(retryItem);
                                    insertRes = await supabaseClient
                                        .from(CONFIG.TABLES.SHIPMENTS)
                                        .insert([insertPayload]);
                                }
                            }

                            return { error: insertRes.error || null };
                        };

                        let payloadRows = shipmentsToUpload;
                        let { error } = await supabaseClient
                            .from(CONFIG.TABLES.SHIPMENTS)
                            .upsert(payloadRows.map(toServerShipmentPayload), { onConflict: 'كود الشحنة' });

                        let skippedSchemaField = '';
                        if (error) {
                            const missingField = extractMissingSchemaColumn(error.message);
                            if (missingField) {
                                skippedSchemaField = missingField;
                                payloadRows = omitFieldFromRows(payloadRows, missingField);
                                ({ error } = await supabaseClient
                                    .from(CONFIG.TABLES.SHIPMENTS)
                                    .upsert(payloadRows.map(toServerShipmentPayload), { onConflict: 'كود الشحنة' }));
                            }
                        }

                        if (error) {
                            let successCount = 0;
                            let lastError = error.message;

                            for (const item of payloadRows) {
                                const { error: rowError } = await saveShipmentRow(item);
                                if (rowError) {
                                    lastError = rowError.message;
                                } else {
                                    successCount++;
                                }
                            }

                            if (successCount !== payloadRows.length) {
                                throw new Error(lastError || `فشل رفع ${payloadRows.length - successCount} صف من الملف.`);
                            }
                        }

                        const successMessage = skippedSchemaField
                            ? `تم رفع ${payloadRows.length} شحنة بنجاح مع تجاهل العمود "${skippedSchemaField}" لأن السيرفر لا يتعرّف عليه حالياً`
                            : `تم رفع ${payloadRows.length} شحنة بنجاح`;
                        await Swal.fire('تم بنجاح', successMessage, 'success');
                        await fetchShipments();

                    } catch (error) {
                        console.error('Excel Upload Error:', error);
                        Swal.fire('خطأ', 'حدث خطأ أثناء رفع ملف الإكسل: ' + error.message, 'error');
                    } finally {
                        input.value = ''; // Reset input
                    }
                };
                reader.readAsArrayBuffer(file);
            }
        
            function exportToExcel() {
                const data = getVisibleShipments();
                if (!data || data.length === 0) {
                    Swal.fire('تنبيه', 'لا توجد بيانات لتصديرها', 'warning');
                    return;
                }

                const exportData = data.map(s => {
                    const normalized = normalizeShipmentRecordHeaders(s);
                    return buildShipmentExcelRow(normalized, {
                        'الحالة': getShipmentDisplayStatus(s),
                        'سبب الحالة': getShipmentDisplayReason(s),
                        'السعر بعد التعديل': normalized['السعر بعد التعديل'] || normalized['المبلغ'] || '',
                        'عمولة المندوب الفرعي': normalized['عمولة المندوب الفرعي'] || s['عمولة_المندوب_الفرعي'] || s['عمولة المندوب الفرعي'] || ''
                    });
                });

                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "الشحنات");
                XLSX.writeFile(wb, `شحنات_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.xlsx`);
            }

            /* ========================
               Sub-Rep Assignment Logic
               ======================== */
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


            // Initial Load
            fetchShipments();