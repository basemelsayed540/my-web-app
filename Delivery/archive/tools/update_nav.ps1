$content = Get-Content -Raw rep.html

$targetScripts = '        let mapCurrentShipmentId = null;'

$replaceScripts = '        let mapCurrentShipmentId = null;
        let isNavigating = false;
        let mapCurrentRouteCoords = [];'

$content = $content.Replace($targetScripts, $replaceScripts)

$targetStartBtn = '            document.getElementById(''map-start-btn'').addEventListener(''click'', () => {
                Swal.fire({
                    toast: true,
                    position: ''top-end'',
                    icon: ''success'',
                    title: ''بدأت الرحلة بنجاح! راقب المسار'',
                    showConfirmButton: false,
                    timer: 2000
                });
                document.getElementById(''map-start-btn'').classList.add(''opacity-50'', ''pointer-events-none'');
                document.getElementById(''map-start-btn'').innerHTML = ''<i class="fas fa-car"></i> في الطريق...'';
            });'

$replaceStartBtn = '            document.getElementById(''map-start-btn'').addEventListener(''click'', () => {
                isNavigating = true;
                Swal.fire({
                    toast: true,
                    position: ''top-end'',
                    icon: ''success'',
                    title: ''وضع الملاحة مفعل! جاري التتبع والتوجيه...'',
                    showConfirmButton: false,
                    timer: 2000
                });
                document.getElementById(''map-start-btn'').classList.add(''opacity-50'', ''pointer-events-none'');
                document.getElementById(''map-start-btn'').innerHTML = ''<i class="fas fa-car"></i> في الطريق...'';
                
                if (mapInstance && repMarker) {
                    mapInstance.setView(repMarker.getLatLng(), 18, { animate: true, duration: 1 });
                }
            });'

$content = $content.Replace($targetStartBtn, $replaceStartBtn)

$targetCloseMap = '            mapCurrentShipmentId = null;
            
            const startBtn = document.getElementById(''map-start-btn'');'

$replaceCloseMap = '            mapCurrentShipmentId = null;
            isNavigating = false;
            mapCurrentRouteCoords = [];
            
            const startBtn = document.getElementById(''map-start-btn'');'

$content = $content.Replace($targetCloseMap, $replaceCloseMap)

$targetTracking1 = '                const repIconUrl = ''data:image/svg+xml;base64,'' + btoa(''<svg fill="#4f46e5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 0c17.7 0 32 14.3 32 32V66.7C368.4 80.1 431.9 143.6 445.3 224H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H445.3C431.9 368.4 368.4 431.9 288 445.3V480c0 17.7-14.3 32-32 32s-32-14.3-32-32V445.3C143.6 431.9 80.1 368.4 66.7 288H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H66.7C80.1 143.6 143.6 80.1 224 66.7V32c0-17.7 14.3-32 32-32zM128 256a128 128 0 1 0 256 0 128 128 0 1 0 -256 0zm128-80a80 80 0 1 1 0 160 80 80 0 1 1 0-160z"/></svg>'');
                const repIcon = L.icon({ iconUrl: repIconUrl, iconSize: [40, 40], iconAnchor: [20, 20] });
                repMarker = L.marker([repLat, repLng], { icon: repIcon }).addTo(mapInstance);'

$replaceTracking1 = '                const repIconHtml = `<div id="rep-nav-arrow" class="w-[44px] h-[44px] flex items-center justify-center bg-indigo-600/90 border-[3px] border-white rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)]" style="transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);"><i class="fas fa-location-arrow text-white drop-shadow-md text-xl" style="transform: rotate(-45deg);"></i></div>`;
                const repIcon = L.divIcon({ html: repIconHtml, className: '''', iconSize: [44, 44], iconAnchor: [22, 22] });
                repMarker = L.marker([repLat, repLng], { icon: repIcon, zIndexOffset: 1000 }).addTo(mapInstance);'

$content = $content.Replace($targetTracking1, $replaceTracking1)

$targetRoutesFound = '                mapRoutingControl.on(''routesfound'', function(e) {
                    const summary = e.routes[0].summary;
                    distanceBadge.innerText = (summary.totalDistance / 1000).toFixed(1) + '' كم'';
                    distanceBadge.classList.remove(''hidden'');
                    loadingOverlay.classList.add(''hidden'');
                });'

$replaceRoutesFound = '                mapRoutingControl.on(''routesfound'', function(e) {
                    const summary = e.routes[0].summary;
                    mapCurrentRouteCoords = e.routes[0].coordinates || [];
                    distanceBadge.innerText = (summary.totalDistance / 1000).toFixed(1) + '' كم'';
                    distanceBadge.classList.remove(''hidden'');
                    loadingOverlay.classList.add(''hidden'');
                });'

$content = $content.Replace($targetRoutesFound, $replaceRoutesFound)

$targetGeoWatch = '                let lastCalcTime = Date.now();
                mapWatchId = navigator.geolocation.watchPosition((pos2) => {
                    const newLat = pos2.coords.latitude;
                    const newLng = pos2.coords.longitude;
                    if (repMarker) repMarker.setLatLng([newLat, newLng]);
                    
                    if (Date.now() - lastCalcTime > 10000) {
                        if (mapRoutingControl) {
                            mapRoutingControl.setWaypoints([
                                L.latLng(newLat, newLng),
                                L.latLng(destLat, destLng)
                            ]);
                        }
                        lastCalcTime = Date.now();
                    }
                }, null, { enableHighAccuracy: true, maximumAge: 5000 });'

$replaceGeoWatch = '                let lastCalcTime = Date.now();
                let lastLat = repLat, lastLng = repLng;
                mapWatchId = navigator.geolocation.watchPosition((pos2) => {
                    let newLat = pos2.coords.latitude;
                    let newLng = pos2.coords.longitude;
                    const speed = pos2.coords.speed || 0;
                    let heading = pos2.coords.heading;

                    if (heading === null || Number.isNaN(heading)) {
                        if (newLat !== lastLat || newLng !== lastLng) {
                            const dLon = (newLng - lastLng) * Math.PI / 180;
                            const lat1 = lastLat * Math.PI / 180;
                            const lat2 = newLat * Math.PI / 180;
                            const y = Math.sin(dLon) * Math.cos(lat2);
                            const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
                            heading = Math.atan2(y, x) * 180 / Math.PI;
                            heading = (heading + 360) % 360;
                        } else {
                            heading = 0;
                        }
                    }
                    
                    if (isNavigating && mapCurrentRouteCoords && mapCurrentRouteCoords.length > 0) {
                        let minDist = Infinity;
                        let snappedLat = newLat, snappedLng = newLng;
                        for (let pt of mapCurrentRouteCoords) {
                            const dist = Math.pow(pt.lat - newLat, 2) + Math.pow(pt.lng - newLng, 2);
                            if (dist < minDist) { minDist = dist; snappedLat = pt.lat; snappedLng = pt.lng; }
                        }
                        // Snap threshold (~50 meters)
                        if (minDist < 0.000001) {
                            newLat = snappedLat; newLng = snappedLng;
                        }
                    }

                    if (repMarker) {
                        repMarker.setLatLng([newLat, newLng]);
                        const arrowEl = document.getElementById(''rep-nav-arrow'');
                        if (arrowEl) arrowEl.style.transform = `rotate(${heading}deg)`;
                    }
                    
                    if (isNavigating && mapInstance && repMarker) {
                        const zoomLvl = speed > 15 ? 16 : (speed > 8 ? 17 : 18);
                        mapInstance.setView([newLat, newLng], zoomLvl, { animate: true });
                    }
                    
                    if (Date.now() - lastCalcTime > 15000) {
                        if (mapRoutingControl) {
                            mapRoutingControl.setWaypoints([
                                L.latLng(newLat, newLng),
                                L.latLng(destLat, destLng)
                            ]);
                        }
                        lastCalcTime = Date.now();
                    }
                    lastLat = newLat; lastLng = newLng;
                }, null, { enableHighAccuracy: true, maximumAge: 1000 });'

$content = $content.Replace($targetGeoWatch, $replaceGeoWatch)

Set-Content rep.html -Value $content
