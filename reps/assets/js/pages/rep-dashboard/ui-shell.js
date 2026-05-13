function switchRepView(viewId, options = {}) {
            const { skipRender = false, skipSave = false } = options;
            if (viewId === 'favorites' && !statusFilterSelections.has(FAVORITES_FILTER_VALUE)) {
                statusFilterSelections.clear();
                statusFilterSelections.add(FAVORITES_FILTER_VALUE);
            }
            currentActiveView = viewId;
            const dashboardView = document.getElementById('dashboard-view');
            const dashBtn = document.getElementById('menuDashboardBtn');

            // CRITICAL FIX: Do NOT close notifications panel automatically during data refresh
            // closeRepNotificationsPanel();

            [dashBtn].forEach(btn => {
                btn?.classList.remove('bg-cyan-50', 'dark:bg-cyan-950/30', 'text-sky-800', 'dark:text-cyan-300');
                btn?.classList.add('text-slate-700', 'dark:text-slate-100');
            });

            dashboardView?.classList.remove('hidden');
            if (viewId !== 'favorites') dashBtn?.classList.add('bg-cyan-50', 'dark:bg-cyan-950/30', 'text-sky-800', 'dark:text-cyan-300');
            if (!skipSave) saveRepUiState();
            if (!skipRender) renderShipments();
        }

        function syncQuickStatCards() {
            return;
        }

        function isMobileSwipeViewport() {
            return false;
        }

        function resetShipmentSwipeCard(card, animate = true) {
            if (!card) return;
            card.style.transition = animate ? 'transform 180ms ease, background 180ms ease' : '';
            card.style.transform = 'translateX(0px)';
            card.style.background = '';
        }

        function applyShipmentSwipeVisual(card, deltaX) {
            if (!card) return;
            const limitedX = Math.max(-120, Math.min(120, deltaX));
            const progress = Math.min(Math.abs(limitedX) / 120, 1);
            card.style.transition = 'none';
            card.style.transform = `translateX(${limitedX}px)`;

            if (limitedX > 0) {
                card.style.background = `linear-gradient(90deg, rgba(16,185,129,${0.18 + progress * 0.18}) 0%, rgba(255,255,255,0) 65%)`;
            } else if (limitedX < 0) {
                card.style.background = `linear-gradient(270deg, rgba(245,158,11,${0.18 + progress * 0.18}) 0%, rgba(255,255,255,0) 65%)`;
            } else {
                card.style.background = '';
            }
        }

        function canStartShipmentSwipe(target) {
            return !target.closest('button, a, input, select, textarea, label, [data-action]');
        }

        function closeQuickActionsMenu() {
            const menu = el('quickActionsMenu');
            if (!menu) return;
            menu.classList.add('hidden');
            isQuickActionsMenuOpen = false;
        }

        function toggleQuickActionsMenu(forceState = null) {
            const menu = el('quickActionsMenu');
            if (!menu) return;
            const shouldOpen = typeof forceState === 'boolean' ? forceState : menu.classList.contains('hidden');
            if (shouldOpen) {
                closeRepNotificationsPanel();
            }
            menu.classList.toggle('hidden', !shouldOpen);
            isQuickActionsMenuOpen = shouldOpen;
        }

        function setShipmentMenuMode(mode = 'copy') {}

        function openShipmentMenuAtPosition(shipmentId, left, top, mode = 'copy') {
            const menu = document.getElementById('shipmentMenu');
            if (!menu) return;

            const isOpenForSameShipment = activeShipmentMenuId === shipmentId && activeShipmentMenuMode === mode && !menu.classList.contains('hidden');
            if (isOpenForSameShipment) {
                closeShipmentMenu();
                return;
            }

            activeShipmentMenuId = shipmentId;
            activeShipmentMenuMode = mode;
            setShipmentMenuMode(mode);
            menu.classList.remove('hidden');
            setShipmentMenuActionState(isShipmentUpdateLocked(shipmentId));

            const menuWidth = 220;
            const menuHeight = menu.offsetHeight || 220;
            const resolvedLeft = Math.max(12, Math.min(left, window.innerWidth - menuWidth - 12));
            const resolvedTop = Math.max(12, Math.min(top, window.innerHeight - menuHeight - 12));

            menu.style.left = `${resolvedLeft}px`;
            menu.style.top = `${resolvedTop}px`;
        }

        async function handleShipmentSwipeAction(shipmentId, direction) {
            if (!shipmentId) return;

            if (direction === 'right') {
                await updateStatus(shipmentId, 'تم التسليم');
                return;
            }

            const card = document.querySelector(`[data-shipment-card][data-id="${shipmentId}"]`);
            if (!card) return;

            const rect = card.getBoundingClientRect();
            openShipmentMenuAtPosition(
                shipmentId,
                rect.left + 12,
                rect.top + Math.min(rect.height, 120)
            );
        }

        let notificationAudioContext = null;
        let dateFilterSelections = new Set();
        let statusFilterSelections = new Set();
        let zoneFilterSelections = new Set();
        let senderFilterSelections = new Set();
        const FAVORITES_FILTER_VALUE = '__favorites__';
        let dateFilterGlowTimeout = null;
        let hasPromptedDateFilterOnOpen = false;
        const STATUS_OPTIONS = ['قيد التوصيل', 'تم', 'مؤجل', 'رفض', 'تعديل سعر', 'شحن'];
        let gpsGateUnlocked = false;
        let gpsGateCheckInFlight = false;
        let gpsPermissionStatus = null;
        let gpsEnforcementTimer = null;
        let gpsSettingsRefreshTimer = null;
        let isQuickActionsMenuOpen = false;

        function el(id) {
            return document.getElementById(id);
        }

        let repStickyHeaderObserver = null;

        function updateRepStickyOffsets() {
            const header = document.querySelector('header.hero-shell');
            if (!header) return;

            const headerHeight = Math.ceil(header.getBoundingClientRect().height || header.offsetHeight || 0);
            const stickyOffset = headerHeight;
            document.documentElement.style.setProperty('--rep-header-sticky-offset', `${stickyOffset}px`);

            const statsPanel = document.getElementById('stats-sticky-panel');
            if (statsPanel) {
                const statsHeight = Math.ceil(statsPanel.getBoundingClientRect().height || statsPanel.offsetHeight || 0);
                document.documentElement.style.setProperty('--rep-filters-sticky-offset', `${stickyOffset + statsHeight}px`);
            }
        }

        let currentFilterTab = 'date';

        function updateFilterChipsUI() {
            const container = el('filterChipsContainer');
            if (!container) return;

            const tabs = document.querySelectorAll('[data-filter-tab]');
            tabs.forEach(tab => {
                if (tab.dataset.filterTab === currentFilterTab) tab.classList.add('active');
                else tab.classList.remove('active');
            });

            let selectId = '';
            if (currentFilterTab === 'date') selectId = 'filterDateSelect';
            else if (currentFilterTab === 'status') selectId = 'filterStatus';
            else if (currentFilterTab === 'zone') selectId = 'filterZone';
            else if (currentFilterTab === 'sender') selectId = 'filterSender';

            const select = el(selectId);
            if (!select) return;

            const options = Array.from(select.options);
            const selectedValue = select.value;

            container.innerHTML = options.map(opt => `
                <div class="filter-chip ${opt.value === selectedValue ? 'selected' : ''}" data-value="${opt.value}" data-select-id="${selectId}">
                    ${opt.text}
                </div>
            `).join('');

            // Scroll to selected chip
            setTimeout(() => {
                container.querySelector('.filter-chip.selected')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }, 50);
        }

        function switchFilterTab(tabId) {
            currentFilterTab = tabId;
            updateFilterChipsUI();
        }

        function handleChipClick(chip) {
            const selectId = chip.dataset.selectId;
            const value = chip.dataset.value;
            const select = el(selectId);
            if (!select) return;

            select.value = value;

            // Trigger the change event manually to run existing filtering logic
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);

            updateFilterChipsUI();
        }

        function bindRepStickyOffsetSync() {
            updateRepStickyOffsets();

            if (typeof ResizeObserver === 'undefined') return;

            const header = document.querySelector('header.hero-shell');
            if (!header) return;

            repStickyHeaderObserver?.disconnect();
            repStickyHeaderObserver = new ResizeObserver(() => updateRepStickyOffsets());
            repStickyHeaderObserver.observe(header);
        }

        function getElementValue(id) {
            return el(id)?.value || '';
        }

        function getSingleSelectFilter(id) {
            const value = String(getElementValue(id) || '').trim();
            return !value || value === 'الكل' ? [] : [value];
        }

        function applyActiveSelectState(select, selectedArr, defaultValue = 'الكل') {
            if (!select) return;

            if (selectedArr.length > 0 && selectedArr[0] !== '' && selectedArr[0] !== 'الكل') {
                select.value = selectedArr[0];
                select.classList.add('filter-active-state');
            } else {
                select.value = defaultValue;
                select.classList.remove('filter-active-state');
            }
        }

        function getSelectedStatuses() {
            return Array.from(statusFilterSelections).filter(status => status !== FAVORITES_FILTER_VALUE);
        }

        function isFavoritesFilterSelected() {
            return statusFilterSelections.has(FAVORITES_FILTER_VALUE);
        }

        function rememberCurrentNonFavoritesStatuses() {
            const statuses = getSelectedStatuses().filter(status => STATUS_OPTIONS.includes(status));
            if (statuses.length > 0) {
                lastNonFavoritesStatusSelections = new Set(statuses);
            }
        }

        function restoreStatusSelectionAfterFavorites() {
            statusFilterSelections.clear();
            const preferredStatuses = [...lastNonFavoritesStatusSelections].filter(status => STATUS_OPTIONS.includes(status));
            if (preferredStatuses.length > 0) {
                preferredStatuses.forEach(status => statusFilterSelections.add(status));
                return;
            }
            statusFilterSelections.add('قيد التوصيل');
        }

        function exitFavoritesView(options = {}) {
            restoreStatusSelectionAfterFavorites();
            switchRepView('dashboard', options);
            fillStatusDropdown();
        }

        function syncFavoriteShipmentAfterStatusUpdate(shipmentId, nextStatusLabel = '') {
            const strId = String(shipmentId || '');
            if (!strId || !favoriteShipmentIds.has(strId)) return;

            favoriteShipmentIds.delete(strId);
            saveFavoriteShipmentIds(favoriteShipmentIds);
            updateFavoritesNavBadge();
            invalidateShipmentRenderCache();

            if (currentActiveView !== 'favorites') return;

            const normalizedStatusLabel = String(nextStatusLabel || '').trim();
            statusFilterSelections.clear();
            if (normalizedStatusLabel && STATUS_OPTIONS.includes(normalizedStatusLabel)) {
                statusFilterSelections.add(normalizedStatusLabel);
                lastNonFavoritesStatusSelections = new Set([normalizedStatusLabel]);
            } else {
                restoreStatusSelectionAfterFavorites();
            }

            switchRepView('dashboard', { skipRender: true, skipSave: true });
            saveRepUiState();
        }

        function getSelectedDates() {
            return Array.from(dateFilterSelections);
        }

        function setGpsRequiredMessage(message) {
            const messageEl = el('gpsRequiredMessage');
            if (messageEl) messageEl.innerText = message;
        }

        function lockGpsGate(message) {
            if (!gpsEnforcementRequired) {
                unlockGpsGate();
                return;
            }

            // Check if we already have permission before showing the lock
            if (navigator.permissions?.query) {
                navigator.permissions.query({ name: 'geolocation' }).then(permission => {
                    if (permission.state === 'granted') {
                        unlockGpsGate();
                        return;
                    }
                    showGpsLock(message);
                });
            } else {
                showGpsLock(message);
            }
        }

        function showGpsLock(message) {
            gpsGateUnlocked = false;
            el('gpsRequiredOverlay')?.classList.remove('hidden');
            if (message) setGpsRequiredMessage(message);
            const list = el('shipmentsList');
            if (list) {
                list.innerHTML = `
                    <div class="text-center py-10 opacity-70">
                        <i class="fas fa-location-crosshairs text-5xl mb-3 text-sky-500"></i>
                        <p class="font-bold">يجب تشغيل الموقع أولًا لعرض الشحنات</p>
                    </div>
                `;
            }
        }

        function unlockGpsGate() {
            gpsGateUnlocked = true;
            el('gpsRequiredOverlay')?.classList.add('hidden');
        }

        async function ensureTrackingActivated() {
            if (!trackingSystem) return;
            try {
                if (!trackingSystem.isTracking) {
                    await trackingSystem.toggleShift();
                    updateTrackingUI();
                }
            } catch (error) { }
        }

        async function requestGpsAccessAndUnlock(forcePrompt = false) {
            await refreshGpsEnforcementSetting();
            if (!gpsEnforcementRequired) {
                unlockGpsGate();
                return true;
            }
            if (gpsGateCheckInFlight) return gpsGateUnlocked;
            gpsGateCheckInFlight = true;

            try {
                setGpsRequiredMessage('جاري التحقق من صلاحية الموقع...');

                if (!navigator.geolocation) {
                    lockGpsGate('هذا المتصفح لا يدعم تحديد الموقع. استخدم جهازًا يدعم GPS.');
                    return false;
                }

                if (!forcePrompt && navigator.permissions?.query) {
                    try {
                        const permission = await navigator.permissions.query({ name: 'geolocation' });
                        if (permission.state === 'denied') {
                            lockGpsGate('تم رفض صلاحية الموقع. فعّل الموقع من إعدادات المتصفح ثم أعد المحاولة.');
                            return false;
                        }
                    } catch (error) { }
                }

                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 12000,
                        maximumAge: 0
                    });
                });

                unlockGpsGate();
                await ensureTrackingActivated();
                return true;
            } catch (error) {
                lockGpsGate('يجب تشغيل GPS والسماح بالموقع أولًا حتى تتمكن من متابعة الشحنات.');
                return false;
            } finally {
                gpsGateCheckInFlight = false;
            }
        }

        async function enforceGpsStillEnabled() {
            await refreshGpsEnforcementSetting();
            if (!gpsEnforcementRequired) {
                unlockGpsGate();
                return;
            }
            if (!gpsGateUnlocked || gpsGateCheckInFlight) return;

            if (navigator.permissions?.query) {
                try {
                    const permission = gpsPermissionStatus || await navigator.permissions.query({ name: 'geolocation' });
                    gpsPermissionStatus = permission;
                    if (permission.state === 'denied') {
                        lockGpsGate('تم إيقاف صلاحية الموقع. يجب إعادة تفعيلها لمتابعة استخدام الحساب.');
                        return;
                    }
                } catch (error) { }
            }

            try {
                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: false,
                        timeout: 8000,
                        maximumAge: 15000
                    });
                });
            } catch (error) {
                lockGpsGate('تم إيقاف GPS أو تعذر الوصول للموقع. فعّل الموقع من جديد للمتابعة.');
            }
        }

        async function startGpsEnforcement() {
            await refreshGpsEnforcementSetting({ force: true });
            if (navigator.permissions?.query) {
                try {
                    gpsPermissionStatus = await navigator.permissions.query({ name: 'geolocation' });
                    gpsPermissionStatus.onchange = () => {
                        if (!gpsEnforcementRequired) return;
                        if (gpsPermissionStatus.state === 'denied') {
                            lockGpsGate('تم إيقاف صلاحية الموقع. يجب إعادة تفعيلها لمتابعة استخدام الحساب.');
                            return;
                        }
                        if (gpsPermissionStatus.state === 'granted') {
                            ensureGpsReadyAndLoadShipments(false);
                        }
                    };
                } catch (error) { }
            }

            if (gpsEnforcementTimer) clearInterval(gpsEnforcementTimer);
            gpsEnforcementTimer = setInterval(() => {
                enforceGpsStillEnabled();
            }, 300000);

            if (gpsSettingsRefreshTimer) clearInterval(gpsSettingsRefreshTimer);
            gpsSettingsRefreshTimer = setInterval(async () => {
                const previous = gpsEnforcementRequired;
                const current = await refreshGpsEnforcementSetting({ force: true });
                if (!current) {
                    unlockGpsGate();
                    return;
                }
                if (!previous && current) {
                    ensureGpsReadyAndLoadShipments(false);
                }
            }, GPS_ENFORCEMENT_REFRESH_MS);
        }

        async function ensureGpsReadyAndLoadShipments(forcePrompt = false) {
            // 1. Check Internet
            if (!navigator.onLine) {
                lockGpsGate('لا يوجد اتصال بالإنترنت. يرجى الاتصال بالشبكة للمتابعة.');
                return false;
            }

            // 2. Check Notifications Permission (Mandatory for Badge/Sound)
            try {
                if (typeof Capacitor !== 'undefined' && Capacitor.Plugins.LocalNotifications) {
                    const perm = await Capacitor.Plugins.LocalNotifications.checkPermissions();
                    if (perm.display !== 'granted') {
                        if (forcePrompt) {
                            const req = await Capacitor.Plugins.LocalNotifications.requestPermissions();
                            if (req.display !== 'granted') {
                                lockGpsGate('يجب السماح بصلاحية الإشعارات لتفعيل عداد الشحنات والتنبيه الصوتي.');
                                return false;
                            }
                        } else {
                            lockGpsGate('صلاحية الإشعارات مطلوبة لتشغيل التطبيق بشكل صحيح.');
                            return false;
                        }
                    }
                }
            } catch (e) {}

            // 3. Check GPS
            const isRequired = await refreshGpsEnforcementSetting();
            if (!isRequired) {
                unlockGpsGate();
                fetchShipments();
                return true;
            }
            const isReady = await requestGpsAccessAndUnlock(forcePrompt);
            if (isReady) fetchShipments();
            return isReady;
        }

        // Add listener for internet status changes
        window.addEventListener('online', () => ensureGpsReadyAndLoadShipments(false));
        window.addEventListener('offline', () => lockGpsGate('انقطع الاتصال بالإنترنت.'));

        function getSelectedZones() {
            return Array.from(zoneFilterSelections);
        }

        function getSelectedSenders() {
            return Array.from(senderFilterSelections);
        }

        function setDateSelection(value) {
            const normalizedValue = String(value || '').trim();
            dateFilterSelections.clear();
            if (normalizedValue) {
                dateFilterSelections.add(normalizedValue);
            }

            saveDateFilter(normalizedValue);
            saveRepUiState();
            stopDateFilterGlow();
            renderShipments();
        }

        function toggleDateSelection(value) {
            const select = el('filterDateSelect');
            if (select) {
                select.classList.remove('filter-active-animation');
                void select.offsetWidth;
                select.classList.add('filter-active-animation');
            }
            setDateSelection(value);
        }

        function toggleZoneSelection(value) {
            const select = el('filterZone');
            if (select) {
                select.classList.remove('filter-active-animation');
                void select.offsetWidth;
                select.classList.add('filter-active-animation');
            }
            const normalizedValue = String(value || '').trim();
            if (!normalizedValue) return;

            zoneFilterSelections.clear();
            if (normalizedValue !== 'الكل') {
                zoneFilterSelections.add(normalizedValue);
            }

            saveRepUiState();
            renderShipments();
        }

        function toggleStatusSelection(value) {
            const select = el('filterStatus');
            if (select) {
                select.classList.remove('filter-active-animation');
                void select.offsetWidth;
                select.classList.add('filter-active-animation');
            }
            const normalizedValue = String(value || '').trim();
            const previousStatuses = getSelectedStatuses().filter(status => STATUS_OPTIONS.includes(status));
            statusFilterSelections.clear();

            if (normalizedValue === FAVORITES_FILTER_VALUE) {
                if (previousStatuses.length > 0) {
                    lastNonFavoritesStatusSelections = new Set(previousStatuses);
                }
                statusFilterSelections.add(FAVORITES_FILTER_VALUE);
                saveRepUiState();
                switchRepView('favorites');
                return;
            }

            if (normalizedValue) {
                statusFilterSelections.add(normalizedValue);
                lastNonFavoritesStatusSelections = new Set([normalizedValue]);
            }

            if (currentActiveView === 'favorites') {
                switchRepView('dashboard', { skipRender: true });
            }
            saveRepUiState();
            syncQuickStatCards();
            renderShipments();
        }

        function toggleSenderSelection(value) {
            const select = el('filterSender');
            if (select) {
                select.classList.remove('filter-active-animation');
                void select.offsetWidth;
                select.classList.add('filter-active-animation');
            }
            const normalizedValue = String(value || '').trim();
            if (!normalizedValue) return;

            senderFilterSelections.clear();
            if (normalizedValue !== 'الكل') {
                senderFilterSelections.add(normalizedValue);
            }

            saveRepUiState();
            renderShipments();
        }

        function clearAllRepFilters() {
            dateFilterSelections.clear();
            statusFilterSelections.clear();
            zoneFilterSelections.clear();
            senderFilterSelections.clear();
            const searchInput = el('searchInput');
            if (searchInput) searchInput.value = '';
            saveDateFilter('');
            if (currentActiveView === 'favorites') {
                switchRepView('dashboard', { skipRender: true, skipSave: true });
            }
            saveRepUiState();
            fillStatusDropdown();
            syncQuickStatCards();
            renderShipments();
        }

        function renderActiveFilterSummary() {
            const summaryEl = el('activeFiltersSummary');
            const clearBtn = el('clearFiltersBtn');
            if (!summaryEl || !clearBtn) return;

            const chips = [];
            const selectedDates = getSelectedDates();
            const selectedStatuses = getSelectedStatuses();
            const selectedZones = getSelectedZones();
            const selectedSenders = getSelectedSenders();
            const searchValue = String(getElementValue('searchInput') || '').trim();

            if (selectedDates.length > 0) chips.push(`اليومية: ${selectedDates[0]}`);
            if (selectedStatuses.length > 0) chips.push(`الحالة: ${selectedStatuses[0]}`);
            if (selectedZones.length > 0) chips.push(`الزون: ${selectedZones[0]}`);
            if (selectedSenders.length > 0) chips.push(`الراسل: ${selectedSenders[0]}`);
            if (searchValue) chips.push(`بحث: ${searchValue}`);

            if (chips.length === 0) {
                summaryEl.innerHTML = `<span class="text-[11px] font-black text-slate-400 dark:text-slate-500">لا توجد فلاتر مفعلة</span>`;
                clearBtn.classList.add('hidden');
                return;
            }

            summaryEl.innerHTML = chips.map((chip) => `
                <span class="filter-summary-chip">${chip}</span>
            `).join('');
            clearBtn.classList.remove('hidden');
        }

        function stopDateFilterGlow() {
            const dateSelect = el('filterDateSelect');
            if (dateFilterGlowTimeout) {
                clearTimeout(dateFilterGlowTimeout);
                dateFilterGlowTimeout = null;
            }
            dateSelect?.classList.remove('rep-date-filter-glow');
        }

        function triggerDateFilterGlow() {
            const dateSelect = el('filterDateSelect');
            if (!dateSelect) return;

            if (dateFilterGlowTimeout) {
                clearTimeout(dateFilterGlowTimeout);
                dateFilterGlowTimeout = null;
            }

            dateSelect.classList.add('rep-date-filter-glow');
            dateFilterGlowTimeout = setTimeout(() => {
                dateSelect.classList.remove('rep-date-filter-glow');
                dateFilterGlowTimeout = null;
            }, 12000);
        }

        function focusDateFilterPicker() {
            const dateSelect = el('filterDateSelect');
            if (!dateSelect) return;

            triggerDateFilterGlow();
            dateSelect.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

            setTimeout(() => {
                dateSelect.focus({ preventScroll: true });
                if (typeof dateSelect.showPicker === 'function') {
                    try {
                        dateSelect.showPicker();
                        return;
                    } catch (error) { }
                }
                dateSelect.click();
            }, 180);
        }

        function promptOpenDateFilterIfNeeded() {}

        function saveRepUiState() {
            try {
                localStorage.setItem(REP_UI_STATE_KEY, JSON.stringify({
                    view: currentActiveView,
                    search: getElementValue('searchInput'),
                    date: getSelectedDates(),
                    status: isFavoritesFilterSelected() ? [FAVORITES_FILTER_VALUE] : getSelectedStatuses(),
                    lastNonFavoriteStatus: [...lastNonFavoritesStatusSelections],
                    zone: getSelectedZones(),
                    sender: getSelectedSenders(),
                    displayLimit: currentDisplayLimit
                }));
            } catch (error) { }
        }

        function restoreRepUiState() {
            let state = null;
            try {
                state = JSON.parse(localStorage.getItem(REP_UI_STATE_KEY) || 'null');
            } catch (error) { }

            if (state && state.date) {
                const dates = Array.isArray(state.date) ? state.date : [state.date];
                dates.map(d => String(d || '').trim()).filter(Boolean).forEach(d => dateFilterSelections.add(d));
            } else {
                const legacyDate = getSavedDateFilter();
                const normalizedLegacyDate = String(legacyDate || '').trim();
                if (normalizedLegacyDate) dateFilterSelections.add(normalizedLegacyDate);
            }

            if (state && state.status) {
                const statuses = Array.isArray(state.status) ? state.status : [state.status];
                statusFilterSelections.clear();
                statuses.map(s => String(s || '').trim()).filter(Boolean).forEach(s => statusFilterSelections.add(s));
            }
            if (state && state.lastNonFavoriteStatus) {
                const lastStatuses = Array.isArray(state.lastNonFavoriteStatus) ? state.lastNonFavoriteStatus : [state.lastNonFavoriteStatus];
                lastNonFavoritesStatusSelections = new Set(
                    lastStatuses.map(s => String(s || '').trim()).filter(s => STATUS_OPTIONS.includes(s))
                );
            }
            if (state && state.zone) {
                const zones = Array.isArray(state.zone) ? state.zone : [state.zone];
                zones.map(z => String(z || '').trim()).filter(Boolean).forEach(z => zoneFilterSelections.add(z));
            }

            if (!state) return;

            if (state && state.sender) {
                const senders = Array.isArray(state.sender) ? state.sender : [state.sender];
                senders.map(s => String(s || '').trim()).filter(Boolean).forEach(s => senderFilterSelections.add(s));
            }

            const savedDisplayLimit = Number(state?.displayLimit || 40);
            if (!Number.isNaN(savedDisplayLimit) && savedDisplayLimit >= 40) {
                currentDisplayLimit = savedDisplayLimit;
            }

            if (!state) return;

            const searchInput = el('searchInput');

            if (searchInput) searchInput.value = state.search || '';
            if (!isFavoritesFilterSelected()) rememberCurrentNonFavoritesStatuses();

            const savedView = String(state.view || '').trim();
            if (savedView === 'favorites' || savedView === 'dashboard') {
                switchRepView(savedView, { skipRender: true, skipSave: true });
            }
        }

        
