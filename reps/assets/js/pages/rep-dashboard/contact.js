/**
 * نظام التواصل مع العملاء (واتساب واتصال)
 * ملاحظة: المتغيرات العامة تم تعريفها في bootstrap.js
 */

(function() {
    const CONTACT_RESULT_PRESETS = {
        whatsapp: [
            'تم التواصل واتساب',
            'الرقم غير مسجل واتساب',
            'رقم غير صحيح'
        ],
        call: [
            'تم الرد',
            'لم يرد',
            'رقم غير صحيح'
        ],
        manual: [
            'تم الرد',
            'لم يرد',
            'تم التواصل واتساب',
            'الرقم غير مسجل واتساب',
            'رقم غير صحيح'
        ]
    };

    let pendingContactOutcomePrompt = null;
    let isContactOutcomePromptOpen = false;

    function getContactResultOptions(method) {
        const normalizedMethod = String(method || '').trim();
        if (normalizedMethod.includes('واتساب')) {
            return {
                title: 'ما نتيجة التواصل عبر واتساب؟',
                options: CONTACT_RESULT_PRESETS.whatsapp
            };
        }
        if (normalizedMethod.includes('اتصال')) {
            return {
                title: 'ما نتيجة الاتصال؟',
                options: CONTACT_RESULT_PRESETS.call
            };
        }
        return {
            title: 'ما نتيجة التواصل؟',
            options: CONTACT_RESULT_PRESETS.manual
        };
    }

    window.promptForContactOutcome = async function(context) {
        if (!context || isContactOutcomePromptOpen) return;
        isContactOutcomePromptOpen = true;

        try {
            const shipment = getShipmentById(context.shipmentId);
            if (!shipment) return;
            const { title, options } = getContactResultOptions(context.method);

            const { value: result } = await Swal.fire({
                title,
                html: `
                    <div class="space-y-3 text-right" dir="rtl">
                        <p class="text-sm font-bold text-slate-600">الشحنة: <span class="text-slate-900">#${shipment.order_id || shipment['كود الشحنة'] || shipment.id}</span></p>
                        <select id="swal-contact-result" class="swal2-input !m-0 !w-full border border-slate-200 rounded-lg">
                            <option value="">اختر النتيجة</option>
                            ${options.map((option) => `<option value="${option}">${option}</option>`).join('')}
                        </select>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'حفظ المحاولة',
                cancelButtonText: 'تخطي',
                preConfirm: () => {
                    const selectedResult = document.getElementById('swal-contact-result')?.value || '';
                    if (!selectedResult) {
                        Swal.showValidationMessage('يرجى اختيار نتيجة التواصل');
                        return false;
                    }
                    return selectedResult;
                }
            });

            if (!result) return;

            const success = await recordShipmentContactAttempt(context.shipmentId, {
                method: context.method,
                result
            });

            if (success) {
                Swal.fire({
                    icon: 'success',
                    title: 'تم تسجيل نتيجة التواصل',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 1800
                });
            }
        } finally {
            isContactOutcomePromptOpen = false;
        }
    };

    window.queueContactOutcomePrompt = function(context) {
        pendingContactOutcomePrompt = {
            ...context,
            queuedAt: Date.now()
        };
    };

    window.flushPendingContactOutcomePrompt = async function() {
        if (!pendingContactOutcomePrompt || isContactOutcomePromptOpen) return;
        const context = pendingContactOutcomePrompt;
        pendingContactOutcomePrompt = null;
        await promptForContactOutcome(context);
    };

    window.openContactChannelAndWaitForOutcome = function(context, openCallback) {
        window.queueContactOutcomePrompt(context);
        openCallback();
    };

})();
