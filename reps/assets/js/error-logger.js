/**
 * نظام تقارير الأخطاء المحلي (Local Error Logger)
 * يقوم بالتقاط الأخطاء وتخزينها في localStorage للرجوع إليها عند الحاجة.
 */

(function() {
    const STORAGE_KEY = 'app_error_logs';
    const MAX_LOGS = 50; // الحد الأقصى للسجلات المحفوظة

    // وظيفة لحفظ الخطأ
    function saveError(errorData) {
        try {
            let logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            const newLog = {
                timestamp: new Date().toLocaleString('ar-EG'),
                page: window.location.pathname.split('/').pop(),
                ...errorData
            };

            logs.unshift(newLog); // إضافة الخطأ في البداية
            if (logs.length > MAX_LOGS) logs = logs.slice(0, MAX_LOGS); // الحفاظ على الحد الأقصى

            localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
        } catch (e) {
            console.error('Failed to save error log:', e);
        }
    }

    // التقاط أخطاء JavaScript العامة
    window.onerror = function(message, source, lineno, colno, error) {
        saveError({
            type: 'JS Error',
            message: message,
            source: source ? source.split('/').pop() : 'unknown',
            line: lineno,
            column: colno,
            stack: error ? error.stack : ''
        });
        return false; // السماح للخطأ بالظهور في Console أيضاً
    };

    // التقاط أخطاء الـ Promises غير المعالجة
    window.onunhandledrejection = function(event) {
        saveError({
            type: 'Promise Rejection',
            message: event.reason ? (event.reason.message || event.reason) : 'No reason provided',
            stack: event.reason ? event.reason.stack : ''
        });
    };

    // وظيفة لعرض الأخطاء (يمكن استدعاؤها من أي مكان)
    window.showErrorLogs = function() {
        const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

        if (logs.length === 0) {
            Swal.fire({
                title: 'سجل الأخطاء',
                text: 'لا توجد أخطاء مسجلة حالياً.',
                icon: 'info',
                confirmButtonText: 'حسناً'
            });
            return;
        }

        let html = '<div class="text-right" style="max-height: 400px; overflow-y: auto; font-family: Cairo, sans-serif;">';
        logs.forEach((log, index) => {
            html += `
                <div class="mb-4 p-3 border rounded-lg ${log.type === 'JS Error' ? 'bg-red-50' : 'bg-orange-50'} border-slate-200">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-xs font-bold text-slate-500">${log.timestamp}</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${log.type === 'JS Error' ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'}">
                            ${log.type}
                        </span>
                    </div>
                    <div class="text-sm font-bold text-slate-800 mb-1">${log.message}</div>
                    <div class="text-[11px] text-slate-600">الصفحة: ${log.page}</div>
                    ${log.source ? `<div class="text-[11px] text-slate-600">الملف: ${log.source} (سطر: ${log.line})</div>` : ''}
                </div>
            `;
        });
        html += '</div>';

        Swal.fire({
            title: 'تقارير الأخطاء المسجلة',
            html: html,
            showCancelButton: true,
            confirmButtonText: 'مسح السجل',
            cancelButtonText: 'إغلاق',
            confirmButtonColor: '#d33',
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem(STORAGE_KEY);
                Swal.fire('تم المسح', 'تم تنظيف سجل الأخطاء بنجاح.', 'success');
            }
        });
    };
})();
