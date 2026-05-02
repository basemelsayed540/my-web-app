const fs = require('fs');
let code = fs.readFileSync('rep.html', 'utf8');

const target = `        function isPriceEditShipment(shipment) {
            const normalizedStatus = String(shipment?.الحالة || '').trim();
            const normalizedReason = String(shipment?.['سبب الحالة'] || shipment?.سبب_الحالة || '').trim();
            if (shipment && isShippingFeeShipment(shipment)) return false;
            return normalizedStatus === 'تم' || normalizedStatus === 'تم التسليم';
        }

        function isPendingStatus(status) {
            const normalizedStatus = String(status || '').replace(/\\s+/g, ' ').trim();
            return normalizedStatus === '' || normalizedStatus === 'قيد' || normalizedStatus === 'قيد التوصيل' || normalizedStatus === 'قيد التنفيذ';
        }`;

const replacement = `        function isPriceEditShipment(shipment) {
            const normalizedStatus = String(shipment?.الحالة || '').trim();
            const normalizedReason = String(shipment?.['سبب الحالة'] || shipment?.سبب_الحالة || '').trim();
            return normalizedStatus === 'تعديل سعر' || normalizedReason === 'تعديل سعر';
        }

        function isShippingFeeShipment(shipment) {
            const normalizedStatus = String(shipment?.الحالة || '').trim();
            const normalizedReason = String(shipment?.['سبب الحالة'] || shipment?.سبب_الحالة || '').trim();
            return normalizedStatus === 'شحن' || normalizedReason.includes('شحن');
        }

        function isDeliveredStatus(status, shipment = null) {
            const normalizedStatus = String(status || '').trim();
            if (shipment && isPriceEditShipment(shipment)) return false;
            if (shipment && isShippingFeeShipment(shipment)) return false;
            return normalizedStatus === 'تم' || normalizedStatus === 'تم التسليم';
        }

        function isPendingStatus(status) {
            const normalizedStatus = String(status || '').replace(/\\s+/g, ' ').trim();
            return normalizedStatus === '' || normalizedStatus === 'قيد' || normalizedStatus === 'قيد التوصيل' || normalizedStatus === 'قيد التنفيذ';
        }

        function isDelayedStatus(status) {
            const normalizedStatus = String(status || '').trim();
            return normalizedStatus === 'مؤجل' || normalizedStatus === 'مؤجل';
        }

        function isRejectedStatus(status) {
            const normalizedStatus = String(status || '').trim();
            return normalizedStatus === 'رفض' || normalizedStatus === 'الغاء' || normalizedStatus === 'إلغاء';
        }

        function getShipmentCommission(shipment) {
            let commissionValue = shipment?.['عمولة المندوب'];
            if (user && user.role === 'مندوب فرعي') {
                commissionValue = shipment?.['عمولة المندوب الفرعي'] || shipment?.عمولة_المندوب_الفرعي || 0;
            }
            const value = parseFloat(commissionValue || 0);
            return Number.isNaN(value) ? 0 : value;
        }

        function getShipmentAmount(shipment) {
            const value = parseFloat(shipment?.السعر_بعد_التعديل || shipment?.المبلغ || 0);
            return Number.isNaN(value) ? 0 : value;
        }

        function getAdjustedShipmentAmount(shipment) {
            const value = parseFloat(shipment?.السعر_بعد_التعديل || 0);
            return Number.isNaN(value) ? 0 : value;
        }`;

code = code.replace(target, replacement);
fs.writeFileSync('rep.html', code, 'utf8');
console.log('Regex matched target:', code.includes('function getShipmentCommission'));
