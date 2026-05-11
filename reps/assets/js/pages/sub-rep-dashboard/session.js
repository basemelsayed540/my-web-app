async function logout() {
                try {
                    if(trackingSystem && trackingSystem.isTracking) {
                        await trackingSystem.stopTracking();
                    }
                } catch(e) {
                    console.error('Logout tracking error', e);
                }
                RepsSession.clear();
            }

            document.addEventListener('click', (event) => {
                const menu = document.getElementById('shipmentMenu');
                if (!menu.contains(event.target)) {
                    closeShipmentMenu();
                }
            });
            window.addEventListener('resize', closeShipmentMenu);
            window.addEventListener('scroll', closeShipmentMenu);

            RepsTheme.apply();

            // Real-time updates
            supabaseClient
                .channel('follower_shipments')
                .on('postgres_changes', { event: '*', schema: 'public', table: CONFIG.TABLES.SHIPMENTS }, async (payload) => {
                    await fetchShipments();
                    renderTable();
                    console.log('تم مزامنة الجدول الرعي');
                })
                .subscribe();

            
