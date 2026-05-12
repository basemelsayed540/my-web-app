favoriteShipmentIds = loadFavoriteShipmentIds();
        updateFavoritesNavBadge();
        bindRepStickyOffsetSync();
        window.addEventListener('load', updateRepStickyOffsets);
        lockGpsGate('يجب تفعيل GPS والسماح بالموقع حتى تتمكن من فتح حسابك ومشاهدة شحناتك.');
        ensureGpsReadyAndLoadShipments(false);
        startGpsEnforcement();
        startShipmentsPolling();
        initUnreadBadge();
        updateRepNotifUI(); // Initialize notification system
        
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
