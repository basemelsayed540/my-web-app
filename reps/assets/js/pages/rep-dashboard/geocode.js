function getCachedShipmentCoordinates(shipment) {
            const directLat = Number(shipment?.lat ?? shipment?.latitude ?? shipment?.['خط العرض']);
            const directLng = Number(shipment?.lng ?? shipment?.longitude ?? shipment?.['خط الطول']);
            if (!Number.isNaN(directLat) && !Number.isNaN(directLng) && directLat && directLng) {
                return { lat: directLat, lng: directLng };
            }

            const addressCandidates = [
                `${shipment?.العنوان || ''} ${shipment?.الزون || ''}`.trim(),
                String(shipment?.العنوان || '').trim()
            ].filter(Boolean);

            for (const candidate of addressCandidates) {
                const normalized = candidate.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, ' ').trim();
                if (!normalized || normalized.length < 3) continue;
                const cacheKey = `geocode_${normalized}`;
                const cached = localStorage.getItem(cacheKey);
                if (!cached) continue;
                try {
                    const parsed = JSON.parse(cached);
                    const lat = Number(parsed?.lat);
                    const lng = Number(parsed?.lng);
                    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                        return { lat, lng };
                    }
                } catch (error) { }
            }

            return null;
        }

        function normalizeAddressCacheKey(value) {
            return String(value || '')
                .replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function buildShipmentGeocodeQueries(shipment) {
            const address = String(shipment?.العنوان || '').trim();
            const zone = String(shipment?.الزون || '').trim();
            const sender = String(shipment?.الراسل || '').trim();
            const cityHints = [zone, sender].filter(Boolean).join(' ');

            return [
                [address, zone, 'مصر'].filter(Boolean).join('، '),
                [address, cityHints, 'مصر'].filter(Boolean).join('، '),
                [address, 'مصر'].filter(Boolean).join('، ')
            ].map(normalizeAddressCacheKey).filter((value, index, arr) => value && arr.indexOf(value) === index);
        }

        async function fetchGeocodeCandidates(query) {
            const normalized = normalizeAddressCacheKey(query);
            if (!normalized || normalized.length < 3) return [];

            const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(normalized)}&limit=5&countrycodes=eg&addressdetails=1`;

            try {
                const res = await fetch(url, { headers: { 'Accept-Language': 'ar' } });
                const data = await res.json();
                if (!Array.isArray(data)) return [];

                const seen = new Set();
                return data
                    .map((item) => ({
                        lat: Number(item?.lat),
                        lng: Number(item?.lon),
                        label: item?.display_name || normalized,
                        raw: item
                    }))
                    .filter((item) => !Number.isNaN(item.lat) && !Number.isNaN(item.lng))
                    .filter((item) => {
                        const key = `${item.lat.toFixed(5)}_${item.lng.toFixed(5)}`;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });
            } catch (err) {
                return [];
            }
        }

        async function chooseGeocodeCandidate(shipment, candidates) {
            if (!Array.isArray(candidates) || candidates.length === 0) return null;

            const optionsHtml = candidates.map((candidate, index) => `
                <label class="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 px-3 py-3 text-right cursor-pointer hover:border-cyan-300 hover:bg-cyan-50/60 dark:hover:bg-slate-800 transition-colors">
                    <input type="radio" name="geocodeCandidate" value="${index}" ${index === 0 ? 'checked' : ''} class="mt-1 w-4 h-4 text-cyan-600 border-slate-300 focus:ring-cyan-500">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-200 leading-6">${candidate.label}</span>
                </label>
            `).join('');

            const { value: selectedIndex } = await Swal.fire({
                title: 'اختر الموقع الصحيح',
                html: `
                    <div class="space-y-3 text-right" dir="rtl">
                        <p class="text-sm font-bold text-slate-600">العنوان المدخل: <span class="text-slate-900">${shipment?.العنوان || '---'}</span></p>
                        <div class="max-h-72 overflow-y-auto space-y-2 pr-1">${optionsHtml}</div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'فتح الخريطة',
                cancelButtonText: 'إلغاء',
                focusConfirm: false,
                customClass: {
                    popup: 'rounded-2xl shadow-2xl'
                },
                preConfirm: () => {
                    const selected = document.querySelector('input[name="geocodeCandidate"]:checked');
                    if (!selected) {
                        Swal.showValidationMessage('اختر الموقع الصحيح أولاً');
                        return false;
                    }
                    return Number(selected.value);
                }
            });

            if (selectedIndex === undefined) return null;
            return candidates[selectedIndex] || null;
        }

        async function resolveShipmentDestinationCoords(shipment) {
            const queries = buildShipmentGeocodeQueries(shipment);
            const candidates = [];
            const seen = new Set();

            const cachedCoords = getCachedShipmentCoordinates(shipment);
            if (cachedCoords) {
                const key = `${cachedCoords.lat.toFixed(5)}_${cachedCoords.lng.toFixed(5)}`;
                seen.add(key);
                candidates.push({
                    lat: cachedCoords.lat,
                    lng: cachedCoords.lng,
                    label: `الموقع المحفوظ سابقًا - ${shipment?.العنوان || 'العنوان'}`
                });
            }

            for (const query of queries) {
                const result = await fetchGeocodeCandidates(query);
                for (const item of result) {
                    const key = `${item.lat.toFixed(5)}_${item.lng.toFixed(5)}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    candidates.push(item);
                }
            }

            const chosenCandidate = await chooseGeocodeCandidate(shipment, candidates);
            if (!chosenCandidate) return null;

            const result = { lat: chosenCandidate.lat, lng: chosenCandidate.lng };
            for (const query of queries) {
                const cacheKey = `geocode_${normalizeAddressCacheKey(query)}`;
                localStorage.setItem(cacheKey, JSON.stringify(result));
            }
            return result;
        }

        const REJECTION_REASON_OPTIONS = {
            'مطلبش حاجه': 'مطلبش حاجه',
            'مكرر': 'مكرر',
            'تهرب': 'تهرب',
            'بعد التاجيل': 'بعد التاجيل',
            'تهرب المنتج': 'تهرب المنتج',
            'غلط': 'غلط',
            'استلم من قبل': 'استلم من قبل',
            'مسافر': 'مسافر',
            'تاجيل بعد اسبوع': 'تاجيل بعد اسبوع'
        };

        async function promptRejectReason(confirmButtonText = 'تحديث الحالة') {
            const { value: reason } = await Swal.fire({
                title: 'سبب الرفض',
                input: 'text',
                inputPlaceholder: 'اكتب سبب الرفض',
                showCancelButton: true,
                confirmButtonText,
                cancelButtonText: 'إلغاء',
                confirmButtonColor: '#e11d48',
                customClass: {
                    input: 'rounded-xl text-sm font-bold',
                    popup: 'rounded-2xl shadow-2xl'
                },
                inputValidator: (value) => {
                    if (!String(value || '').trim()) return 'يرجى كتابة سبب الرفض';
                    return null;
                }
            });

            return String(reason || '').trim();
        }

        function getShipmentDistanceBadge(shipment) {
            const repLat = trackingSystem?.lastReportedLocation?.latitude;
            const repLng = trackingSystem?.lastReportedLocation?.longitude;
            if (typeof repLat !== 'number' || typeof repLng !== 'number') return null;

            const destination = getCachedShipmentCoordinates(shipment);
            if (!destination) return null;

            const distanceCalculator = typeof trackingSystem?.calculateDistance === 'function'
                ? trackingSystem.calculateDistance.bind(trackingSystem)
                : null;
            if (!distanceCalculator) return null;

            const distanceMeters = distanceCalculator(repLat, repLng, destination.lat, destination.lng);
            if (!Number.isFinite(distanceMeters)) return null;

            if (distanceMeters <= 800) {
                return { label: 'قريب', className: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
            }
            if (distanceMeters <= 2500) {
                return { label: 'بالقرب', className: 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' };
            }
            return null;
        }

        function renderShipmentInsightBadges(shipment, clientFrequencyMap) {
            const badges = [];

            if (isPriceEditShipment(shipment)) {
                badges.push({
                    label: 'معدلة السعر',
                    className: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
                });
            }

            if (isFavoriteShipment(shipment?.id)) {
                badges.push({
                    label: 'عميل مفضل',
                    className: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                });
            } else {
                const clientIdentity = getShipmentClientIdentity(shipment);
                if (clientIdentity && (clientFrequencyMap.get(clientIdentity) || 0) > 1) {
                    badges.push({
                        label: 'عميل متكرر',
                        className: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                    });
                }
            }

            if (getShipmentImportantNote(shipment)) {
                badges.push({
                    label: 'ملاحظة مهمة',
                    className: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                });
            }

            const distanceBadge = getShipmentDistanceBadge(shipment);
            if (distanceBadge) badges.push(distanceBadge);

            if (badges.length === 0) return '';

            return `
                <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                    ${badges.map(badge => `
                        <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black leading-none ${badge.className}">
                            ${badge.label}
                        </span>
                    `).join('')}
                </div>
            `;
        }

        
