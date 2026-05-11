function renderShipments(append = false) {
            if (append !== true) currentDisplayLimit = Math.max(currentDisplayLimit || 40, 40);
            pruneBulkSelection();

            const list = el('shipmentsList');
            const bulkActionBar = el('bulkActionBar');
            const listSummaryBar = el('listSummaryBar');
            const filters = buildRenderFilters();
            const selectedDates = filters.dates;
            const selectedStatuses = filters.statuses;
            const filterSignature = getFilterSignature(filters);
            const metaSignature = getMetaSignature(filters);

            // Always populate dropdowns when meta signature changes
            if (append !== true && metaSignature !== lastMetaSignature) {
                populateDropdowns();
                updateFilterCounters();
                lastMetaSignature = metaSignature;
            }

            // Hide shipments view unless daily filter is selected
            if (currentActiveView !== 'favorites' && selectedDates.length === 0) {
                if(bulkActionBar) bulkActionBar.classList.add('hidden');
                if(listSummaryBar) listSummaryBar.classList.add('hidden');
                list.innerHTML = `
                    <div class="text-center py-10 opacity-40">
                        <i class="fas fa-calendar-day text-5xl mb-3"></i>
                        <p class="font-bold">يرجى اختيار اليومية لعرض الشحنات</p>
                        <p class="text-sm text-slate-500 mt-2">استخدم فلتر اليومية أعلاه لاختيار التاريخ المطلوب</p>
                    </div>
                `;
                return;
            }

            if (currentActiveView !== 'favorites' && selectedStatuses.length === 0 && !isFavoritesFilterSelected()) {
                if (bulkActionBar) bulkActionBar.classList.add('hidden');
                if (listSummaryBar) listSummaryBar.classList.add('hidden');
                list.innerHTML = `
                    <div class="text-center py-10 opacity-40">
                        <i class="fas fa-filter text-5xl mb-3"></i>
                        <p class="font-bold">يرجى اختيار الحالة لعرض الشحنات</p>
                        <p class="text-sm text-slate-500 mt-2">لن تظهر الشحنات إلا حسب فلتر الحالة المحدد</p>
                    </div>
                `;
                return;
            }

            renderActiveFilterSummary();

            if (filterSignature !== lastFilterSignature) {
                const filteredShipments = filterShipmentsCollection(allShipments, filters);
                cachedFilteredShipments = currentActiveView === 'favorites'
                    ? sortFavoriteShipmentsBySelectionOrder(filteredShipments.filter(s => isFavoriteShipment(s.id)))
                    : sortShipmentsSmart(filteredShipments);
                cachedScopedShipments = currentActiveView === 'favorites'
                    ? cachedFilteredShipments
                    : cachedFilteredShipments.filter(s => !isFavoriteShipment(s.id));
                lastFilterSignature = filterSignature;
            }

            const scopedFiltered = cachedScopedShipments;

            if (scopedFiltered.length === 0) {
                selectedShipmentIdsForBulk.clear();
                if(bulkActionBar) bulkActionBar.classList.add('hidden');
                if (listSummaryBar) listSummaryBar.classList.add('hidden');
                list.innerHTML = `
                    <div class="text-center py-10 opacity-40">
                        <i class="fas ${currentActiveView === 'favorites' ? 'fa-heart-crack' : 'fa-box-open'} text-5xl mb-3"></i>
                        <p class="font-bold">${currentActiveView === 'favorites' ? 'لا توجد شحنات داخل المفضلة' : 'لا يوجد شحنات تطابق البحث'}</p>
                    </div>
                `;
                return;
            }

            const itemsToRender = scopedFiltered.slice(0, currentDisplayLimit);
            const clientFrequencyMap = buildClientShipmentFrequencyMap(scopedFiltered);
            const hasEditableItems = itemsToRender.some(isShipmentBulkEditable);
            if (listSummaryBar) {
                const visibleCountEl = el('visibleShipmentsCount');
                const summaryTextEl = el('listSummaryText');
                if (visibleCountEl) visibleCountEl.innerText = `${itemsToRender.length}/${scopedFiltered.length}`;
                if (summaryTextEl) summaryTextEl.innerText = currentActiveView === 'favorites' ? 'الشحنات الظاهرة من المفضلة' : 'الشحنات الظاهرة من النتائج';
                listSummaryBar.classList.remove('hidden');
                listSummaryBar.classList.add('flex');
            }
            if(bulkActionBar) {
                if(hasEditableItems) {
                    bulkActionBar.classList.remove('hidden');
                } else {
                    bulkActionBar.classList.add('hidden');
                }
            }
            list.innerHTML = itemsToRender.map(s => {
                const canBulkEdit = isShipmentBulkEditable(s);
                const isSelected = selectedShipmentIdsForBulk.has(String(s.id));
                const isFavorite = isFavoriteShipment(s.id);
                const hideUpdateActions = shouldHideShipmentUpdateActions(s, selectedStatuses);
                const statusLabel = getShipmentStatusLabel(s);
                const statusThemeClass = getShipmentStatusThemeClass(s);
                return `
                <div data-shipment-card data-id="${s.id}" data-swipe-enabled="${!hideUpdateActions && !isShipmentUpdateLocked(s) ? 'true' : 'false'}" class="shipment-swipe-card shipment-surface ${statusThemeClass} p-3.5 sm:p-4 rounded-[1.7rem] relative overflow-hidden group transition-all duration-300 mb-2.5 sm:mb-3 border border-slate-200/70 dark:border-slate-800/80">
                    <div class="shipment-status-band ${getStatusColor(s)}"></div>
                    <div class="shipment-accent"></div>
                    <div class="shipment-status-watermark">${statusLabel}</div>
                    <div class="absolute top-0 right-0 w-1.5 h-full ${getStatusColor(s)}"></div>
                    
                    <div class="flex justify-between items-start mb-3 sm:mb-3.5 relative z-10">
                        <div class="flex-1">
                            <div class="flex items-center justify-between gap-2 mb-1.5">
                                <div class="flex items-center gap-1.5 sm:gap-2">
                                <label class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 ${canBulkEdit ? 'bg-white/90 dark:bg-slate-900 cursor-pointer shadow-sm' : 'bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed'}" title="${canBulkEdit ? 'تحديد الشحنة' : 'هذه الشحنة مغلقة أو تمت تسويتها'}">
                                    <input
                                        type="checkbox"
                                        class="bulk-item-checkbox w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300 cursor-pointer"
                                        data-id="${s.id}"
                                        data-action="toggle-shipment-selection"
                                        ${isSelected ? 'checked' : ''}
                                        ${canBulkEdit ? '' : 'disabled'}
                                    >
                                </label>
                                <button
                                    type="button"
                                    data-action="toggle-shipment-menu"
                                    data-id="${s.id}"
                                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800 text-slate-500 dark:text-slate-200 shadow-sm transition-all hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95"
                                    title="نسخ بيانات الشحنة"
                                    aria-label="نسخ بيانات الشحنة"
                                >
                                    <i class="fas fa-ellipsis-v text-sm"></i>
                                </button>
                                <button data-action="toggle-favorite-shipment" data-id="${s.id}" class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl ${isFavorite ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-300 border-rose-100 dark:border-rose-800 shadow-sm' : 'bg-slate-50/90 dark:bg-slate-800 text-slate-500 dark:text-slate-200 hover:text-rose-500 dark:hover:text-rose-300 border-slate-100 dark:border-slate-700'} border transition-all" title="${isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}" aria-label="${isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}">
                                    <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                                </button>
                                </div>
                            </div>
                            <span class="inline-flex items-center mb-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/30 px-2 py-0.5 text-[9px] sm:text-[10px] font-black text-sky-800 dark:text-cyan-300 border border-cyan-100/70 dark:border-cyan-800/50">#${s.order_id || s['كود الشحنة'] || s.id || '---'}</span>
                            <h3 class="text-[15px] sm:text-[17px] font-black text-slate-900 dark:text-white leading-tight">${s.اسم_العميل || 'غير مسجل'}</h3>
                            ${renderShipmentInsightBadges(s, clientFrequencyMap)}
                        </div>
                        <div class="flex flex-col items-end gap-1.5">
                            <span class="shipment-status-ribbon ${getStatusBadgeClass(s)}">
                                <i class="fas fa-layer-group text-[9px]"></i>
                                ${statusLabel}
                            </span>
                            <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-[10px] font-black text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/40">
                                <i class="fas fa-phone-volume text-[9px]"></i>
                                ${getShipmentCallAttempts(s)} محاولة
                            </span>
                            <span class="text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-300 text-right max-w-[180px] truncate">
                                الراسل: ${s.الراسل || '---'}
                            </span>
                            ${[getShipmentLastContactMethod(s), formatLastContactAt(getShipmentLastContactAt(s))].filter(Boolean).length ? `
                            <span class="text-[9px] text-slate-400 dark:text-slate-500 text-right max-w-[180px] leading-relaxed">
                                ${[getShipmentLastContactMethod(s), formatLastContactAt(getShipmentLastContactAt(s))].filter(Boolean).join(' • ')}
                            </span>
                            ` : ''}
                        </div>
                    </div>

                    <div class="space-y-2 mb-3.5 sm:space-y-2.5 sm:mb-4 relative z-10">
                        <div class="flex items-start gap-2.5 p-2 sm:p-2.5 rounded-2xl -mx-1 sm:-mx-2 relative z-10">
                            <i class="fas fa-map-marked-alt text-sm sm:text-base mt-0.5 text-slate-400 dark:text-slate-500"></i>
                            <span class="text-[12px] sm:text-[13px] font-bold text-slate-800 dark:text-slate-200 leading-snug">${s.العنوان || 'بدون عنوان'}</span>
                        </div>
                        <div class="flex items-center gap-2 text-slate-500 dark:text-slate-300 px-1">
                            <i class="fas fa-cube text-xs"></i>
                            <span class="text-xs font-semibold">${s.المنتج || s.المنتجات || 'بدون منتج'}</span>
                        </div>
                        
                        <div class="mt-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="inline-flex max-w-full items-center gap-2 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/90 dark:bg-emerald-950/20 px-2.5 py-1.5 shadow-sm">
                                    <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-white/80 dark:bg-emerald-950/40">
                                        <i class="fas fa-wallet text-[11px] text-emerald-600 dark:text-emerald-300"></i>
                                    </div>
                                    <span class="text-[9px] font-bold text-emerald-700 dark:text-emerald-300">المبلغ</span>
                                    <span class="whitespace-nowrap text-[11px] sm:text-[13px] font-black text-slate-900 dark:text-white leading-tight">${s.السعر_بعد_التعديل || s.المبلغ || 0} <small class="text-[8px] font-bold opacity-60 dark:opacity-80">ج.م</small></span>
                                </div>
                                <div class="flex shrink-0 justify-start">
                                    ${renderShipmentContactActions(s)}
                                </div>
                            </div>
                        </div>
                    </div>

                    ${hideUpdateActions ? '' : `
                    <div class="mt-1.5 space-y-2 relative z-10">
                        <div class="grid grid-cols-2 gap-2">
                            <button data-action="update-status" data-id="${s.id}" data-status="تم التسليم" ${isShipmentUpdateLocked(s) ? 'disabled' : ''} class="shipment-action-btn bg-gradient-to-l from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white py-3 px-2 rounded-2xl font-black text-[11px] leading-none shadow-lg shadow-emerald-200/80 active:scale-95 transition-all">تم التسليم</button>
                            <button data-action="update-status" data-id="${s.id}" data-status="مؤجل" ${isShipmentUpdateLocked(s) ? 'disabled' : ''} class="shipment-action-btn bg-gradient-to-l from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-white py-3 px-2 rounded-2xl font-black text-[11px] leading-none shadow-lg shadow-amber-200/80 active:scale-95 transition-all">مؤجل</button>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <button data-action="reject-shipment" data-id="${s.id}" ${isShipmentUpdateLocked(s) ? 'disabled' : ''} class="shipment-action-btn bg-gradient-to-l from-rose-600 to-red-500 hover:from-rose-700 hover:to-red-600 text-white py-3 px-2 rounded-2xl font-black text-[11px] leading-none shadow-lg shadow-rose-200/80 active:scale-95 transition-all">رفض</button>
                            <button data-action="edit-price" data-id="${s.id}" ${isShipmentUpdateLocked(s) ? 'disabled' : ''} class="shipment-action-btn bg-gradient-to-l from-slate-700 to-sky-700 hover:from-slate-800 hover:to-sky-800 text-white py-3 px-2 rounded-2xl font-black text-[11px] leading-none shadow-lg shadow-slate-200/80 active:scale-95 transition-all">تعديل السعر / شحن</button>
                        </div>
                    </div>
                    `}
                    ${isShipmentUpdateLocked(s) ? `
                        <div class="mt-2.5 rounded-2xl border border-amber-200/70 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-center text-[10px] font-black text-amber-700 dark:text-amber-300 relative z-10">
                            هذه الشحنة لا يمكن تعديلها مرة أخرى
                        </div>
                    ` : ''}
                </div>
            `}).join('');
            
            if (scopedFiltered.length > currentDisplayLimit) {
                const remainingCount = Math.max(scopedFiltered.length - currentDisplayLimit, 0);
                list.innerHTML += `
                    <div class="mt-2 rounded-[1.6rem] border border-slate-200/80 dark:border-slate-700 bg-white/85 dark:bg-slate-900/70 p-3 text-center shadow-sm">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                                type="button"
                                data-action="load-more-shipments"
                                class="w-full rounded-2xl bg-gradient-to-l from-[#0F4C81] to-cyan-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-200/60 transition-all hover:from-[#0c3d68] hover:to-cyan-700 active:scale-[0.99]"
                            >
                                عرض المزيد (${remainingCount})
                            </button>
                            <button
                                type="button"
                                data-action="show-all-shipments"
                                class="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-black text-slate-700 dark:text-slate-100 shadow-sm transition-all hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.99]"
                            >
                                عرض الكل (${scopedFiltered.length})
                            </button>
                        </div>
                        <div id="lazyLoadTrigger" class="pt-3 text-slate-400">
                            <i class="fas fa-angles-down text-lg mb-1"></i>
                            <p class="text-[10px] font-bold">يمكنك أيضًا النزول لأسفل ليتم تحميل المزيد تلقائيًا</p>
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    const trigger = document.getElementById('lazyLoadTrigger');
                    if (trigger) {
                        const observer = new IntersectionObserver((entries) => {
                            if (entries[0].isIntersecting) {
                                observer.disconnect();
                                loadMoreShipments();
                            }
                        }, { rootMargin: '300px' });
                        observer.observe(trigger);
                    }
                }, 50);
            }
            saveRepUiState();
            updateBulkActionBar();
        }

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

        el('searchInput').addEventListener('input', () => {
            clearTimeout(searchRenderTimer);
            searchRenderTimer = setTimeout(() => {
                renderShipments();
            }, 180);
            saveRepUiState();
        });
        el('clearFiltersBtn')?.addEventListener('click', clearAllRepFilters);

        el('trackingToggleBtn')?.addEventListener('click', toggleTracking);
        el('quickActionsToggleBtn')?.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleQuickActionsMenu();
        });
        el('gpsToggleBtn')?.addEventListener('click', () => {
            toggleGpsMap();
            closeQuickActionsMenu();
        });
        el('gpsRequiredActionBtn')?.addEventListener('click', () => {
            ensureGpsReadyAndLoadShipments(true);
        });
        el('themeToggleBtn')?.addEventListener('click', () => {
            toggleTheme();
            closeQuickActionsMenu();
        });
        el('logoutBtn')?.addEventListener('click', () => {
            closeQuickActionsMenu();
            logout();
        });
        el('bulkUpdateBtn')?.addEventListener('click', applyBulkUpdate);
        el('copyShipmentMenuBtn')?.addEventListener('click', copyShipmentDataFromMenu);
        el('editPriceMenuBtn')?.addEventListener('click', editPriceFromMenu);
        el('delayShipmentMenuBtn')?.addEventListener('click', delayShipmentFromMenu);
        el('rejectShipmentMenuBtn')?.addEventListener('click', rejectShipmentFromMenu);
        el('logCallAttemptMenuBtn')?.addEventListener('click', () => {
            if (!activeShipmentMenuId) return;
            logShipmentContactAttempt(activeShipmentMenuId);
        });
        el('markAllRepNotificationsReadBtn')?.addEventListener('click', markAllRepNotificationsAsRead);
        el('clearRepNotificationsBtn')?.addEventListener('click', clearRepNotifications);
        el('menuDashboardBtn')?.addEventListener('click', () => {
            if (currentActiveView === 'favorites') {
                exitFavoritesView();
            } else {
                switchRepView('dashboard');
            }
            closeQuickActionsMenu();
        });
        el('nav-btn-notifications')?.addEventListener('click', (event) => {
            event.stopPropagation();
            closeQuickActionsMenu();
            toggleRepNotificationsPanel();
        });
        el('filterDateSelect')?.addEventListener('change', (event) => toggleDateSelection(event.target.value));
        el('filterStatus')?.addEventListener('change', (event) => toggleStatusSelection(event.target.value));
        el('filterZone')?.addEventListener('change', (event) => toggleZoneSelection(event.target.value));
        el('filterSender')?.addEventListener('change', (event) => toggleSenderSelection(event.target.value));
        el('bulkStatusSelect')?.addEventListener('change', updateBulkActionBar);
        el('shipmentsList')?.addEventListener('change', (event) => {
            const shipmentCheckbox = event.target.closest('[data-action="toggle-shipment-selection"]');
            if (!shipmentCheckbox) return;
            toggleShipmentSelection(shipmentCheckbox.dataset.id);
        });
        el('shipmentsList')?.addEventListener('touchstart', (event) => {
            if (!isMobileSwipeViewport()) return;
            if (!canStartShipmentSwipe(event.target)) return;

            const card = event.target.closest('[data-shipment-card]');
            if (!card || card.dataset.swipeEnabled !== 'true') return;

            const touch = event.touches[0];
            shipmentSwipeState = {
                card,
                shipmentId: card.dataset.id,
                startX: touch.clientX,
                startY: touch.clientY,
                deltaX: 0,
                deltaY: 0,
                isDragging: false,
                lockedAxis: null
            };
        }, { passive: true });

        el('shipmentsList')?.addEventListener('touchmove', (event) => {
            if (!shipmentSwipeState || !isMobileSwipeViewport()) return;

            const touch = event.touches[0];
            shipmentSwipeState.deltaX = touch.clientX - shipmentSwipeState.startX;
            shipmentSwipeState.deltaY = touch.clientY - shipmentSwipeState.startY;

            if (!shipmentSwipeState.lockedAxis) {
                if (Math.abs(shipmentSwipeState.deltaX) < 10 && Math.abs(shipmentSwipeState.deltaY) < 10) return;
                shipmentSwipeState.lockedAxis = Math.abs(shipmentSwipeState.deltaX) > Math.abs(shipmentSwipeState.deltaY) ? 'x' : 'y';
            }

            if (shipmentSwipeState.lockedAxis !== 'x') return;

            shipmentSwipeState.isDragging = true;
            if (event.cancelable) event.preventDefault();
            applyShipmentSwipeVisual(shipmentSwipeState.card, shipmentSwipeState.deltaX);
        }, { passive: false });

        el('shipmentsList')?.addEventListener('touchend', async () => {
            if (!shipmentSwipeState) return;

            const { card, shipmentId, deltaX, isDragging, lockedAxis } = shipmentSwipeState;
            shipmentSwipeState = null;

            if (!card) return;

            const swipeThreshold = 95;
            if (isDragging && lockedAxis === 'x' && Math.abs(deltaX) >= swipeThreshold) {
                suppressShipmentClickUntil = Date.now() + 400;
                resetShipmentSwipeCard(card);
                await handleShipmentSwipeAction(shipmentId, deltaX > 0 ? 'right' : 'left');
                return;
            }

            resetShipmentSwipeCard(card);
        }, { passive: true });

        el('shipmentsList')?.addEventListener('touchcancel', () => {
            if (!shipmentSwipeState) return;
            resetShipmentSwipeCard(shipmentSwipeState.card);
            shipmentSwipeState = null;
        }, { passive: true });

        el('shipmentsList')?.addEventListener('click', (event) => {
            if (Date.now() < suppressShipmentClickUntil) return;
            const actionEl = event.target.closest('[data-action]');
            if (!actionEl || actionEl.disabled) return;

            const action = actionEl.dataset.action;
            const id = actionEl.dataset.id;

            if (action === 'toggle-shipment-menu') {
                toggleShipmentMenu(event, id);
                return;
            }
            if (action === 'show-all-shipments') {
                showAllShipments();
                return;
            }
            if (action === 'toggle-favorite-shipment') {
                toggleFavoriteShipment(id);
                return;
            }
            if (action === 'copy-shipment-data') {
                copyShipmentData(id);
                return;
            }
            if (action === 'update-status') {
                updateStatus(id, actionEl.dataset.status);
                return;
            }
            if (action === 'edit-price') {
                editPrice(id);
                return;
            }
            if (action === 'reject-shipment') {
                handleRejectAction(id);
                return;
            }
            if (action === 'load-more-shipments') {
                loadMoreShipments();
                return;
            }
            if (action === 'send-whatsapp') {
                sendWhatsApp(id, actionEl.dataset.phoneKey || 'الهاتف');
                return;
            }
            if (action === 'call-phone') {
                makePhoneCall(id, actionEl.dataset.phoneKey || 'الهاتف');
                return;
            }
            if (action === 'open-map') {
                openTrackingMap(id);
                return;
            }
        });

        document.addEventListener('click', (event) => {
            const menu = el('shipmentMenu');
            if (menu && !menu.contains(event.target)) {
                closeShipmentMenu();
            }
            const quickActionsMenu = el('quickActionsMenu');
            const quickActionsBtn = el('quickActionsToggleBtn');
            if (isQuickActionsMenuOpen && quickActionsMenu && quickActionsBtn && !quickActionsMenu.contains(event.target) && !quickActionsBtn.contains(event.target)) {
                closeQuickActionsMenu();
            }
            const notifPanel = el('repNotificationsPanel');
            const notifBtn = el('nav-btn-notifications');
            if (isNotificationsPanelOpen && notifPanel && notifBtn && !notifPanel.contains(event.target) && !notifBtn.contains(event.target)) {
                closeRepNotificationsPanel();
            }
            const zoneBtn = el('filterZoneBtn');
            const zoneMenu = el('filterZoneMenu');
            const senderBtn = el('filterSenderBtn');
            const senderMenu = el('filterSenderMenu');

            if (zoneBtn && zoneMenu && !zoneBtn.contains(event.target) && !zoneMenu.contains(event.target)) {
                zoneMenu.classList.add('hidden');
            }
            if (senderBtn && senderMenu && !senderBtn.contains(event.target) && !senderMenu.contains(event.target)) {
                senderMenu.classList.add('hidden');
            }
        });
        window.addEventListener('focus', () => {
            setTimeout(() => {
                flushPendingContactOutcomePrompt();
                ensureGpsReadyAndLoadShipments(false);
            }, 250);
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => {
                    flushPendingContactOutcomePrompt();
                    ensureGpsReadyAndLoadShipments(false);
                }, 250);
            }
        });
        window.addEventListener('resize', closeShipmentMenu);
        window.addEventListener('scroll', closeShipmentMenu);

        