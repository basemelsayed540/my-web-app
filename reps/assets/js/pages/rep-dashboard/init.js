favoriteShipmentIds = loadFavoriteShipmentIds();
        updateFavoritesNavBadge();
        bindRepStickyOffsetSync();
        window.addEventListener('load', updateRepStickyOffsets);
        lockGpsGate('جاري التحقق من متطلبات التشغيل...');

        // Initial permission request on first load
        ensureGpsReadyAndLoadShipments(true);

        startGpsEnforcement();
        startShipmentsPolling();
        initUnreadBadge();
        updateRepNotifUI(); // Initialize notification system
        updateFilterChipsUI(); // Initialize interactive chips

        // Supabase Realtime Subscription for instantaneous updates
        const realtimeChannel = supabaseClient
            .channel('elsayed-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: CONFIG.TABLES.SHIPMENTS
            }, (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload;
                const activeRepIdentifiers = getRepIdentifiers();

                if (eventType === 'INSERT') {
                    if (shipmentBelongsToRep(newRecord, activeRepIdentifiers)) {
                        addRepNotification('added', newRecord);
                        fetchShipments({ skipChangeNotifications: true });
                    }
                } else if (eventType === 'UPDATE') {
                    if (shipmentBelongsToRep(newRecord, activeRepIdentifiers)) {
                        if (String(oldRecord.الحالة || '').trim() !== String(newRecord.الحالة || '').trim()) {
                            addRepNotification('status_changed', newRecord);
                        } else {
                            addRepNotification('updated', newRecord);
                        }
                        fetchShipments({ skipChangeNotifications: true });
                    }
                } else if (eventType === 'DELETE') {
                    const deletedId = String(oldRecord.id);
                    const cachedRecord = typeof allShipments !== 'undefined' ? allShipments.find(s => String(s.id) === deletedId) : null;
                    if (cachedRecord && shipmentBelongsToRep(cachedRecord, activeRepIdentifiers)) {
                        addRepNotification('deleted', cachedRecord);
                        showShipmentUpdateNotification('deleted', cachedRecord);
                        fetchShipments({ skipChangeNotifications: true });
                    }
                }
            })
            .subscribe();

        // Handle direct navigation to secondary views
        document.addEventListener('DOMContentLoaded', () => {
            if (window.location.hash === '#notifications') {
                openRepNotificationsPanel();
                return;
            }

            if (window.location.hash === '#favorites') {
                switchRepView('favorites');
            }
        });
