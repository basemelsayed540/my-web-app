/**
 * الأساس والعمليات الجوهرية للشحنات
 * ملاحظة: المتغيرات العامة (supabaseClient, allShipments, etc.) تم تعريفها في bootstrap.js
 */

async function recordShipmentContactAttempt(shipmentId, options = {}) {
    const shipment = getShipmentById(shipmentId);
    if (!shipment) return false;

    const attempts = getShipmentCallAttempts(shipment) + 1;
    const attemptedAt = new Date().toISOString();
    const method = options.method || 'تسجيل تواصل';
    const result = options.result || 'opened';

    // Call Verification Metadata
    const verifiedData = options.callMetadata || {};

    const updatePayload = {
        call_attempts: attempts,
        last_contact_at: attemptedAt,
        last_contact_method: `${method} (${result})`,
        // We store verification status in the notes field
        'ملاحظات': (shipment['ملاحظات'] || '') + (verifiedData.matched ? ` [📞 اتصال مؤكد: مدة ${verifiedData.durationSec}ث]` : '')
    };

    const { error } = await supabaseClient
        .from(CONFIG.TABLES.SHIPMENTS)
        .update(updatePayload)
        .eq('id', Number(shipmentId) || shipmentId);

    if (!error) {
        shipment['عدد المحاولات'] = attempts;
        shipment.call_attempts = attempts;
        shipment['آخر محاولة تواصل'] = attemptedAt;
        shipment.last_contact_at = attemptedAt;
        shipment['آخر وسيلة تواصل'] = updatePayload.last_contact_method;
        shipment.last_contact_method = updatePayload.last_contact_method;
        shipment['ملاحظات'] = updatePayload['ملاحظات'];
        renderShipments();
    } else {
        console.warn('تعذر تحديث عدد المحاولات:', error.message || error);
    }

    if (CONFIG.TABLES.CALLS_LOG) {
        const { error: logError } = await supabaseClient
            .from(CONFIG.TABLES.CALLS_LOG)
            .insert({
                shipment_code: shipment['كود الشحنة'] || shipment.order_id || null,
                rep_name: shipment.المندوب || null,
                method,
                result: result,
                duration: verifiedData.durationSec || 0,
                is_verified: !!verifiedData.matched,
                created_at: attemptedAt
            });

        if (logError) {
            console.warn('تعذر حفظ سجل التواصل:', logError.message || logError);
        }
    }

    return !error;
}
