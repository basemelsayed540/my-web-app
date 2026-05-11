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
        el('bulkUpdateBtn')?.addEventListener('click', () => applyBulkUpdate());
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
        el('bulkStatusSelect')?.addEventListener('change', () => updateBulkActionBar());
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

        
