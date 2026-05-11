const { createClient } = supabase;
        const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        const SHIPMENT_CODE_FIELD = 'كود الشحنة';
        const SHIPMENT_CODE_FIELD_LEGACY = 'order_id';

        const normalizeShipmentRecord = RepsShipmentUtils.normalizeRecord;

        let user = RepsSession.requireUser(['rep', 'مندوب فرعي'], '../index.html');
        startStoredUserSessionGuard(supabaseClient, {
            allowedRoles: ['rep', 'مندوب فرعي'],
            redirectTo: '../index.html',
            onValidUser: (latestUser) => {
                user = latestUser;
            }
        });

        let map, repMarker;
        let repCoords = null;
        let customerMarkers = [];
        let currentPolyline = null;
        let distanceLabel = null;

        function isPendingStatus(status) {
            const normalizedStatus = String(status || '').trim();
            return normalizedStatus === '' || normalizedStatus === 'قيد' || normalizedStatus === 'قيد التنفيذ' || normalizedStatus === 'قيد التوصيل';
        }

        // Icons
        const repIcon = L.divIcon({
            html: '<div class="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white"><i class="fas fa-motorcycle"></i></div>',
            className: 'custom-div-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const customerIcon = L.divIcon({
            html: '<div class="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white"><i class="fas fa-map-marker-alt"></i></div>',
            className: 'custom-div-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        function initMap() {
            // Default center (Cairo)
            map = L.map('map').setView([30.0444, 31.2357], 11);
            
            // Standard OpenStreetMap tiles (Free)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            locateRepresentative();
        }

        function locateRepresentative() {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(position => {
                    repCoords = [position.coords.latitude, position.coords.longitude];
                    
                    if (repMarker) {
                        repMarker.setLatLng(repCoords);
                    } else {
                        repMarker = L.marker(repCoords, {icon: repIcon}).addTo(map)
                            .bindPopup('<b>موقعك الحالي</b>');
                    }
                    
                    map.setView(repCoords, 13);
                    document.getElementById('mapStatus').innerText = "تم تحديد الموقع - جاري جلب الشحنات";
                    document.getElementById('mapStatus').className = "text-[10px] font-bold text-emerald-600";
                    
                    fetchPendingShipments();
                }, error => {
                    console.error(error);
                    Swal.fire('تنبيه', 'يرجى تفعيل صلاحية الوصول للموقع الجغرافي (GPS) لتعمل الخريطة بشكل صحيح.', 'warning');
                    document.getElementById('mapStatus').innerText = "موقع غير متوفر - يرجى تفعيل الـ GPS";
                    document.getElementById('mapStatus').className = "text-[10px] font-bold text-rose-500";
                    fetchPendingShipments(); // Fetch anyway
                }, {
                    enableHighAccuracy: true
                });
            } else {
                Swal.fire('خطأ', 'متصفحك لا يدعم تحديد الموقع', 'error');
            }
        }

        async function fetchPendingShipments() {
            const { data, error } = await supabaseClient
                .from(CONFIG.TABLES.SHIPMENTS)
                .select('*')
                .eq('المندوب', user.username || user.phone);

            if (error) {
                console.error(error);
                return;
            }

            // Only pending deliveries
            const pendingShipments = (data || []).map(normalizeShipmentRecord).filter(s => isPendingStatus(s.الحالة));
            
            if (pendingShipments.length === 0) {
                document.getElementById('mapStatus').innerText = "لا توجد شحنات قيد التوصيل";
                return;
            }

            document.getElementById('mapStatus').innerText = `جاري تحديد مواقع ${pendingShipments.length} عميل...`;
            mapCustomers(pendingShipments);
        }

        async function mapCustomers(shipments) {
            // Processing a few at a time to avoid Nominatim rate limits (1 req/sec recommended)
            for (const s of shipments) {
                if (!s.العنوان) continue;

                // Simple cache to avoid redundant calls for same address
                let coords = null;
                try {
                    // Enhancing the search query text for better Egypt hits
                    const addressQuery = s.العنوان + " , مصر"; 
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&limit=1`);
                    const results = await response.json();
                    
                    if (results && results.length > 0) {
                        coords = [parseFloat(results[0].lat), parseFloat(results[0].lon)];
                    }
                } catch (e) {
                    console.error("Geocoding failed for:", s.العنوان);
                }

                if (coords) {
                    const marker = L.marker(coords, {icon: customerIcon}).addTo(map);
                    
                    const popupContent = `
                        <div class="text-right" dir="rtl">
                            <h4 class="font-bold text-sm text-indigo-600 mb-1">#${s.order_id} - ${s.اسم_العميل || 'عميل'}</h4>
                            <p class="text-xs text-slate-600 mb-2 line-clamp-2">${s.العنوان}</p>
                            <p class="text-sm font-black text-slate-800">${s.المبلغ || 0} ج.م</p>
                            <button onclick="calculateDistanceToCustomer(${coords[0]}, ${coords[1]}, '${s.اسم_العميل}')" class="mt-3 w-full bg-indigo-50 text-indigo-600 font-bold py-1 px-2 rounded hover:bg-indigo-100 transition">عرض المسافة</button>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    customerMarkers.push(marker);
                }
                
                // Be gentle with public API
                await new Promise(r => setTimeout(r, 1000));
            }
            
            if (customerMarkers.length > 0) {
                document.getElementById('mapStatus').innerText = "تم عرض العملاء على الخريطة";
                
                // Fit map to show rep and all found customers
                const group = new L.featureGroup([...customerMarkers]);
                if (repMarker) group.addLayer(repMarker);
                map.fitBounds(group.getBounds().pad(0.1));
            } else {
                document.getElementById('mapStatus').innerText = "لم نتمكن من تحديد مواقع العملاء بدقة";
            }
        }

        // Must assign to window to be accessible from Leaflet popup
        window.calculateDistanceToCustomer = function(lat, lng, name) {
            if (!repCoords) {
                Swal.fire('عذراً', 'موقعك الحالي غير معروف لرسم المسار', 'warning');
                return;
            }

            // Remove existing line and label
            if (currentPolyline) map.removeLayer(currentPolyline);
            if (distanceLabel) map.removeLayer(distanceLabel);

            const customerCoords = [lat, lng];
            
            // Draw line
            currentPolyline = L.polyline([repCoords, customerCoords], {
                color: '#4f46e5',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 10'
            }).addTo(map);

            // Calculate distance (in meters)
            const distanceMeters = map.distance(repCoords, customerCoords);
            const distStr = distanceMeters > 1000 
                            ? (distanceMeters / 1000).toFixed(2) + ' كم' 
                            : Math.round(distanceMeters) + ' متر';

            // Add distance label halfway
            const centerLat = (repCoords[0] + customerCoords[0]) / 2;
            const centerLng = (repCoords[1] + customerCoords[1]) / 2;

            const labelIcon = L.divIcon({
                className: 'distance-label-container',
                html: `<div class="distance-label">${distStr}</div>`,
                iconSize: [80, 24]
            });

            distanceLabel = L.marker([centerLat, centerLng], {icon: labelIcon}).addTo(map);

            // Zoom out to see both
            map.fitBounds(currentPolyline.getBounds().pad(0.2));
            
            map.closePopup();
            
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: `المسافة التقديرية إلى ${name || 'العميل'}: ${distStr}`,
                showConfirmButton: false,
                timer: 3000
            });
        };

        RepsTheme.apply();

        // Initialize Map
        document.addEventListener('DOMContentLoaded', initMap);
