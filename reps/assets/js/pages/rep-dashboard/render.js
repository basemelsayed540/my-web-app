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

        
