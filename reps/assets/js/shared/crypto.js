/**
 * نظام التشفير وتأمين البيانات المحلية
 * يستخدم لتشفير البيانات المخزنة في localStorage
 */

window.AppCrypto = (() => {
    const SECRET_KEY = 'lite-shipping-secure-key-2024';
    const PREFIX = '__enc__:';

    /**
     * تشفير نص أو كائن
     */
    function encrypt(data) {
        try {
            if (!data) return null;
            const strData = typeof data === 'object' ? JSON.stringify(data) : String(data);
            return PREFIX + CryptoJS.AES.encrypt(strData, SECRET_KEY).toString();
        } catch (e) {
            console.error('Encryption error:', e);
            return null;
        }
    }

    /**
     * فك تشفير نص وإرجاعه لأصله
     */
    function decrypt(encryptedData) {
        try {
            if (!encryptedData) return null;

            let dataToParse = encryptedData;

            // إذا كان النص يبدأ ببادئة التشفير الخاصة بنا، نقوم بفك تشفيره
            if (typeof encryptedData === 'string' && encryptedData.startsWith(PREFIX)) {
                const actualData = encryptedData.substring(PREFIX.length);
                const bytes = CryptoJS.AES.decrypt(actualData, SECRET_KEY);
                dataToParse = bytes.toString(CryptoJS.enc.Utf8);
            }

            if (!dataToParse) return null;

            // محاولة تحويله لكائن إذا كان JSON (سواء كان مشفراً أصلاً أو نصاً واضحاً قديماً)
            try {
                return JSON.parse(dataToParse);
            } catch {
                return dataToParse;
            }
        } catch (e) {
            console.error('Decryption error:', e);
            return null;
        }
    }

    /**
     * حفظ بيانات مشفرة في localStorage
     */
    function setItem(key, value) {
        const encrypted = encrypt(value);
        if (encrypted) {
            localStorage.setItem(key, encrypted);
        }
    }

    /**
     * جلب بيانات مشفرة من localStorage
     */
    function getItem(key) {
        const value = localStorage.getItem(key);
        if (!value) return null;
        return decrypt(value);
    }

    return {
        encrypt,
        decrypt,
        setItem,
        getItem
    };
})();
