function getUnreadSessionKey() {
            const repKey = normalizeComparableValue(user?.username || user?.phone || user?.full_name || 'rep');
            return `${REP_UNREAD_SESSION_KEY}${repKey}`;
        }

        function loadUnreadShipmentIds() {
            try {
                const raw = sessionStorage.getItem(getUnreadSessionKey());
                const ids = JSON.parse(raw || '[]');
                return new Set((Array.isArray(ids) ? ids : []).map(id => String(id)));
            } catch (error) {
                return new Set();
            }
        }

        function saveUnreadShipmentIds(ids) {
            try {
                sessionStorage.setItem(getUnreadSessionKey(), JSON.stringify([...ids]));
            } catch (error) { }
        }

        function setUnreadBadge(count) {
            const badge = document.getElementById('repUnreadBadge');
            if (!badge) return;

            const safeCount = Number(count) || 0;
            badge.innerText = safeCount > 99 ? '99+' : String(safeCount);
            badge.classList.toggle('hidden', safeCount <= 0);
            document.title = safeCount > 0 ? `(${safeCount}) لوحة المندوب | نظام الشحن الاحترافي` : 'لوحة المندوب | نظام الشحن الاحترافي';
        }

        function initUnreadBadge() {
            const unreadIds = loadUnreadShipmentIds();
            setUnreadBadge(unreadIds.size);
        }

        function playNotificationSound() {
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;

                if (!notificationAudioContext) {
                    notificationAudioContext = new AudioContextClass();
                }

                if (notificationAudioContext.state === 'suspended') {
                    notificationAudioContext.resume().catch(() => { });
                }

                const now = notificationAudioContext.currentTime;
                const gain = notificationAudioContext.createGain();
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.15, now + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
                gain.connect(notificationAudioContext.destination);

                [880, 1320].forEach((freq, index) => {
                    const osc = notificationAudioContext.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + index * 0.12);
                    osc.connect(gain);
                    osc.start(now + index * 0.12);
                    osc.stop(now + 0.18 + index * 0.12);
                });
            } catch (error) { }
        }

        function enableAudioOnInteraction() {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            if (!notificationAudioContext) {
                try {
                    notificationAudioContext = new AudioContextClass();
                } catch (error) { }
            }
            if (notificationAudioContext && notificationAudioContext.state === 'suspended') {
                notificationAudioContext.resume().catch(() => { });
            }
        }

        window.addEventListener('pointerdown', enableAudioOnInteraction, { once: true, passive: true });
        window.addEventListener('keydown', enableAudioOnInteraction, { once: true });

        function syncUnreadShipments(newShipments) {
            if (!newShipments || newShipments.length === 0) return;

            const unreadIds = loadUnreadShipmentIds();
            let changed = false;
            newShipments.forEach(shipment => {
                const id = String(shipment?.id || '');
                if (!id || unreadIds.has(id)) return;
                unreadIds.add(id);
                changed = true;
            });

            if (!changed) return;

            saveUnreadShipmentIds(unreadIds);
            setUnreadBadge(unreadIds.size);
            playNotificationSound();
        }

        function getRepNotificationKey() {
            const repKey = normalizeComparableValue(user?.username || user?.phone || user?.full_name || 'rep');
            return `${REP_SEEN_SHIPMENTS_KEY_PREFIX}${repKey}`;
        }

        function getRepFavoritesKey() {
            const repKey = normalizeComparableValue(user?.username || user?.phone || user?.full_name || 'rep');
            return `${REP_FAVORITES_KEY_PREFIX}${repKey}`;
        }

        function loadFavoriteShipmentIds() {
            try {
                const raw = localStorage.getItem(getRepFavoritesKey());
                const ids = JSON.parse(raw || '[]');
                return new Set((Array.isArray(ids) ? ids : []).map(id => String(id)));
            } catch (error) {
                return new Set();
            }
        }

        function saveFavoriteShipmentIds(ids) {
            try {
                localStorage.setItem(getRepFavoritesKey(), JSON.stringify([...ids]));
            } catch (error) { }
        }

        function sortFavoriteShipmentsBySelectionOrder(shipments) {
            const favoriteOrder = new Map([...favoriteShipmentIds].map((id, index) => [String(id), index]));
            return [...(shipments || [])].sort((a, b) => {
                const orderA = favoriteOrder.has(String(a?.id)) ? favoriteOrder.get(String(a.id)) : Number.MAX_SAFE_INTEGER;
                const orderB = favoriteOrder.has(String(b?.id)) ? favoriteOrder.get(String(b.id)) : Number.MAX_SAFE_INTEGER;
                return orderA - orderB;
            });
        }

        function updateFavoritesNavBadge() {
            const badge = el('favoritesCountBadge');
            if (!badge) return;
            const count = favoriteShipmentIds.size;
            badge.innerText = count;
            badge.classList.toggle('hidden', count === 0);
        }

        function isFavoriteShipment(id) {
            return favoriteShipmentIds.has(String(id));
        }

        function toggleFavoriteShipment(id) {
            const strId = String(id);
            if (favoriteShipmentIds.has(strId)) favoriteShipmentIds.delete(strId);
            else favoriteShipmentIds.add(strId);
            saveFavoriteShipmentIds(favoriteShipmentIds);
            updateFavoritesNavBadge();
            invalidateShipmentRenderCache();
            renderShipments();
        }

        function loadSeenShipmentIds() {
            try {
                const raw = localStorage.getItem(getRepNotificationKey());
                const ids = JSON.parse(raw || '[]');
                return new Set((Array.isArray(ids) ? ids : []).map(id => String(id)));
            } catch (error) {
                return new Set();
            }
        }

        function saveSeenShipmentIds(ids) {
            try {
                localStorage.setItem(getRepNotificationKey(), JSON.stringify([...ids]));
            } catch (error) { }
        }

        function getShipmentDisplayLabel(shipment) {
            return String(
                shipment?.كود_الشحنة ||
                shipment?.order_id ||
                shipment?.id ||
                shipment?.الاسم ||
                ''
            ).trim();
        }

        function showNewShipmentNotification(newShipments) {
            if (!newShipments || newShipments.length === 0) return;

            const count = newShipments.length;
            const codes = newShipments
                .map(getShipmentDisplayLabel)
                .filter(Boolean)
                .slice(0, 3);
            const extra = count > codes.length ? ` و${count - codes.length} أخرى` : '';
            const body = codes.length
                ? `تم تنزيل ${count} شحنة جديدة عليك: ${codes.join('، ')}${extra}`
                : `تم تنزيل ${count} شحنة جديدة عليك`;

            Swal.fire({
                toast: true,
                position: 'top-start',
                icon: 'success',
                title: 'شحنات جديدة',
                text: body,
                showConfirmButton: false,
                timer: 5000,
                timerProgressBar: true
            });

            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification('شحنات جديدة للمندوب', {
                        body,
                        dir: 'rtl'
                    });
                } catch (error) { }
            }
        }

        function showShipmentUpdateNotification(type, shipment) {
            if (!shipment) return;
            if (type !== 'status_changed') return;
            playNotificationSound();
        }

        function getShipmentUpdateValue(shipment) {
            const directValue = shipment?.['اليومية'] ?? shipment?.اليومية ?? shipment?.['اليوميه'];
            if (directValue !== null && directValue !== undefined) {
                const normalized = String(directValue).trim();
                if (normalized) return normalized;
            }

            if (!shipment || typeof shipment !== 'object') return '';
            const fallbackKey = Object.keys(shipment).find((key) => {
                const normalizedKey = String(key || '').replace(/\s+/g, '').trim();
                return normalizedKey === 'اليومية' || normalizedKey === 'اليوميه';
            });
            if (!fallbackKey) return '';

            const fallbackValue = shipment[fallbackKey];
            if (fallbackValue === null || fallbackValue === undefined) return '';
            return String(fallbackValue).trim();
        }

        function getShipmentDailyFilterValue(shipment) {
            if (typeof getShipmentDailyValue === 'function') {
                return String(getShipmentDailyValue(shipment) || '').trim();
            }
            return getShipmentUpdateValue(shipment);
        }

        function detectShipmentChanges(previousMap, currentShipments, repIdentifiers) {
            if (!previousMap || previousMap.size === 0) return;

            const currentMap = new Map(currentShipments.map((shipment) => [String(shipment.id), shipment]));

            currentShipments.forEach((shipment) => {
                const shipmentId = String(shipment.id);
                const previous = previousMap.get(shipmentId);
                if (!previous) return;

                const wasMine = shipmentBelongsToRep(previous, repIdentifiers);
                const isMine = shipmentBelongsToRep(shipment, repIdentifiers);

                if (!wasMine || !isMine) return;

                const hasChanges = Object.keys(shipment).some((key) => {
                    if (['t_updated', 'تاريخ التحديث', 'updated_at'].includes(key)) return false;
                    return String(shipment[key] ?? '').trim() !== String(previous[key] ?? '').trim();
                });

                if (!hasChanges) return;

                if (String(previous.الحالة || '').trim() !== String(shipment.الحالة || '').trim()) {
                    addRepNotification('status_changed', shipment);
                    showShipmentUpdateNotification('status_changed', shipment);
                } else {
                    addRepNotification('updated', shipment);
                    showShipmentUpdateNotification('updated', shipment);
                }
            });

            previousMap.forEach((previous, shipmentId) => {
                if (currentMap.has(shipmentId)) return;
                const wasMine = shipmentBelongsToRep(previous, repIdentifiers);
                if (wasMine) addRepNotification('deleted', previous);
            });
        }

        
