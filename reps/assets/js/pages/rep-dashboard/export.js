function exportToExcel() {
            const data = getFilteredShipments();
            if (!data || data.length === 0) {
                Swal.fire('تنبيه', 'لا توجد بيانات لتصديرها', 'warning');
                return;
            }

            const exportData = data.map(s => ({
                'm': s.m || s.م || '',
                'كود الشحنة': s['كود الشحنة'] || s.كود_الشحنة || s.الكود || s.order_id || '',
                'اسم العميل': s['اسم العميل'] || s.اسم_العميل || '',
                'العنوان': s.العنوان || '',
                'الزون': s.الزون || '',
                'المنتج': s.المنتج || '',
                'المبلغ': s.المبلغ || '',
                'الصافي': s['السعر بعد التعديل'] || s.السعر_بعد_التعديل || s.المبلغ || '',
                'الراسل': s.الراسل || '',
                'الحالة': isPriceEditShipment(s) ? 'تعديل سعر' : (isDeliveredStatus(s.الحالة, s) ? 'تم التوصيل' : (s.الحالة || 'قيد التوصيل')),
                'سبب الحالة': (s['سبب الحالة'] || s.سبب_الحالة || ''),
                'الهاتف': s.الهاتف || s.الهات || '',
                'هاتف بديل': s['هاتف بديل'] || s.هاتف_بديل || s.هات_بديل || '',
                'تاريخ التحديث': s['تاريخ التحديث'] || s.الابيديت || ''
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "شحناتي");
            XLSX.writeFile(wb, `شحناتي_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.xlsx`);
        }

        function getFilteredShipments() {
            return filterShipmentsCollection(allShipments, {
                search: document.getElementById('searchInput').value,
                dates: getSelectedDates(),
                statuses: getSelectedStatuses(),
                zones: getSelectedZones(),
                senders: getSelectedSenders()
            });
        }

        
