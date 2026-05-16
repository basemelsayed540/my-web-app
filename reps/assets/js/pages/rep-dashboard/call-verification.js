/**
 * محرك التحقق من المكالمات (Call Verification Engine)
 * يستخدم الـ Plugin الخاص بالأندرويد لقراءة سجل المكالمات الحقيقي
 */

window.CallVerificationEngine = (function() {
    const PLUGIN_NAME = 'CallVerification';

    async function invokePlugin(method, data = {}) {
        if (typeof Capacitor === 'undefined') {
            console.warn('Capacitor is not available. Call verification bypassed.');
            return { status: 'bypass', matched: true };
        }
        try {
            return await Capacitor.Plugins[PLUGIN_NAME][method](data);
        } catch (error) {
            console.error(`CallVerification Plugin Error (${method}):`, error);
            return { status: 'error', matched: false, error: error.message };
        }
    }

    async function checkPermissions() {
        const result = await invokePlugin('requestPermissions');
        return result.callLog === 'granted';
    }

    /**
     * يبدأ عملية مراقبة الاتصال برقم معين
     */
    async function startVerification(phone) {
        if (!phone) return null;
        return await invokePlugin('startDialerVerification', { phone });
    }

    /**
     * يتحقق من وجود مكالمة في السجل بعد انتهاء المندوب
     */
    async function finalizeVerification() {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            const result = await invokePlugin('finalizeDialerVerification');

            if (result.status === 'awaiting_sync') {
                // السجل قد يحتاج ثانية أو ثانيتين ليتحدث في نظام الأندرويد
                await new Promise(resolve => setTimeout(resolve, 1500));
                attempts++;
                continue;
            }

            return result;
        }

        return { status: 'sync_timeout', matched: false };
    }

    /**
     * الوظيفة الرئيسية: هل هذا الرقم تم الاتصال به فعلاً؟
     * تستخدم للفحص السريع بدون فتح الـ Dialer (إذا أردنا فحص السجل مباشرة)
     * ملاحظة: الـ Plugin الحالي مصمم لفتح الـ Dialer أولاً، سأستخدم finalize للتحقق من أي عملية معلقة.
     */
    async function isCallVerified() {
        const result = await finalizeVerification();
        return result.matched === true;
    }

    return {
        checkPermissions,
        startVerification,
        finalizeVerification,
        isCallVerified
    };
})();
