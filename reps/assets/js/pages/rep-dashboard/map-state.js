let mapInstance = null;
        let mapRoutingControl = null;
        let repMarker = null;
        let destMarker = null;
        let mapWatchId = null;
        let mapCurrentShipmentId = null;
        let isNavigating = false;
        let mapCurrentRouteCoords = [];
        let mapSmartTracking = {
            lastProcTime: 0, lastLat: null, lastLng: null,
            calcDistMs: function(l1, ln1, l2, ln2) {
                const R = 6371e3; const p1 = l1 * Math.PI/180; const p2 = l2 * Math.PI/180;
                const a = Math.sin((l2-l1)*Math.PI/360)**2 + Math.cos(p1)*Math.cos(p2) * Math.sin((ln2-ln1)*Math.PI/360)**2;
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            }
        };

        
