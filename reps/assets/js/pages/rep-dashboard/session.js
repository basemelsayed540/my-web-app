function logout() {
            RepsSession.clear();
        }

        RepsTheme.apply();

        // Real-time listener
        const channel = supabaseClient
            .channel('public:elsayed')
            .on('postgres_changes', { event: '*', schema: 'public', table: CONFIG.TABLES.SHIPMENTS }, async (payload) => {
                const event = payload.eventType;
                const newRow = payload.new;
                const oldRow = payload.old;
                const repIdentifiers = new Set(getRepIdentifiers().map(normalizeComparableValue));

                if (event === 'INSERT') {
                    if (shipmentBelongsToRep(newRow, repIdentifiers)) {
                        addRepNotification('added', newRow);
                    }
                } else if (event === 'UPDATE') {
                    const localOld = lastServerShipmentsMap.get(String(newRow.id)) || allShipments.find(s => String(s.id) === String(newRow.id));
                    const wasMine = localOld && shipmentBelongsToRep(localOld, repIdentifiers);
                    const currentRepInRows = newRow.hasOwnProperty('المندوب') ? newRow.المندوب : (localOld ? localOld.المندوب : null);
                    const isMine = shipmentBelongsToRep({ ...localOld, ...newRow, المندوب: currentRepInRows }, repIdentifiers);

                    const merged = { ...localOld, ...newRow };
                    if (!wasMine && isMine) addRepNotification('added', merged);
                    else if (wasMine && !isMine) addRepNotification('removed', merged);
                    else if (wasMine && isMine && localOld) {
                        const hasChanges = Object.keys(newRow).some(k => {
                            if (['t_updated', 'تاريخ التحديث', 'updated_at'].includes(k)) return false;
                            return String(newRow[k] || '').trim() !== String(localOld[k] || '').trim();
                        });
                        if (hasChanges) {
                            if (newRow.hasOwnProperty('الحالة') && localOld.الحالة !== newRow.الحالة) {
                                addRepNotification('status_changed', merged);
                                showShipmentUpdateNotification('status_changed', merged);
                            } else {
                                addRepNotification('updated', merged);
                                showShipmentUpdateNotification('updated', merged);
                            }
                        }
                    }
                    
                } else if (event === 'DELETE') {
                    const localDeleted = lastServerShipmentsMap.get(String(oldRow.id)) || allShipments.find(s => String(s.id) === String(oldRow.id));
                    if (localDeleted && shipmentBelongsToRep(localDeleted, repIdentifiers)) {
                        addRepNotification('deleted', localDeleted);
                    }
                }

                const shouldGlowDateFilter =
                    event === 'INSERT' ||
                    event === 'DELETE' ||
                    (event === 'UPDATE' && String(oldRow?.الحالة || '').trim() !== String(newRow?.الحالة || '').trim());
                if (shouldGlowDateFilter) triggerDateFilterGlow();
                await fetchShipments({ skipChangeNotifications: true });
                console.log('تحديث جديد للشحنات');
            })
            .subscribe();

        supabaseClient
            .channel('public:settlements_rep_lock')
            .on('postgres_changes', { event: '*', schema: 'public', table: CONFIG.TABLES.SETTLEMENTS }, payload => {
                triggerDateFilterGlow();
                fetchShipments({ skipChangeNotifications: true });
            })
            .subscribe();

        
