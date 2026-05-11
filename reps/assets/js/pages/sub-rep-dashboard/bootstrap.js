const { createClient } = supabase;
            const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
            const SHIPMENT_PRICE_FIELD = 'السعر بعد التعديل';
            const SHIPMENT_PRICE_FIELD_LEGACY = 'السعر_بعد_التعديل';
            const SHIPMENT_CODE_FIELD = 'كود الشحنة';
            const SHIPMENT_CODE_FIELD_LEGACY = 'order_id';
            const SHIPMENT_COMMISSION_FIELD = 'عمولة المندوب';
            const SHIPMENT_COMMISSION_FIELD_LEGACY = 'عمولة_المندوب';
            const SHIPMENT_SUBREP_FIELD = 'نوع المندوب';
            const SHIPMENT_SUBREP_FIELD_LEGACY = 'المندوب الفرعي';

            const normalizeShipmentPriceField = RepsShipmentUtils.normalizeRecord;
            const toServerShipmentPayload = RepsShipmentUtils.toServerPayload;

            let trackingSystem = null;

            function updateTrackingUI() {
                const btn = document.getElementById('trackingToggleBtn');
                const icon = document.getElementById('trackingIcon');
                if(trackingSystem && trackingSystem.isTracking) {
                    btn.classList.replace('text-slate-400', 'text-emerald-500');
                    btn.classList.replace('dark:text-slate-300', 'dark:text-emerald-500');
                    icon.classList.add('animate-pulse');
                } else {
                    btn.classList.replace('text-emerald-500', 'text-slate-400');
                    btn.classList.replace('dark:text-emerald-500', 'dark:text-slate-300');
                    icon.classList.remove('animate-pulse');
                }
            }

            function toggleTracking() {
                if(!trackingSystem) return;
                const isNowActive = trackingSystem.toggleShift();
                updateTrackingUI();
            }

            let user = RepsSession.requireUser(['sub-rep'], 'login.html');
            startStoredUserSessionGuard(supabaseClient, {
                allowedRoles: ['sub-rep'],
                onValidUser: (latestUser) => {
                    user = latestUser;
                    const subRepName = document.getElementById('subRepName');
                    if (subRepName) subRepName.innerText = latestUser.full_name || latestUser.username || latestUser.phone;
                    
                    if(!trackingSystem) {
                        trackingSystem = new RepTrackingSystem(supabaseClient, latestUser);
                        if (!trackingSystem.isTracking) {
                            trackingSystem.startTracking();
                        }
                        updateTrackingUI();
                    }
                }
            });

            document.getElementById('subRepName').innerText = user.full_name || user.username || user.phone;

            let allShipments = [];
            let currentPage = 1;
            let activeShipmentMenuId = null;
            let globalStatFilter = ''; // Added global stat filter
            const itemsPerPage = 999999;
            const FOLLOWER_UI_STATE_KEY = 'followerUiState';

            function saveFollowerUiState() {
                try {
                    localStorage.setItem(FOLLOWER_UI_STATE_KEY, JSON.stringify({
                        search: document.getElementById('searchInput')?.value || '',
                        status: document.getElementById('filterStatus')?.value || '',
                        subrep: document.getElementById('filterSubRepName')?.value || '',
                        zone: document.getElementById('filterZone')?.value || '',
                        sender: document.getElementById('filterSender')?.value || '',
                        agent: document.getElementById('filterAgent')?.value || '',
                        update: document.getElementById('filterUpdate')?.value || '',
                        rep: document.getElementById('filterRep')?.value || '',
                        currentPage
                    }));
                } catch (error) { }
            }

            function restoreFollowerUiState() {
                let state = null;
                try {
                    state = JSON.parse(localStorage.getItem(FOLLOWER_UI_STATE_KEY) || 'null');
                } catch (error) {
                    state = null;
                }

                if (!state) return;

                const searchInput = document.getElementById('searchInput');
                const filterStatus = document.getElementById('filterStatus');
                const filterSubRepName = document.getElementById('filterSubRepName');
                const filterZone = document.getElementById('filterZone');
                const filterSender = document.getElementById('filterSender');
                const filterAgent = document.getElementById('filterAgent');
                const filterUpdate = document.getElementById('filterUpdate');

                if (searchInput) searchInput.value = state.search || '';
                if (filterStatus) filterStatus.value = state.status || '';
                if (filterSubRepName) filterSubRepName.value = state.subrep || '';
                if (filterZone) filterZone.value = state.zone || '';
                if (filterSender) filterSender.value = state.sender || '';
                if (filterAgent) filterAgent.value = state.agent || '';
                if (filterUpdate) filterUpdate.value = state.update || '';
                currentPage = Number(state.currentPage) || 1;
            }

            let filterDebounceTimer;
            function debouncedFilterData() {
                clearTimeout(filterDebounceTimer);
                filterDebounceTimer = setTimeout(() => {
                    const searchInput = document.getElementById('searchInput');
                    const val = (searchInput?.value || '').trim();
                    if (val.length > 0 && val.length < 3) return; // Do not apply search yet
                    filterData();
                }, 350);
            }

            function filterData() {
                currentPage = 1;
                populateFilters();
                renderTable();
                saveFollowerUiState();
            }

            
