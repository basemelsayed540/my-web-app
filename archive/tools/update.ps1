$content = Get-Content -Path rep.html -Raw

$targetAddress = '                    <div class="space-y-2.5 mb-5">
                        <div class="flex items-start gap-2.5">
                            <i class="fas fa-map-pin text-sm mt-0.5 text-indigo-500"></i>
                            <span class="text-\[13px\] font-bold text-slate-800 dark:text-slate-200 leading-snug">\$\{s\.العنوان \|\| ''بدون عنوان''\}</span>
                        </div>'

$replaceAddress = '                    <div class="space-y-2.5 mb-5">
                        <div data-action="open-map" data-id="${s.id}" class="flex items-start gap-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-xl transition-colors -mx-2 group/map relative">
                            <div class="w-6 flex justify-center mt-0.5">
                                <i class="fas fa-map-marked-alt text-base text-indigo-500 group-hover/map:animate-bounce"></i>
                            </div>
                            <div class="flex-1">
                                <span class="text-[13px] font-bold text-slate-800 dark:text-slate-200 leading-snug border-b border-dashed border-indigo-300 dark:border-indigo-700/50 pb-0.5 group-hover/map:text-indigo-600 dark:group-hover/map:text-indigo-400 transition-colors">${s.العنوان || ''بدون عنوان''}</span>
                                <p class="text-[9px] font-black text-indigo-500 mt-1 flex items-center gap-1 opacity-0 group-hover/map:opacity-100 transition-opacity"><i class="fas fa-location-arrow"></i> فتح خريطة التتبع</p>
                            </div>
                        </div>'

$content = $content -replace [regex]::Escape($targetAddress.Replace("\[","[").Replace("\}", "}").Replace("\$","$").Replace("\.",".").Replace("\|","|")), $replaceAddress

$targetExport = '        function exportToExcel() {'

$replaceExport = '        // Map Variables
        let mapInstance = null;
        let mapRoutingControl = null;
        let repMarker = null;
        let destMarker = null;
        let mapWatchId = null;
        let mapCurrentShipmentId = null;

        function initMapUI() {
            if (document.getElementById(''map-overlay-container'')) return;
            const mapHtml = `
                <div id="map-overlay-container" class="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col transition-transform duration-300 translate-y-full will-change-transform">
                    <div class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shadow-sm z-10 shrink-0">
                        <div class="flex items-center gap-3">
                            <button id="close-map-btn" class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all text-xl">
                                <i class="fas fa-arrow-right"></i>
                            </button>
                            <div>
                                <h3 class="font-black text-slate-900 dark:text-white leading-none">التتبع والملاحة</h3>
                                <p id="map-shipment-client" class="text-[11px] font-bold text-indigo-600 mt-1">جاري التحميل...</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                             <span id="map-distance-badge" class="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-black rounded-lg border border-indigo-100 dark:border-indigo-800/50 hidden">0 كم</span>
                        </div>
                    </div>
                    
                    <div class="relative flex-1 bg-slate-200 dark:bg-slate-800 w-full">
                        <div id="leaflet-map" class="w-full h-full z-0"></div>
                        
                        <div id="map-loading-overlay" class="absolute inset-0 z-50 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
                            <div class="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p id="map-loading-text" class="mt-4 font-black text-slate-700 dark:text-slate-200 text-sm animate-pulse">جاري تحديد مسار الرحلة...</p>
                        </div>
                        
                        <button id="recenter-map-btn" class="absolute bottom-6 right-4 z-[60] w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 text-indigo-600 drop-shadow-xl flex items-center justify-center text-xl hover:scale-105 active:scale-95 transition-all border border-slate-100 dark:border-slate-700">
                            <i class="fas fa-crosshairs"></i>
                        </button>
                    </div>

                    <div class="bg-white dark:bg-slate-900 p-4 border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] shrink-0 z-10">
                        <div class="flex items-center justify-between gap-3">
                            <button id="map-start-btn" class="flex-1 bg-indigo-600 text-white rounded-xl py-3.5 font-black text-sm drop-shadow-md hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2">
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
            document.body.insertAdjacentHTML(''beforeend'', mapHtml);

            document.getElementById(''close-map-btn'').addEventListener(''click'', closeMapOverlay);
            document.getElementById(''recenter-map-btn'').addEventListener(''click'', recenterMap);
            document.getElementById(''map-arrive-btn'').addEventListener(''click'', async () => {
                if (!mapCurrentShipmentId) return;
                const confirmed = await Swal.fire({
                    title: ''تأكيد الوصول'',
                    text: ''هل أنت متأكد من تسليم الشحنة وتحديث حالتها إلى "تم التسليم"؟'',
                    icon: ''question'',
                    showCancelButton: true,
                    confirmButtonText: ''نعم، تم التسليم'',
                    cancelButtonText: ''إلغاء''
                });
                if (confirmed.isConfirmed) {
                    await updateStatus(mapCurrentShipmentId, ''تم التسليم'');
                    closeMapOverlay();
                }
            });
            document.getElementById(''map-start-btn'').addEventListener(''click'', () => {
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
            });
        }

        async function geocodeAddress(address) {
            const normalized = String(address || '''').trim().replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '' '');
            if (!normalized || normalized.length < 3) return null;
            
            const cacheKey = `geocode_${normalized}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try { return JSON.parse(cached); } catch(e){}
            }

            try {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalized + '' مصر'')}&limit=1`;
                const res = await fetch(url, { headers: { ''Accept-Language'': ''ar'' }});
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
            const container = document.getElementById(''map-overlay-container'');
            if (container) {
                container.classList.add(''translate-y-full'');
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
            
            const startBtn = document.getElementById(''map-start-btn'');
            if (startBtn) {
                startBtn.classList.remove(''opacity-50'', ''pointer-events-none'');
                startBtn.innerHTML = ''<i class="fas fa-route"></i> بدء التحرك'';
            }
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
            const overlay = document.getElementById(''map-overlay-container'');
            const loadingOverlay = document.getElementById(''map-loading-overlay'');
            const clientText = document.getElementById(''map-shipment-client'');
            const distanceBadge = document.getElementById(''map-distance-badge'');
            
            overlay.classList.remove(''translate-y-full'');
            loadingOverlay.classList.remove(''hidden'');
            clientText.innerText = s.اسم_العميل || ''شحنة'';
            distanceBadge.classList.add(''hidden'');
            
            if (!mapInstance) {
                mapInstance = L.map(''leaflet-map'', { zoomControl: false }).setView([30.0444, 31.2357], 12);
                L.control.zoom({ position: ''bottomleft'' }).addTo(mapInstance);
                L.tileLayer(''https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'', {
                    attribution: ''&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'',
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
                loadingOverlay.classList.add(''hidden'');
                Swal.fire(''خطأ'', ''التتبع غير مدعوم في متصفحك'', ''error'');
                closeMapOverlay();
                return;
            }

            try {
                const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
                });
                
                const repLat = pos.coords.latitude;
                const repLng = pos.coords.longitude;
                
                const repIconUrl = ''data:image/svg+xml;base64,'' + btoa(''<svg fill="#4f46e5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 0c17.7 0 32 14.3 32 32V66.7C368.4 80.1 431.9 143.6 445.3 224H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H445.3C431.9 368.4 368.4 431.9 288 445.3V480c0 17.7-14.3 32-32 32s-32-14.3-32-32V445.3C143.6 431.9 80.1 368.4 66.7 288H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H66.7C80.1 143.6 143.6 80.1 224 66.7V32c0-17.7 14.3-32 32-32zM128 256a128 128 0 1 0 256 0 128 128 0 1 0 -256 0zm128-80a80 80 0 1 1 0 160 80 80 0 1 1 0-160z"/></svg>'');
                const repIcon = L.icon({ iconUrl: repIconUrl, iconSize: [40, 40], iconAnchor: [20, 20] });
                repMarker = L.marker([repLat, repLng], { icon: repIcon }).addTo(mapInstance);
                
                document.getElementById(''map-loading-text'').innerText = ''جاري تحليل الوجهة...'';
                
                let destLat, destLng;
                const manualGeocode = await geocodeAddress(s.العنوان + '' '' + (s.الزون || ''''));
                if (manualGeocode) {
                    destLat = manualGeocode.lat;
                    destLng = manualGeocode.lng;
                } else {
                    Swal.fire({
                        toast: true, position: ''top-end'', icon: ''info'',
                        title: ''الخريطة تقريبية (لم يتم تحويل العنوان بدقة)'',
                        showConfirmButton: false, timer: 3000
                    });
                    destLat = 30.044 + (Math.random() * 0.1 - 0.05);
                    destLng = 31.235 + (Math.random() * 0.1 - 0.05);
                }

                const destIconUrl = ''data:image/svg+xml;base64,'' + btoa(''<svg fill="#f43f5e" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/></svg>'');
                const destIcon = L.icon({ iconUrl: destIconUrl, iconSize: [36, 48], iconAnchor: [18, 48], popupAnchor: [0, -48] });
                destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(mapInstance);
                destMarker.bindPopup(`<b>${s.اسم_العميل}</b><br>${s.العنوان}`);
                
                mapRoutingControl = L.Routing.control({
                    waypoints: [ L.latLng(repLat, repLng), L.latLng(destLat, destLng) ],
                    routeWhileDragging: false,
                    show: false,
                    addWaypoints: false,
                    lineOptions: { styles: [{ color: ''#4f46e5'', weight: 6, opacity: 0.8 }] },
                    createMarker: function() { return null; }
                }).addTo(mapInstance);
                
                mapRoutingControl.on(''routesfound'', function(e) {
                    const summary = e.routes[0].summary;
                    distanceBadge.innerText = (summary.totalDistance / 1000).toFixed(1) + '' كم'';
                    distanceBadge.classList.remove(''hidden'');
                    loadingOverlay.classList.add(''hidden'');
                });

                mapRoutingControl.on(''routingerror'', function() {
                    loadingOverlay.classList.add(''hidden'');
                    Swal.fire({
                        toast: true, position: ''top'', icon: ''warning'',
                        title: ''تعذر رسم المسار، سنعرض المواقع فقط'',
                        showConfirmButton: false, timer: 3000
                    });
                    mapInstance.fitBounds(L.latLngBounds([repLat, repLng], [destLat, destLng]).pad(0.2));
                });
                
                let lastCalcTime = Date.now();
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
                }, null, { enableHighAccuracy: true, maximumAge: 5000 });

            } catch (err) {
                loadingOverlay.classList.add(''hidden'');
                Swal.fire(''خطأ'', ''تعذر الحصول على موقعك الحالي. تأكد من تفعيل الـ GPS'', ''error'');
                closeMapOverlay();
            }
        }

        function exportToExcel() {'

$content = $content.Replace($targetExport, $replaceExport)

$targetClick = '            if (action === ''send-whatsapp'') {
                sendWhatsApp(id, actionEl.dataset.phoneKey || ''الهاتف'');
            }
        });'

$replaceClick = '            if (action === ''send-whatsapp'') {
                sendWhatsApp(id, actionEl.dataset.phoneKey || ''الهاتف'');
                return;
            }
            if (action === ''open-map'') {
                openTrackingMap(id);
                return;
            }
        });'

$content = $content.Replace($targetClick, $replaceClick)

Set-Content -Path rep.html -Value $content
