function normalizeComparableValue(value) {
            return String(value || '').replace(/\s+/g, ' ').trim();
        }

        function normalizeDigits(value) {
            const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
            const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';
            return String(value || '').replace(/[٠-٩]/g, (char) => String(arabicIndic.indexOf(char))).replace(/[۰-۹]/g, (char) => String(easternArabicIndic.indexOf(char)));
        }

        function normalizeAssignmentPhone(value) {
            let normalized = normalizeDigits(value).replace(/[^\d+]/g, '');
            if (!normalized) return '';
            if (normalized.startsWith('+')) {
                normalized = `+${normalized.slice(1).replace(/\+/g, '')}`;
            } else {
                normalized = normalized.replace(/\+/g, '');
            }
            if (normalized.startsWith('00')) normalized = `+${normalized.slice(2)}`;
            if (normalized.startsWith('+20') && normalized.length === 13) return normalized;
            if (normalized.startsWith('20') && normalized.length === 12) return `+${normalized}`;
            if (normalized.startsWith('01') && normalized.length === 11) return `+20${normalized.slice(1)}`;
            return normalized;
        }

        function buildRepIdentifierVariants(value) {
            const variants = new Set();
            const normalized = normalizeComparableValue(normalizeDigits(value));
            if (normalized) variants.add(normalized);

            const compact = normalized.replace(/\s+/g, '');
            if (compact) variants.add(compact);

            const withoutPrivatePrefix = normalized.replace(/^PRIVATE:/i, '').trim();
            if (withoutPrivatePrefix && withoutPrivatePrefix !== normalized) {
                variants.add(withoutPrivatePrefix);
                variants.add(withoutPrivatePrefix.replace(/\s+/g, ''));
            }

            const phone = normalizeAssignmentPhone(value);
            if (phone) {
                variants.add(phone);
                variants.add(phone.replace(/^\+/, ''));
                if (phone.startsWith('+20')) {
                    variants.add(`0${phone.slice(3)}`);
                    variants.add(phone.slice(1));
                }
            }

            return [...variants].filter(Boolean);
        }

        function getRepIdentifiers() {
            return [...new Set([
                user.full_name,
                user.username,
                user.phone,
                user.username ? `PRIVATE:${user.username}` : '',
                user.full_name ? `PRIVATE:${user.full_name}` : ''
            ].flatMap(buildRepIdentifierVariants).filter(Boolean))];
        }

        function shipmentBelongsToRep(shipment, repIdentifiers) {
            const identifierSet = repIdentifiers instanceof Set ? repIdentifiers : new Set(repIdentifiers || []);
            const assignedValues = [
                shipment?.المندوب,
                shipment?.['المندوب الفرعي'],
                shipment?.['المندوب الرعي']
            ];
            return assignedValues.some((value) => buildRepIdentifierVariants(value).some((variant) => identifierSet.has(variant)));
        }

        function getShipmentClientIdentity(shipment) {
            const primaryPhone = normalizeComparableValue(shipment?.الهاتف || shipment?.['رقم الهاتف'] || '');
            const secondaryPhone = normalizeComparableValue(shipment?.['هاتف_بديل'] || shipment?.هاتف_بديل || '');
            const clientName = normalizeComparableValue(shipment?.اسم_العميل || shipment?.['اسم العميل'] || '');
            return primaryPhone || secondaryPhone || clientName || '';
        }

        function buildClientShipmentFrequencyMap(shipments) {
            const frequencyMap = new Map();
            (shipments || []).forEach((shipment) => {
                const identity = getShipmentClientIdentity(shipment);
                if (!identity) return;
                frequencyMap.set(identity, (frequencyMap.get(identity) || 0) + 1);
            });
            return frequencyMap;
        }

        function getShipmentImportantNote(shipment) {
            const explicitNote = normalizeComparableValue(shipment?.ملاحظات || shipment?.['ملاحظات'] || shipment?.notes || '');
            if (explicitNote) return explicitNote;

            const reason = normalizeComparableValue(shipment?.['سبب الحالة'] || shipment?.سبب_الحالة || '');
            if (!reason) return '';

            const genericReasons = new Set(['مؤجل', 'رفض', 'الغاء', 'إلغاء', 'تم', 'تم التسليم', 'تعديل سعر', 'شحن']);
            return genericReasons.has(reason) ? '' : reason;
        }

        
