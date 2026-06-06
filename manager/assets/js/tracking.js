const TRACKING_CONFIG = {
    SYNC_INTERVAL_MS_ACTIVE: 5 * 60 * 1000,   // 5 دقائق عند النشاط
    SYNC_INTERVAL_MS_IDLE: 10 * 60 * 1000,    // 10 دقائق عند الثبات
    DISTANCE_THRESHOLD_M: 100,                // 100 متر مسافة التحديث الفوري
    STORAGE_KEY: 'rep_offline_locations',
    SHIFT_STATUS_KEY: 'rep_shift_active',
};

class RepTrackingSystem {
    constructor(supabaseClient, user) {
        this.supabase = supabaseClient;
        this.user = user;
        this.watchId = null;
        this.isTracking = localStorage.getItem(TRACKING_CONFIG.SHIFT_STATUS_KEY) === 'true';
        this.lastReportedLocation = null;
        this.lastReportTime = 0;
        this.syncTimer = null;
        this.status = 'offline';
        
        // Auto start if shift was left active
        if (this.isTracking) {
            this.startTracking();
        }
    }

    async getQueue() {
        try {
            return JSON.parse(localStorage.getItem(TRACKING_CONFIG.STORAGE_KEY) || '[]');
        } catch {
            return [];
        }
    }

    async saveToQueue(locationData) {
        const queue = await this.getQueue();
        queue.push(locationData);
        // Keep max 200 items to prevent storage overflow
        if (queue.length > 200) queue.shift();
        localStorage.setItem(TRACKING_CONFIG.STORAGE_KEY, JSON.stringify(queue));
    }

    async clearQueue(syncedItems) {
        const queue = await this.getQueue();
        const syncedTimestamps = syncedItems.map(i => i.timestamp);
        const filtered = queue.filter(i => !syncedTimestamps.includes(i.timestamp));
        localStorage.setItem(TRACKING_CONFIG.STORAGE_KEY, JSON.stringify(filtered));
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI/180; // φ, λ in radians
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; 
    }

    handlePositionUpdate = async (position) => {
        const { latitude, longitude, speed } = position.coords;
        const now = Date.now();
        
        let shouldSync = false;
        
        // Determine Status based on speed (m/s) -> > 1m/s is moving
        this.status = (speed && speed > 1) ? 'online' : 'idle';

        if (!this.lastReportedLocation) {
            shouldSync = true;
        } else {
            const dist = this.calculateDistance(
                this.lastReportedLocation.latitude, this.lastReportedLocation.longitude, 
                latitude, longitude
            );
            
            const timeDiff = now - this.lastReportTime;
            const currentIntervalWait = this.status === 'online' ? TRACKING_CONFIG.SYNC_INTERVAL_MS_ACTIVE : TRACKING_CONFIG.SYNC_INTERVAL_MS_IDLE;

            if (dist >= TRACKING_CONFIG.DISTANCE_THRESHOLD_M || timeDiff >= currentIntervalWait) {
                shouldSync = true;
            }
        }

        if (shouldSync) {
            const locData = {
                rep_id: this.user.id,
                rep_name: this.user.username || this.user.phone,
                lat: latitude,
                lng: longitude,
                status: this.status,
                timestamp: new Date().toISOString()
            };

            this.lastReportedLocation = { latitude, longitude };
            this.lastReportTime = now;

            await this.saveToQueue(locData);
            this.triggerSync();
        }
    }

    handleError = (error) => {
        console.warn('Geolocation Error:', error.message);
        if (error.code === 1) { // PERMISSION_DENIED
            this.stopTracking();
            if (window.Swal) Swal.fire('تنبيه', 'برجاء السماح بصلاحية الموقع للاستمرار في الشيفت.', 'warning');
        }
    }

    async triggerSync() {
        if (!navigator.onLine) return; // Offline, wait.
        
        const queue = await this.getQueue();
        if (queue.length === 0) return;

        try {
            // Upload to Supabase
            const { error } = await this.supabase
                .from('rep_locations')
                .insert(queue);
            
            if (error) {
                // Table doesn't exist or RLS issues
                console.error("Sync Error:", error.message);
            } else {
                // Success, clear the queue
                await this.clearQueue(queue);
            }
        } catch (e) {
            console.error("Sync Exception:", e);
        }
    }

    startTracking() {
        if (!navigator.geolocation) {
            if (window.Swal) Swal.fire('خطأ', 'متصفحك لا يدعم تحديد الموقع.', 'error');
            return false;
        }
        
        this.isTracking = true;
        localStorage.setItem(TRACKING_CONFIG.SHIFT_STATUS_KEY, 'true');
        
        this.watchId = navigator.geolocation.watchPosition(
            this.handlePositionUpdate, 
            this.handleError, 
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );

        // Background sync loop to ensure we send data if network comes back
        this.syncTimer = setInterval(() => {
            if (navigator.onLine) this.triggerSync();
        }, 60000); // Check every minute

        return true;
    }

    async stopTracking() {
        this.isTracking = false;
        localStorage.setItem(TRACKING_CONFIG.SHIFT_STATUS_KEY, 'false');
        
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }

        // Send final offline ping
        if (this.lastReportedLocation && navigator.onLine) {
            const locData = {
                rep_id: this.user.id,
                rep_name: this.user.username || this.user.phone,
                lat: this.lastReportedLocation.latitude,
                lng: this.lastReportedLocation.longitude,
                status: 'offline', // Mark shift end
                timestamp: new Date().toISOString()
            };
            await this.supabase.from('rep_locations').insert([locData]);
        }
    }

    toggleShift() {
        if (this.isTracking) {
            this.stopTracking();
            return false; // returned inactive
        } else {
            return this.startTracking(); // return active state
        }
    }
}
window.RepTrackingSystem = RepTrackingSystem;
