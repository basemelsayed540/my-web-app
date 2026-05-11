function getShipmentById(id) {
            return allShipments.find(s => String(s.id) === String(id));
        }

        function getShipmentPhone(shipment, key) {
            return (shipment[key] || '').toString().trim();
        }

        function normalizeWhatsAppPhone(rawPhone) {
            const value = String(rawPhone || '').trim();
            if (!value) return '';

            const primaryPart = value.split('//')[0].split('/')[0].trim();
            let normalized = primaryPart.replace(/[^\d+]/g, '');

            if (!normalized) return '';
            if (normalized.startsWith('+')) {
                normalized = `+${normalized.slice(1).replace(/\+/g, '')}`;
            } else {
                normalized = normalized.replace(/\+/g, '');
            }
            if (normalized.startsWith('00')) normalized = `+${normalized.slice(2)}`;
            if (normalized.startsWith('01') && normalized.length === 11) normalized = `20${normalized.slice(1)}`;
            if (normalized.startsWith('+')) normalized = normalized.slice(1);

            return normalized;
        }

        function normalizeCallPhone(rawPhone) {
            const value = String(rawPhone || '').trim();
            if (!value) return '';

            const primaryPart = value.split('//')[0].split('/')[0].trim();
            return primaryPart.replace(/[^\d+]/g, '');
        }

        function renderShipmentContactActions(shipment) {
            const hasPrimaryNumericPhone = (() => {
                const primaryValue = getShipmentPhone(shipment, 'الهاتف');
                const normalized = normalizeWhatsAppPhone(primaryValue);
                return /^\+?\d+$/.test(normalized) && normalized.length >= 7;
            })();

            const renderField = (key, label) => {
                const val = getShipmentPhone(shipment, key);
                if (!val) return '';

                const cleaned = normalizeWhatsAppPhone(val);
                const callNumber = normalizeCallPhone(val);
                const isNumeric = /^\+?\d+$/.test(cleaned) && cleaned.length >= 7;

                if (!isNumeric) {
                    if (key === 'هاتف_بديل' && hasPrimaryNumericPhone) return '';
                    return `
                        <div class="flex items-center gap-1.5 px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span class="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[8px] font-black text-amber-700 dark:text-amber-300">ملاحظة</span>
                            <span class="text-[9px] font-black text-slate-600 dark:text-slate-200 text-center leading-tight">${val}</span>
                        </div>
                    `;
                }

                return `
                    <div class="flex items-center gap-1.5 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 px-1.5 py-1 shadow-sm">
                        <button data-action="send-whatsapp" data-id="${shipment.id}" data-phone-key="${key}" class="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#25D366] text-white shadow-sm active:scale-95 transition-all flex items-center justify-center" title="واتساب ${label}">
                            <span class="flex items-center justify-center w-7 h-7 rounded-full bg-white/18 border border-white/15">
                                <i class="fab fa-whatsapp text-[15px] sm:text-[16px]"></i>
                            </span>
                        </button>
                        <button data-action="call-phone" data-id="${shipment.id}" data-phone-key="${key}" class="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-sky-700 dark:bg-cyan-700 border border-sky-800/20 dark:border-cyan-400/20 text-white shadow-sm active:scale-95 transition-all flex items-center justify-center" title="اتصال ${label}">
                            <span class="flex items-center justify-center w-7 h-7 rounded-full bg-white/18 border border-white/15">
                                <i class="fas fa-phone-alt text-[13px] sm:text-[14px]"></i>
                            </span>
                        </button>
                    </div>
                `;
            };

            const primary = renderField('الهاتف', 'الهاتف');
            const secondary = renderField('هاتف_بديل', 'الهاتف البديل');

            return `
                <div class="flex flex-wrap items-center gap-1.5">
                    ${primary}
                    ${secondary}
                </div>
            `;
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
                `الهاتف: ${getValue(shipment.الهاتف)}`,
                `هاتف بديل: ${getValue(shipment.هاتف_بديل)}`,
                `المبلغ: ${getValue(shipment.المبلغ)}`,
                `الكود: ${getValue(shipment.order_id || shipment['كود الشحنة'] || shipment.كود_الشحنة || shipment.الكود || shipment.id)}`,
                `الراسل: ${getValue(shipment.الراسل)}`,
                `المندوب: ${getValue(shipment.المندوب)}`,
                `عدد المحاولات: ${getShipmentCallAttempts(shipment)}`
            ].join('\n');
        }

        function closeShipmentMenu() {
            const menu = document.getElementById('shipmentMenu');
            menu.classList.add('hidden');
            activeShipmentMenuId = null;
            activeShipmentMenuMode = 'copy';
        }

        function setShipmentMenuActionState(disabled) {}

        function toggleShipmentMenu(event, shipmentId, mode = 'copy') {
            event.stopPropagation();
            openShipmentMenuAtPosition(
                shipmentId,
                event.clientX - 200,
                event.clientY + 12,
                mode
            );
        }

        async function copyShipmentData(id) {
            const shipment = getShipmentById(id);
            if (!shipment) return;

            try {
                await navigator.clipboard.writeText(formatShipmentCopyText(shipment));
                closeShipmentMenu();
            } catch (error) {
                closeShipmentMenu();
                Swal.fire('خطأ', 'فشل نسخ بيانات الشحنة', 'error');
            }
        }

        function copyShipmentDataFromMenu() {
            if (!activeShipmentMenuId) return;
            copyShipmentData(activeShipmentMenuId);
        }

        function editPriceFromMenu() {
            if (!activeShipmentMenuId) return;
            const shipmentId = activeShipmentMenuId;
            closeShipmentMenu();
            editPrice(shipmentId);
        }

        function delayShipmentFromMenu() {
            if (!activeShipmentMenuId) return;
            const shipmentId = activeShipmentMenuId;
            closeShipmentMenu();
            updateStatus(shipmentId, 'مؤجل');
        }

        function rejectShipmentFromMenu() {
            if (!activeShipmentMenuId) return;
            const shipmentId = activeShipmentMenuId;
            closeShipmentMenu();
            handleRejectAction(shipmentId);
        }

        function getStatusColor(shipment) {
            if (isPriceEditShipment(shipment)) return 'bg-cyan-500';
            if (isDelayedStatus(shipment.الحالة)) return 'bg-amber-500';
            if (isRejectedStatus(shipment.الحالة)) return 'bg-rose-500';
            switch (shipment.الحالة) {
                case 'تم':
                case 'شحن':
                case 'تم التسليم': return 'bg-emerald-500';
                default: return 'bg-sky-700';
            }
        }

        function getStatusBadgeClass(shipment) {
            if (isPriceEditShipment(shipment)) return 'bg-cyan-100 text-cyan-700';
            if (isDelayedStatus(shipment.الحالة)) return 'bg-amber-100 text-amber-700';
            if (isRejectedStatus(shipment.الحالة)) return 'bg-rose-100 text-rose-700';
            switch (shipment.الحالة) {
                case 'تم':
                case 'شحن':
                case 'تم التسليم': return 'bg-emerald-100 text-emerald-700';
                default: return 'bg-cyan-100 text-sky-800';
            }
        }

        function getShipmentStatusThemeClass(shipment) {
            if (isShippingFeeShipment(shipment)) return 'shipment-theme-shipping';
            if (isPriceEditShipment(shipment)) return 'shipment-theme-price';
            if (isDeliveredStatus(shipment.الحالة, shipment)) return 'shipment-theme-delivered';
            if (isDelayedStatus(shipment.الحالة)) return 'shipment-theme-delayed';
            if (isRejectedStatus(shipment.الحالة)) return 'shipment-theme-rejected';
            return 'shipment-theme-pending';
        }

        async function updateStatus(id, status) {
            if (isShipmentUpdateLocked(id)) {
                Swal.fire('تنبيه', 'هذه الشحنة مرتبطة بطلب تسوية ولا يمكن تعديلها مرة أخرى', 'warning');
                return;
            }

            const shipment = allShipments.find(s => s.id == id);
            if (!shipment) return;

            const normalizedStatus = status === 'تم التسليم' ? 'تم' : (status === 'مؤجل' ? 'مؤجل' : status);
            const updatePayload = {
                الحالة: normalizedStatus
            };

            if (arguments.length > 2 && arguments[2]) {
                updatePayload['سبب الحالة'] = arguments[2];
            } else if (normalizedStatus === 'مؤجل') {
                updatePayload['سبب الحالة'] = 'مؤجل';
            }

            if (normalizedStatus === 'تم') {
                updatePayload.السعر_بعد_التعديل = Number(getShipmentAmount(shipment)) || 0;
            }

            const { error } = await supabaseClient
                .from(CONFIG.TABLES.SHIPMENTS)
                .update(toServerShipmentPayload(updatePayload))
                .eq('id', Number(id) || id);

            if (error) {
                console.error('Update shipment status error:', error);
                Swal.fire('خطأ', error.message || 'فشل تحديث الحالة', 'error');
                return;
            }

            Swal.fire({
                icon: 'success',
                title: 'تم التحديث',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });

            // Local update for smoothness
            const index = allShipments.findIndex(s => s.id == id);
            if (index !== -1) {
                allShipments[index].الحالة = normalizedStatus;
                if (updatePayload['سبب الحالة']) {
                    allShipments[index]['سبب الحالة'] = updatePayload['سبب الحالة'];
                }
                if (Object.prototype.hasOwnProperty.call(updatePayload, 'السعر_بعد_التعديل')) {
                    allShipments[index].السعر_بعد_التعديل = updatePayload.السعر_بعد_التعديل;
                }
                syncFavoriteShipmentAfterStatusUpdate(id, getShipmentStatusLabel(allShipments[index]));
            }
            if (normalizedStatus === 'تم' || normalizedStatus === 'شحن') {
                lockShipmentForFurtherUpdates(id);
            }
            bumpShipmentsDataVersion();
            renderShipments();
        }

        async function handleRejectAction(id) {
            if (isShipmentUpdateLocked(id)) {
                Swal.fire('تنبيه', 'هذه الشحنة مرتبطة بطلب تسوية ولا يمكن تعديلها مرة أخرى', 'warning');
                return;
            }

            const reason = await promptRejectReason('تحديث الحالة');

            if (reason) {
                await updateStatus(id, 'الغاء', reason);
            }
        }

        async function editPrice(id) {
            const shipment = allShipments.find(s => s.id == id);
            if (!shipment) return;
            if (isShipmentUpdateLocked(shipment)) {
                Swal.fire('تنبيه', 'هذه الشحنة مرتبطة بطلب تسوية ولا يمكن تعديلها مرة أخرى', 'warning');
                return;
            }

            const currentReason = String(shipment['سبب الحالة'] || shipment.سبب_الحالة || '').trim();
            const isShippingType = currentReason.includes('شحن');

            const { value: formValues } = await Swal.fire({
                title: 'تعديل سعر الشحنة',
                html: `
                    <div class="space-y-4 text-right" dir="rtl">
                        <div>
                            <label class="block text-sm font-bold mb-1">نوع التعديل</label>
                            <select id="swal-edit-type" class="swal2-input !m-0 !w-full border border-slate-200 rounded-lg">
                                <option value="تعديل سعر" ${!isShippingType ? 'selected' : ''}>تعديل سعر</option>
                                <option value="شحن" ${isShippingType ? 'selected' : ''}>شحن</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-bold mb-1">المبلغ</label>
                            <input id="swal-edit-price" type="number" class="swal2-input !m-0 !w-full border border-slate-200 rounded-lg" value="${shipment.السعر_بعد_التعديل || shipment.المبلغ || ''}" step="0.01" min="0">
                        </div>
                        <div>
                            <label class="block text-sm font-bold mb-1">الملاحظات</label>
                            <input id="swal-edit-note" type="text" class="swal2-input !m-0 !w-full border border-slate-200 rounded-lg" value="${currentReason}" placeholder="اكتب الملاحظات التي ستُحفظ داخل سبب الحالة">
                        </div>
                    </div>
                `,
                focusConfirm: false,
                preConfirm: () => {
                    const type = document.getElementById('swal-edit-type').value;
                    const price = document.getElementById('swal-edit-price').value;
                    const note = document.getElementById('swal-edit-note').value.trim();
                    if (price === '' || price === null || Number(price) < 0) {
                        Swal.showValidationMessage('يرجى إدخال مبلغ صحيح');
                        return false;
                    }
                    if (!note) {
                        Swal.showValidationMessage('يرجى كتابة الملاحظات');
                        return false;
                    }
                    return { type, note, price: Number(price) };
                },
                showCancelButton: true,
                confirmButtonText: 'حفظ',
                cancelButtonText: 'إلغاء'
            });

            if (!formValues) return;

            const { type, note, price } = formValues;
            const isPriceEdit = type === 'تعديل سعر';
            const isShippingEdit = type === 'شحن';
            const newStatus = isPriceEdit ? 'تعديل سعر' : (isShippingEdit ? 'شحن' : type);
            const newReason = note;
            const baseCommission = parseFloat(String(shipment?.['عمولة المندوب'] ?? 0).replace(/[^0-9.-]+/g, '')) || 0;
            const calculatedCommission = baseCommission;
            const updatePayload = {
                الحالة: newStatus,
                'سبب الحالة': newReason,
                السعر_بعد_التعديل: price,
                'عمولة المندوب': calculatedCommission
            };

            const { error } = await supabaseClient
                .from(CONFIG.TABLES.SHIPMENTS)
                .update(toServerShipmentPayload(updatePayload))
                .eq('id', Number(id) || id);

            if (error) {
                console.error('Edit shipment price error:', error);
                Swal.fire('خطأ', error.message || 'فشل تعديل السعر', 'error');
                return;
            }

            const index = allShipments.findIndex(s => s.id == id);
            if (index !== -1) {
                allShipments[index].الحالة = newStatus;
                allShipments[index]['سبب الحالة'] = newReason;
                allShipments[index].سبب_الحالة = newReason;
                allShipments[index].السعر_بعد_التعديل = price;
                allShipments[index]['عمولة المندوب'] = calculatedCommission;
                syncFavoriteShipmentAfterStatusUpdate(id, getShipmentStatusLabel(allShipments[index]));
            }
            if (newStatus === 'تم' || newStatus === 'شحن' || newStatus === 'تعديل سعر') {
                lockShipmentForFurtherUpdates(id);
            }
            bumpShipmentsDataVersion();

            Swal.fire({
                icon: 'success',
                title: 'تم التعديل',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });
            renderShipments();
        }

        function sendWhatsApp(id, phoneKey = 'الهاتف') {
            const s = allShipments.find(x => x.id == id);
            if (!s) return;

            let phone = normalizeWhatsAppPhone(getShipmentPhone(s, phoneKey));
            if (!phone) {
                Swal.fire('تنبيه', 'لا يوجد رقم هاتف صالح', 'warning');
                return;
            }

            const text = `السلام عليكم يا فندم معاك مندوب شركة شحن لتوصيل أوردر لحضرتك:
📦 رقم الأوردر: #${s.order_id || '---'}
👤 العميل: ${s.اسم_العميل || '---'}
📍 العنوان: ${s.العنوان || '---'}
🗺️ المنطقة: ${s.الزون || '---'}
📦 المنتج: ${s.المنتج || s.المنتجات || '---'}
📱 التليفون: ${s.الهاتف || '---'}
📱 رقم بديل: ${s.هاتف_بديل || '---'}
💰 المبلغ: ${s.السعر_بعد_التعديل || s.المبلغ || 0}
🏢 الراسل: ${s.الراسل || '---'}

*برجاء الاستعداد لاستلامه*`;

            openContactChannelAndWaitForOutcome({
                shipmentId: id,
                method: phoneKey === 'هاتف بديل' ? 'واتساب هاتف بديل' : 'واتساب العميل'
            }, () => {
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
            });
        }

        function makePhoneCall(id, phoneKey = 'الهاتف') {
            const s = allShipments.find(x => x.id == id);
            if (!s) return;

            const phone = normalizeCallPhone(getShipmentPhone(s, phoneKey));
            if (!phone) {
                Swal.fire('تنبيه', 'لا يوجد رقم هاتف صالح', 'warning');
                return;
            }

            openContactChannelAndWaitForOutcome({
                shipmentId: id,
                method: phoneKey === 'هاتف بديل' ? 'اتصال هاتف بديل' : 'اتصال العميل'
            }, () => {
                window.location.href = `tel:${phone}`;
            });
        }

        async function logShipmentContactAttempt(id, method = 'تسجيل يدوي') {
            closeShipmentMenu();
            await promptForContactOutcome({
                shipmentId: id,
                method
            });
        }

        
