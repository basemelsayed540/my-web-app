$c = Get-Content rep.html -Raw

$tVars = '        let mapCurrentShipmentId = null;
        let isNavigating = false;
        let mapCurrentRouteCoords = [];'

$rVars = '        let mapCurrentShipmentId = null;
        let isNavigating = false;
        let mapCurrentRouteCoords = [];
        let mapSmartTracking = {
            lastProcTime: 0, lastLat: null, lastLng: null,
            calcDistMs: function(l1, ln1, l2, ln2) {
                const R = 6371e3; const p1 = l1 * Math.PI/180; const p2 = l2 * Math.PI/180;
                const a = Math.sin((l2-l1)*Math.PI/360)**2 + Math.cos(p1)*Math.cos(p2) * Math.sin((ln2-ln1)*Math.PI/360)**2;
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            }
        };'
$c = $c.Replace($tVars, $rVars)

$tStart = '            document.getElementById(''map-start-btn'').addEventListener(''click'', () => {
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

$rStart = '            document.getElementById(''map-start-btn'').addEventListener(''click'', () => {
                isNavigating = true;
                Swal.fire({
                    toast: true, position: ''top-end'', icon: ''success'',
                    title: ''التتبع فائق الدقة مفعل...'', showConfirmButton: false, timer: 2000
                });
                document.getElementById(''map-start-btn'').classList.add(''opacity-50'', ''pointer-events-none'');
                document.getElementById(''map-start-btn'').innerHTML = ''<i class="fas fa-car"></i> في الطريق...'';
                
                if (mapInstance && repMarker) mapInstance.setView(repMarker.getLatLng(), 18, { animate: true });
                // Switch watcher to High Accuracy Nav Mode
                if (window.mapRestartTrackingFn) window.mapRestartTrackingFn(true);
            });'
$c = $c.Replace($tStart, $rStart)

$tClose = '            mapCurrentShipmentId = null;
            isNavigating = false;
            mapCurrentRouteCoords = [];'
$rClose = '            mapCurrentShipmentId = null;
            isNavigating = false;
            mapCurrentRouteCoords = [];
            mapSmartTracking.lastProcTime = 0; mapSmartTracking.lastLat = null; mapSmartTracking.lastLng = null;'
$c = $c.Replace($tClose, $rClose)

$tWatch = '                let lastCalcTime = Date.now();
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

$rWatch = '                let lastCalcTime = Date.now();
                window.mapRestartTrackingFn = (forceHighAcc) => {
                     if (mapWatchId) navigator.geolocation.clearWatch(mapWatchId);
                     
                     let options = {
                         enableHighAccuracy: forceHighAcc,
                         maximumAge: forceHighAcc ? 5000 : 30000,
                         timeout: forceHighAcc ? 10000 : 20000
                     };
                     
                     mapWatchId = navigator.geolocation.watchPosition((pos2) => {
                          const now = Date.now();
                          const throttleMs = isNavigating ? 3000 : 12000;
                          
                          if (now - mapSmartTracking.lastProcTime < throttleMs) return; // Smart Time Throttle
                          
                          let newLat = pos2.coords.latitude;
                          let newLng = pos2.coords.longitude;
                          const speed = pos2.coords.speed || 0;
                          let heading = pos2.coords.heading;
                          
                          if (mapSmartTracking.lastLat) {
                               const movedDist = mapSmartTracking.calcDistMs(mapSmartTracking.lastLat, mapSmartTracking.lastLng, newLat, newLng);
                               const distThreshold = isNavigating ? 8 : 20; // Smart Distance Throttle
                               if (movedDist < distThreshold && speed < 1) return;
                               
                               if (heading === null || Number.isNaN(heading)) {
                                   const dLon = (newLng - mapSmartTracking.lastLng) * Math.PI / 180;
                                   const lat1 = mapSmartTracking.lastLat * Math.PI / 180;
                                   const lat2 = newLat * Math.PI / 180;
                                   const y = Math.sin(dLon) * Math.cos(lat2);
                                   const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
                                   heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
                               }
                          } else {
                               heading = heading || 0;
                          }
                          
                          mapSmartTracking.lastProcTime = now;
                          mapSmartTracking.lastLat = newLat;
                          mapSmartTracking.lastLng = newLng;
                          
                          const offRoute = () => {
                              if(!mapCurrentRouteCoords || mapCurrentRouteCoords.length === 0) return true;
                              let mDist = Infinity;
                              for(let pt of mapCurrentRouteCoords) {
                                   const d = Math.pow(pt.lat - newLat, 2) + Math.pow(pt.lng - newLng, 2);
                                   if (d < mDist) mDist = d;
                              }
                              return mDist > 0.000008; // Significantly off route
                          };
                          
                          if (isNavigating && mapCurrentRouteCoords && mapCurrentRouteCoords.length > 0) {
                              let minDist = Infinity;
                              let snappedLat = newLat, snappedLng = newLng;
                              for (let pt of mapCurrentRouteCoords) {
                                  const dist = Math.pow(pt.lat - newLat, 2) + Math.pow(pt.lng - newLng, 2);
                                  if (dist < minDist) { minDist = dist; snappedLat = pt.lat; snappedLng = pt.lng; }
                              }
                              // Snap threshold
                              if (minDist < 0.000001) { newLat = snappedLat; newLng = snappedLng; }
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
                          
                          // Smart Re-route: Only request new route if heavily off route, no more spamming API!
                          if (now - lastCalcTime > 15000 && mapRoutingControl && offRoute()) {
                              mapRoutingControl.setWaypoints([
                                  L.latLng(newLat, newLng),
                                  L.latLng(destLat, destLng)
                              ]);
                              lastCalcTime = now;
                          }
                     }, null, options);
                };
                
                // Start with Idle tracking mode
                window.mapRestartTrackingFn(false);'

$c = $c.Replace($tWatch, $rWatch)

[System.IO.File]::WriteAllText('rep.html', $c, [System.Text.Encoding]::UTF8)
