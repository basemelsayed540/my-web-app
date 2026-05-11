function updateGpsToggleButtonState() {
            const gpsBtn = document.getElementById('gpsToggleBtn');
            const gpsIcon = document.getElementById('gpsToggleIcon');
            const gpsLabel = document.getElementById('gpsToggleLabel');
            if (!gpsBtn || !gpsIcon) return;
            const isActive = !!trackingSystem?.isTracking;
            gpsBtn.title = isActive ? 'إيقاف GPS' : 'تشغيل GPS';
            gpsBtn.setAttribute('aria-label', isActive ? 'إيقاف GPS' : 'تشغيل GPS');
            gpsBtn.classList.toggle('text-emerald-600', isActive);
            gpsBtn.classList.toggle('dark:text-emerald-400', isActive);
            gpsBtn.classList.toggle('bg-emerald-50', isActive);
            gpsBtn.classList.toggle('dark:bg-emerald-950/30', isActive);
            gpsBtn.classList.toggle('text-slate-400', !isActive);
            gpsBtn.classList.toggle('dark:text-slate-200', !isActive);
            gpsIcon.className = isActive ? 'fas fa-location-crosshairs text-xl animate-pulse' : 'fas fa-location-dot text-xl';
            if (gpsLabel) gpsLabel.textContent = isActive ? 'إيقاف GPS' : 'تشغيل GPS';
        }

        async function toggleGpsMap() {
            toggleTracking();
        }

        function initMapUI() {
            if (document.getElementById('map-overlay-container')) return;
            const mapHtml = `
                <div id="map-overlay-container" class="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col transition-transform duration-300 translate-y-full will-change-transform">
                    <div class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shadow-sm z-10 shrink-0">
                        <div class="flex items-center gap-3">
                            <button id="close-map-btn" class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all text-xl">
                                <i class="fas fa-arrow-right"></i>
                            </button>
                            <div>
                                <h3 class="font-black text-slate-900 dark:text-white leading-none">التتبع والملاحة</h3>
                                <p id="map-shipment-client" class="text-[11px] font-bold text-sky-800 mt-1">جاري التحميل...</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                             <span id="map-distance-badge" class="px-2 py-1 bg-cyan-50 dark:bg-cyan-950/30 text-sky-800 dark:text-cyan-300 text-[10px] font-black rounded-lg border border-cyan-100 dark:border-cyan-800/50 hidden">0 كم</span>
                        </div>
                    </div>
                    
                    <div class="relative flex-1 bg-slate-200 dark:bg-slate-800 w-full">
                        <div id="leaflet-map" class="w-full h-full z-0"></div>
                        
                        <div id="map-loading-overlay" class="absolute inset-0 z-50 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
                            <div class="w-16 h-16 border-4 border-slate-200 border-t-cyan-600 rounded-full animate-spin"></div>
                            <p id="map-loading-text" class="mt-4 font-black text-slate-700 dark:text-slate-200 text-sm animate-pulse">جاري تحديد مسار الرحلة...</p>
                        </div>
                        
                        <button id="recenter-map-btn" class="absolute bottom-6 right-4 z-[60] w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 text-sky-800 drop-shadow-xl flex items-center justify-center text-xl hover:scale-105 active:scale-95 transition-all border border-slate-100 dark:border-slate-700">
                            <i class="fas fa-crosshairs"></i>
                        </button>
                    </div>

                    <div class="bg-white dark:bg-slate-900 p-4 border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] shrink-0 z-10">
                        <div class="flex items-center justify-between gap-3">
                            <button id="map-start-btn" class="flex-1 bg-sky-800 text-white rounded-xl py-3.5 font-black text-sm drop-shadow-md hover:bg-cyan-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                                <i class="fas fa-route"></i>
                                بدء التحرك
                            </button>
                            <button id="map-arrive-btn" class="flex-1 bg-emerald-500 text-white rounded-xl py-3.5 font-black text-sm drop-shadow-md hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2">
                                <i class="fas fa-check-circle"></i>
                                تسجيل الوصول
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', mapHtml);

            document.getElementById('close-map-btn').addEventListener('click', closeMapOverlay);
            document.getElementById('recenter-map-btn').addEventListener('click', recenterMap);
            document.getElementById('map-arrive-btn').addEventListener('click', async () => {
                if (!mapCurrentShipmentId) return;
                const confirmed = await Swal.fire({
                    title: 'تأكيد الوصول',
                    text: 'هل أنت متأكد من تسليم الشحنة وتحديث حالتها إلى "تم التسليم"؟',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، تم التسليم',
                    cancelButtonText: 'إلغاء'
                });
                if (confirmed.isConfirmed) {
                    await updateStatus(mapCurrentShipmentId, 'تم التسليم');
                    closeMapOverlay();
                }
            });
            document.getElementById('map-start-btn').addEventListener('click', () => {
                isNavigating = true;
                Swal.fire({
                    toast: true, position: 'top-end', icon: 'success',
                    title: 'التتبع فائق الدقة مفعل...', showConfirmButton: false, timer: 2000
                });
                document.getElementById('map-start-btn').classList.add('opacity-50', 'pointer-events-none');
                document.getElementById('map-start-btn').innerHTML = '<i class="fas fa-car"></i> في الطريق...';
                
                if (mapInstance && repMarker) mapInstance.setView(repMarker.getLatLng(), 18, { animate: true });
                // Switch watcher to High Accuracy Nav Mode
                if (window.mapRestartTrackingFn) window.mapRestartTrackingFn(true);
            });

            updateGpsToggleButtonState();
        }

        async function geocodeAddress(address) {
            const normalized = String(address || '').trim().replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, ' ');
            if (!normalized || normalized.length < 3) return null;
            
            const cacheKey = `geocode_${normalized}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try { return JSON.parse(cached); } catch(e){}
            }

            try {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalized + ' مصر')}&limit=1`;
                const res = await fetch(url, { headers: { 'Accept-Language': 'ar' }});
                const data = await res.json();
                if (data && data.length > 0) {
                    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                    localStorage.setItem(cacheKey, JSON.stringify(result));
                    return result;
                }
            } catch (err) {}
            return null;
        }

        function closeMapOverlay() {
            const container = document.getElementById('map-overlay-container');
            if (container) {
                container.classList.add('translate-y-full');
            }
            if (mapWatchId) {
                navigator.geolocation.clearWatch(mapWatchId);
                mapWatchId = null;
            }
            if (mapRoutingControl && mapInstance) {
                mapInstance.removeControl(mapRoutingControl);
                mapRoutingControl = null;
            }
            mapCurrentShipmentId = null;
            isNavigating = false;
            mapCurrentRouteCoords = [];
            mapSmartTracking.lastProcTime = 0; mapSmartTracking.lastLat = null; mapSmartTracking.lastLng = null;
            
            const startBtn = document.getElementById('map-start-btn');
            if (startBtn) {
                startBtn.classList.remove('opacity-50', 'pointer-events-none');
                startBtn.innerHTML = '<i class="fas fa-route"></i> بدء التحرك';
            }

            updateGpsToggleButtonState();
        }

        function recenterMap() {
            if (mapInstance && repMarker) {
                mapInstance.setView(repMarker.getLatLng(), 15, { animate: true, duration: 1 });
            }
        }

        async function openTrackingMap(shipmentId) {
            initMapUI();
            
            const s = allShipments.find(x => String(x.id) === String(shipmentId));
            if (!s) return;
            
            mapCurrentShipmentId = s.id;
            const overlay = document.getElementById('map-overlay-container');
            const loadingOverlay = document.getElementById('map-loading-overlay');
            const clientText = document.getElementById('map-shipment-client');
            const distanceBadge = document.getElementById('map-distance-badge');
            
            overlay.classList.remove('translate-y-full');
            updateGpsToggleButtonState();
            loadingOverlay.classList.remove('hidden');
            clientText.innerText = s.اسم_العميل || 'شحنة';
            distanceBadge.classList.add('hidden');
            
            if (!mapInstance) {
                mapInstance = L.map('leaflet-map', { zoomControl: false }).setView([30.0444, 31.2357], 12);
                L.control.zoom({ position: 'bottomleft' }).addTo(mapInstance);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
                    maxZoom: 19
                }).addTo(mapInstance);
                setTimeout(() => mapInstance.invalidateSize(), 350);
            } else {
                mapInstance.invalidateSize();
            }

            if (repMarker) mapInstance.removeLayer(repMarker);
            if (destMarker) mapInstance.removeLayer(destMarker);
            if (mapRoutingControl) mapInstance.removeControl(mapRoutingControl);
            if (mapWatchId) navigator.geolocation.clearWatch(mapWatchId);
            
            if (!navigator.geolocation) {
                loadingOverlay.classList.add('hidden');
                Swal.fire('خطأ', 'التتبع غير مدعوم في متصفحك', 'error');
                closeMapOverlay();
                return;
            }

            try {
                const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
                });
                
                const repLat = pos.coords.latitude;
                const repLng = pos.coords.longitude;
                
                const repIconHtml = `<div id="rep-nav-arrow" class="w-[44px] h-[44px] flex items-center justify-center bg-sky-800/90 border-[3px] border-white rounded-full shadow-[0_0_15px_rgba(15,76,129,0.45)]" style="transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);"><i class="fas fa-location-arrow text-white drop-shadow-md text-xl" style="transform: rotate(-45deg);"></i></div>`;
                const repIcon = L.divIcon({ html: repIconHtml, className: '', iconSize: [44, 44], iconAnchor: [22, 22] });
                repMarker = L.marker([repLat, repLng], { icon: repIcon, zIndexOffset: 1000 }).addTo(mapInstance);
                
                document.getElementById('map-loading-text').innerText = 'جاري تحليل الوجهة...';
                
                let destLat, destLng;
                const manualGeocode = await resolveShipmentDestinationCoords(s);
                if (manualGeocode) {
                    destLat = manualGeocode.lat;
                    destLng = manualGeocode.lng;
                } else {
                    Swal.fire({
                        toast: true, position: 'top-end', icon: 'info',
                        title: 'الخريطة تقريبية (لم يتم تحويل العنوان بدقة)',
                        showConfirmButton: false, timer: 3000
                    });
                    destLat = 30.044 + (Math.random() * 0.1 - 0.05);
                    destLng = 31.235 + (Math.random() * 0.1 - 0.05);
                }

                const destIconUrl = 'data:image/svg+xml;base64,' + btoa('<svg fill="#f43f5e" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/></svg>');
                const destIcon = L.icon({ iconUrl: destIconUrl, iconSize: [36, 48], iconAnchor: [18, 48], popupAnchor: [0, -48] });
                destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(mapInstance);
                destMarker.bindPopup(`<b>${s.اسم_العميل}</b><br>${s.العنوان}`);
                
                mapRoutingControl = L.Routing.control({
                    waypoints: [ L.latLng(repLat, repLng), L.latLng(destLat, destLng) ],
                    routeWhileDragging: false,
                    show: false,
                    addWaypoints: false,
                    lineOptions: { styles: [{ color: '#4f46e5', weight: 6, opacity: 0.8 }] },
                    createMarker: function() { return null; }
                }).addTo(mapInstance);
                
                mapRoutingControl.on('routesfound', function(e) {
                    const summary = e.routes[0].summary;
                    mapCurrentRouteCoords = e.routes[0].coordinates || [];
                    distanceBadge.innerText = (summary.totalDistance / 1000).toFixed(1) + ' كم';
                    distanceBadge.classList.remove('hidden');
                    loadingOverlay.classList.add('hidden');
                });

                mapRoutingControl.on('routingerror', function() {
                    loadingOverlay.classList.add('hidden');
                    Swal.fire({
                        toast: true, position: 'top', icon: 'warning',
                        title: 'تعذر رسم المسار، سنعرض المواقع فقط',
                        showConfirmButton: false, timer: 3000
                    });
                    mapInstance.fitBounds(L.latLngBounds([repLat, repLng], [destLat, destLng]).pad(0.2));
                });
                
                let lastCalcTime = Date.now();
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
                              const arrowEl = document.getElementById('rep-nav-arrow');
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
                window.mapRestartTrackingFn(false);

            } catch (err) {
                loadingOverlay.classList.add('hidden');
                Swal.fire('خطأ', 'تعذر الحصول على موقعك الحالي. تأكد من تفعيل الـ GPS', 'error');
                closeMapOverlay();
            }
        }

        
