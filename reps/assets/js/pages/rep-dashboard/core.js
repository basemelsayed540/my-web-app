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

    const { error } = await supabaseClient
        .from(CONFIG.TABLES.SHIPMENTS)
        .update({
            call_attempts: attempts,
            last_contact_at: attemptedAt,
            last_contact_method: method
        })
        .eq('id', Number(shipmentId) || shipmentId);

    if (!error) {
        shipment['عدد المحاولات'] = attempts;
        shipment.call_attempts = attempts;
        shipment['آخر محاولة تواصل'] = attemptedAt;
        shipment.last_contact_at = attemptedAt;
        shipment['آخر وسيلة تواصل'] = method;
        shipment.last_contact_method = method;
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
                result: options.result || 'opened',
                created_at: attemptedAt
            });

        if (logError) {
            console.warn('تعذر حفظ سجل التواصل:', logError.message || logError);
        }
    }

    return !error;
}
