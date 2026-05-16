/**
 * محرك عرض الشحنات (Shipment Rendering Engine)
 * ملاحظة: تم تحسين هذا الملف لمنع قفز التمرير (Scroll Jump) وللعمل في الوضعين العادي والليلي.
 */

function renderShipments(append = false) {
    // 1. إدارة حدود العرض لمنع القفز
    if (append !== true) {
        currentDisplayLimit = Math.max(currentDisplayLimit || 40, 40);
        window.lastRenderedCount = 0;
    }
    pruneBulkSelection();

    const list = el('shipmentsList');
    const footer = el('shipmentsListFooter');
    const bulkActionBar = el('bulkActionBar');
    const listSummaryBar = el('listSummaryBar');
    if (!list) return;

    // 2. بناء التوقيع (Signature) للتحقق من التغييرات
    const filters = buildRenderFilters();
    const filterSignature = getFilterSignature(filters);
    const metaSignature = getMetaSignature(filters);

    // حماية التمرير: إذا لم يتغير شيء في الفلاتر أو البيانات، لا تقم بلمس الـ DOM
    const renderKey = `${filterSignature}_${metaSignature}_${areShipmentDetailsExpanded}_${currentActiveView}_${currentDisplayLimit}`;
    if (!append && window.lastFullRenderKey === renderKey) {
        updateFilterCounters(); // تحديث الأرقام فقط في الخلفية
        return;
    }
    if (!append) window.lastFullRenderKey = renderKey;

    // 3. تحديث القوائم المنسدلة والعدادات عند الحاجة فقط
    if (append !== true && metaSignature !== lastMetaSignature) {
        populateDropdowns();
        updateFilterCounters();
        lastMetaSignature = metaSignature;
    }

    // 4. التحقق من اختيار اليومية (إلزامي للعرض)
    if (currentActiveView !== 'favorites' && filters.dates.length === 0 && allShipments.length > 0) {
        if (bulkActionBar) bulkActionBar.classList.add('hidden');
        if (listSummaryBar) listSummaryBar.classList.add('hidden');
        if (footer) footer.innerHTML = '';
        list.innerHTML = `<div class="text-center py-10 opacity-40"><i class="fas fa-calendar-day text-5xl mb-3"></i><p class="font-bold">يرجى اختيار اليومية لعرض الشحنات</p></div>`;
        return;
    }

    renderActiveFilterSummary();

    // 5. الفلترة والترتيب الذكي
    if (filterSignature !== lastFilterSignature) {
        const filtered = filterShipmentsCollection(allShipments, filters);
        cachedFilteredShipments = currentActiveView === 'favorites'
            ? sortFavoriteShipmentsBySelectionOrder(filtered.filter(s => isFavoriteShipment(s.id)))
            : sortShipmentsSmart(filtered);

        cachedScopedShipments = currentActiveView === 'favorites'
            ? cachedFilteredShipments
            : cachedFilteredShipments.filter(s => !isFavoriteShipment(s.id));

        lastFilterSignature = filterSignature;
    }

    const scopedFiltered = cachedScopedShipments;

    // 6. التعامل مع النتائج الفارغة
    if (scopedFiltered.length === 0) {
        selectedShipmentIdsForBulk.clear();
        if (bulkActionBar) bulkActionBar.classList.add('hidden');
        if (listSummaryBar) listSummaryBar.classList.add('hidden');
        if (footer) footer.innerHTML = '';
        list.innerHTML = `<div class="text-center py-10 opacity-40"><i class="fas fa-box-open text-5xl mb-3"></i><p class="font-bold">لا يوجد شحنات تطابق البحث</p></div>`;
        return;
    }

    const itemsToRender = scopedFiltered.slice(0, currentDisplayLimit);
    const clientFrequencyMap = buildClientShipmentFrequencyMap(scopedFiltered);
    const hasEditableItems = itemsToRender.some(isShipmentBulkEditable);

    // تحديث شريط الإحصائيات
    if (listSummaryBar) {
        const visibleCountEl = el('visibleShipmentsCount');
        if (visibleCountEl) visibleCountEl.innerText = `${itemsToRender.length}/${scopedFiltered.length}`;
        listSummaryBar.classList.remove('hidden');
        listSummaryBar.classList.add('flex');
    }

    if (bulkActionBar) bulkActionBar.classList.toggle('hidden', !hasEditableItems);

    // 7. محرك الرسم (Mapping Function)
    const mapShipmentToHtml = s => {
        const canBulkEdit = isShipmentBulkEditable(s);
        const isSelected = selectedShipmentIdsForBulk.has(String(s.id));
        const isFavorite = isFavoriteShipment(s.id);
        const hideActions = shouldHideShipmentUpdateActions(s, filters.statuses);
        const statusLabel = getShipmentStatusLabel(s);
        const themeClass = getShipmentStatusThemeClass(s);
        const compactSummary = [`الزون: ${s.الزون || '---'}`, `المنتج: ${s.المنتج || '---'}`, `المبلغ: ${s.السعر_بعد_التعديل || s.المبلغ || 0}`].join(' • ');

        return `
        <div data-id="${s.id}" class="shipment-surface ${themeClass} p-3.5 sm:p-4 rounded-[1.7rem] relative overflow-hidden transition-all duration-300 mb-3 border border-slate-200 dark:border-slate-800">
            <div class="flex justify-between items-start mb-3 relative z-10">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1.5">
                        <label class="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 ${canBulkEdit ? 'bg-white dark:bg-slate-900 cursor-pointer shadow-sm' : 'bg-slate-100 dark:bg-slate-800 opacity-50'}">
                            <input type="checkbox" class="bulk-item-checkbox w-3.5 h-3.5 rounded text-cyan-600" data-id="${s.id}" data-action="toggle-shipment-selection" ${isSelected ? 'checked' : ''} ${canBulkEdit ? '' : 'disabled'}>
                        </label>
                        <button data-action="toggle-shipment-menu" data-id="${s.id}" class="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500"><i class="fas fa-ellipsis-v"></i></button>
                        <button data-action="toggle-favorite-shipment" data-id="${s.id}" class="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 ${isFavorite ? 'bg-rose-50 text-rose-500' : 'bg-white dark:bg-slate-800 text-slate-500'}"><i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i></button>
                    </div>
                    <span class="inline-flex px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/30 text-[9px] font-black text-sky-800 dark:text-cyan-300">#${s.order_id || s.id}</span>
                    <h3 class="text-[16px] font-black text-slate-900 dark:text-white leading-tight mt-1">${s.اسم_العميل || 'غير مسجل'}</h3>
                    ${renderShipmentInsightBadges(s, clientFrequencyMap)}
                </div>
                <div class="flex flex-col items-end gap-1.5">
                    <span class="shipment-status-ribbon ${getStatusBadgeClass(s)} px-2 py-1 rounded-lg font-black text-[10px]">${statusLabel}</span>
                    <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">الراسل: ${s.الراسل || '---'}</span>
                </div>
            </div>

            ${areShipmentDetailsExpanded ? `
            <div class="space-y-3 mb-4 relative z-10">
                <div class="flex items-start gap-2.5 p-2 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
                    <i class="fas fa-map-marked-alt text-slate-400"></i>
                    <span class="text-[12px] font-bold text-slate-800 dark:text-slate-200">${s.العنوان || 'بدون عنوان'}</span>
                </div>
                <div class="flex flex-wrap gap-2">
                    <div class="inline-flex items-center gap-2 rounded-xl bg-sky-50 dark:bg-sky-900/10 px-3 py-1.5 border border-sky-100 dark:border-sky-800"><i class="fas fa-map-pin text-[10px] text-sky-600"></i><span class="text-[11px] font-black text-slate-900 dark:text-white">${s.الزون || '---'}</span></div>
                    <div class="inline-flex items-center gap-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 px-3 py-1.5 border border-indigo-100 dark:border-indigo-800"><i class="fas fa-cube text-[10px] text-indigo-600"></i><span class="text-[11px] font-black text-slate-900 dark:text-white">${s.المنتج || '---'}</span></div>
                </div>
                <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div class="bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 rounded-2xl border border-emerald-100 dark:border-emerald-800 flex items-center gap-2">
                        <i class="fas fa-money-bill-wave text-emerald-600"></i>
                        <span class="text-[15px] font-black text-slate-900 dark:text-white">${s.السعر_بعد_التعديل || s.المبلغ || 0} <small class="text-[10px]">ج.م</small></span>
                    </div>
                    <div class="flex gap-1.5">${renderShipmentContactActions(s)}</div>
                </div>
            </div>
            ` : `<div class="mb-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">${compactSummary}</div>`}

            ${!hideActions && areShipmentDetailsExpanded ? `
            <div class="grid grid-cols-2 gap-2 mt-2 relative z-10">
                <button data-action="update-status" data-id="${s.id}" data-status="تم التسليم" class="bg-emerald-600 text-white py-3 rounded-2xl font-black text-[11px]">تم التسليم</button>
                <button data-action="update-status" data-id="${s.id}" data-status="مؤجل" class="bg-amber-500 text-white py-3 rounded-2xl font-black text-[11px]">مؤجل</button>
                <button data-action="reject-shipment" data-id="${s.id}" class="bg-rose-600 text-white py-3 rounded-2xl font-black text-[11px]">رفض</button>
                <button data-action="edit-price" data-id="${s.id}" class="bg-slate-700 text-white py-3 rounded-2xl font-black text-[11px]">تعديل سعر</button>
            </div>` : ''}
        </div>`;
    };

    // 8. التنفيذ الجراحي لتعديل الـ DOM لمنع قفز التمرير
    if (append && window.lastRenderedCount > 0) {
        // إضافة العناصر الجديدة فقط لنهاية القائمة
        const newItems = itemsToRender.slice(window.lastRenderedCount);
        if (newItems.length > 0) {
            list.insertAdjacentHTML('beforeend', newItems.map(mapShipmentToHtml).join(''));
        }
    } else {
        // تحديث كامل للقائمة فقط إذا تغير المحتوى فعلياً
        const fullHtml = itemsToRender.map(mapShipmentToHtml).join('');
        if (list.innerHTML !== fullHtml) {
            list.innerHTML = fullHtml;
        }
    }
    window.lastRenderedCount = itemsToRender.length;

    // 9. إدارة تذييل القائمة (Footer) بشكل مستقل
    if (footer) {
        if (scopedFiltered.length > currentDisplayLimit) {
            footer.innerHTML = `
                <div class="rounded-[2rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-center shadow-sm mb-10">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <button type="button" data-action="load-more-shipments" class="w-full rounded-2xl bg-slate-800 text-white px-4 py-3.5 text-sm font-black active:scale-[0.99] transition-all">
                            عرض المزيد (${scopedFiltered.length - currentDisplayLimit})
                        </button>
                        <button type="button" data-action="show-all-shipments" class="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3.5 text-sm font-black text-slate-700 dark:text-slate-100 active:scale-[0.99] transition-all">
                            عرض الكل (${scopedFiltered.length})
                        </button>
                    </div>
                    <div id="lazyLoadTrigger" class="text-slate-400 py-2">
                        <i class="fas fa-angles-down text-xl animate-bounce mb-2"></i>
                        <p class="text-[10px] font-black uppercase tracking-widest">مرر للتحميل التلقائي</p>
                    </div>
                </div>
            `;
            
            // تفعيل التحميل التلقائي عند الوصول للنهاية
            setTimeout(() => {
                const trigger = el('lazyLoadTrigger');
                if (trigger) {
                    const observer = new IntersectionObserver((entries) => {
                        if (entries[0].isIntersecting) {
                            observer.disconnect();
                            loadMoreShipments();
                        }
                    }, { rootMargin: '300px' });
                    observer.observe(trigger);
                }
            }, 100);
        } else {
            footer.innerHTML = '';
        }
    }

    saveRepUiState();
    updateBulkActionBar();
}

window.renderShipments = renderShipments;
