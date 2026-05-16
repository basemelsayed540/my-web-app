async function fetchShipments(options = {}) {
            if (!gpsGateUnlocked) return;
            const { skipChangeNotifications = false } = options;
            const previouslySeenIds = loadSeenShipmentIds();
            const isFirstLoad = previouslySeenIds.size === 0;
            const repIdentifiers = getRepIdentifiers();
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.SHIPMENTS)
                .select('*')
                .order('كود الشحنة', { ascending: false });

            if (error) {
                console.error(error);
                return;
            }

            const normalizedRepIdentifiers = new Set(repIdentifiers.map(normalizeComparableValue));
            const currentShipments = (data || [])
                .map(normalizeShipmentPriceField)
                .filter(shipment => shipmentBelongsToRep(shipment, normalizedRepIdentifiers));
            const currentSeenIds = new Set(currentShipments.map(shipment => String(shipment.id)));
            const newShipments = !isFirstLoad
                ? currentShipments.filter(shipment => !previouslySeenIds.has(String(shipment.id)))
                : [];

            if (!skipChangeNotifications && !isFirstLoad) {
                detectShipmentChanges(lastServerShipmentsMap, currentShipments, normalizedRepIdentifiers);
            }

            lastServerShipmentsMap = new Map(
                currentShipments.map((shipment) => [String(shipment.id), { ...shipment }])
            );
            allShipments = currentShipments;
            favoriteShipmentIds = new Set(
                [...favoriteShipmentIds].filter(id => currentShipments.some(shipment => String(shipment.id) === String(id)))
            );
            saveFavoriteShipmentIds(favoriteShipmentIds);
            updateFavoritesNavBadge();
            bumpShipmentsDataVersion();
            pruneBulkSelection();
            saveSeenShipmentIds(currentSeenIds);

            if (newShipments.length > 0) {
                syncUnreadShipments(newShipments);
                showNewShipmentNotification(newShipments);
                // Also add to the persistent notification log (history tab)
                newShipments.forEach(s => addRepNotification('added', s));
            }

            await fetchLockedShipmentIds();

            // Only restore UI state if it's the first successful load or explicitly forced
            if (isFirstLoad || options.force) {
                restoreRepUiState();
            }

            renderShipments();
            promptOpenDateFilterIfNeeded();
        }

        async function fetchLockedShipmentIds() {
            const repIdentifiers = getRepIdentifiers();
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.SETTLEMENTS)
                .select('order_ids')
                .in('rep_name', repIdentifiers);

            if (error) {
                console.error(error);
                lockedShipmentIds = new Set();
                bumpShipmentsDataVersion();
                return;
            }

            const lockedIds = new Set();
            (data || []).forEach(row => {
                try {
                    const ids = JSON.parse(row.order_ids || '[]');
                    ids.forEach(id => lockedIds.add(String(id)));
                } catch (e) { }
            });

            lockedShipmentIds = lockedIds;
            bumpShipmentsDataVersion();
        }

        function isShipmentLocked(id) {
            return lockedShipmentIds.has(String(id));
        }

        function lockShipmentForFurtherUpdates(id) {
            lockedShipmentIds.add(String(id));
        }

        function isShipmentUpdateLocked(shipmentOrId) {
            const shipment = typeof shipmentOrId === 'object'
                ? shipmentOrId
                : allShipments.find(s => String(s.id) === String(shipmentOrId));

            if (!shipment) return isShipmentLocked(shipmentOrId);
            return isShipmentLocked(shipment.id) || isRejectedStatus(shipment.الحالة);
        }

        function isShipmentBulkEditable(shipment) {
            if (!shipment) return false;
            if (isShipmentLocked(shipment.id)) return false;
            if (isRejectedStatus(shipment.الحالة)) return false;
            if (isDeliveredStatus(shipment.الحالة, shipment)) return false;
            if (isPriceEditShipment(shipment)) return false;
            if (isShippingFeeShipment(shipment)) return false;
            return true;
        }

        function pruneBulkSelection() {
            selectedShipmentIdsForBulk = new Set(
                [...selectedShipmentIdsForBulk].filter((id) => {
                    const shipment = allShipments.find(s => String(s.id) === String(id));
                    return isShipmentBulkEditable(shipment);
                })
            );
        }

        
