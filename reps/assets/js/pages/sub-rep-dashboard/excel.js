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
            
