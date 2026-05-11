function renderPagination(totalPages) {
                const container = document.getElementById('paginationContainer');
                if (totalPages <= 1) {
                    container.innerHTML = '';
                    return;
                }

                let html = '';

                if (currentPage > 1) {
                    html += `<button onclick="goToPage(${currentPage - 1})" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center font-bold text-sm shadow-sm"><i class="fas fa-chevron-left text-xs"></i></button>`;
                }

                let startP = Math.max(1, currentPage - 2);
                let endP = Math.min(totalPages, currentPage + 2);

                if (startP > 1) {
                    html += `<button onclick="goToPage(1)" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center font-bold text-sm shadow-sm">1</button>`;
                    if (startP > 2) html += `<span class="px-1 py-1 text-slate-400">...</span>`;
                }

                for (let i = startP; i <= endP; i++) {
                    if (i === currentPage) {
                        html += `<button class="w-8 h-8 rounded-lg bg-indigo-600 border border-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-md pointer-events-none">${i}</button>`;
                    } else {
                        html += `<button onclick="goToPage(${i})" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center font-bold text-sm shadow-sm">${i}</button>`;
                    }
                }

                if (endP < totalPages) {
                    if (endP < totalPages - 1) html += `<span class="px-1 py-1 text-slate-400">...</span>`;
                    html += `<button onclick="goToPage(${totalPages})" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center font-bold text-sm shadow-sm">${totalPages}</button>`;
                }

                if (currentPage < totalPages) {
                    html += `<button onclick="goToPage(${currentPage + 1})" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center font-bold text-sm shadow-sm"><i class="fas fa-chevron-right text-xs"></i></button>`;
                }

                container.innerHTML = html;
            }

            function goToPage(page) {
                currentPage = page;
                renderTable();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                saveFollowerUiState();
            }

            function getShipmentById(id) {
                return allShipments.find(s => String(s.id) === String(id));
            }

            function getShipmentPhone(shipment, key) {
                return (shipment[key] || '').toString().trim();
            }

            function hasShipmentPhone(shipment, key) {
                return Boolean(getShipmentPhone(shipment, key));
            }

            function renderShipmentContactActions(shipment) {
                const primary = hasShipmentPhone(shipment, 'الهات') ? `
                <button onclick='shareWhatsApp(${JSON.stringify(shipment).replace(/'/g, "&apos;")}, "الهات")' class="bg-[#25D366] text-white p-2 rounded-lg shadow-sm hover:bg-[#1ebd5a] transition-colors focus:ring-2 focus:ring-[#25D366] focus:ring-offset-1 tooltip" title="واتساب الهاتف">
                    <i class="fab fa-whatsapp text-lg"></i>
                </button>
            ` : '';

                const secondary = hasShipmentPhone(shipment, 'هات_بديل') ? `
                <button onclick='shareWhatsApp(${JSON.stringify(shipment).replace(/'/g, "&apos;")}, "هات_بديل")' class="bg-[#25D366] text-white p-2 rounded-lg shadow-sm hover:bg-[#1ebd5a] transition-colors focus:ring-2 focus:ring-[#25D366] focus:ring-offset-1 tooltip" title="واتساب الهاتف البديل">
                    <i class="fab fa-whatsapp text-lg"></i>
                </button>
            ` : '';

                return `${primary}${secondary}`;
            }

            function formatShipmentCopyText(shipment) {
                const getValue = (value) => {
                    if (value === null || value === undefined || value === '') return '---';
                    return String(value);
                };

                return [
                    `اسم العميل: ${getValue(shipment.اسم_العميل)}`,
                    `العنوان: ${getValue(shipment.العنوان)}`,
                    `الزون: ${getValue(shipment.الزون)}`,
                    `المنتج: ${getValue(shipment.المنتج)}`,
                    `الهاتف: ${getValue(shipment.الهات)}`,
                    `هاتف بديل: ${getValue(shipment.هات_بديل)}`,
                    `المبلغ: ${getValue(shipment.المبلغ)}`,
                    `الكود: ${getValue(shipment.الكود)}`,
                    `الراسل: ${getValue(shipment.الراسل)}`,
                    `المندوب: ${getValue(shipment.المندوب)}`
                ].join('\n');
            }

            function closeShipmentMenu() {
                const menu = document.getElementById('shipmentMenu');
                menu.classList.add('hidden');
                activeShipmentMenuId = null;
            }

            function toggleShipmentMenu(event, shipmentId) {
                event.stopPropagation();
                const menu = document.getElementById('shipmentMenu');
                const isOpenForSameShipment = activeShipmentMenuId === shipmentId && !menu.classList.contains('hidden');

                if (isOpenForSameShipment) {
                    closeShipmentMenu();
                    return;
                }

                activeShipmentMenuId = shipmentId;
                menu.classList.remove('hidden');

                const menuWidth = 220;
                const menuHeight = 64;
                const left = Math.max(12, Math.min(event.clientX - menuWidth + 20, window.innerWidth - menuWidth - 12));
                const top = Math.max(12, Math.min(event.clientY + 12, window.innerHeight - menuHeight - 12));

                menu.style.left = `${left}px`;
                menu.style.top = `${top}px`;
            }

            async function copyShipmentData(id) {
                const shipment = getShipmentById(id);
                if (!shipment) return;

                try {
                    await navigator.clipboard.writeText(formatShipmentCopyText(shipment));
                    closeShipmentMenu();
                    Swal.fire({
                        icon: 'success',
                        title: 'تم نسخ بيانات الشحنة',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 1800
                    });
                } catch (error) {
                    closeShipmentMenu();
                    Swal.fire('خطأ', 'فشل نسخ بيانات الشحنة', 'error');
                }
            }

            function copyShipmentDataFromMenu() {
                if (!activeShipmentMenuId) return;
                copyShipmentData(activeShipmentMenuId);
            }

            async function shareWhatsApp(shipment, phoneKey = 'الهات') {
                // Template: اسم العميل، العنوان، الزون، المنتج، الهاتف، هاتف بديل، المبلغ، المكتب، الكود، والمندوب
                const info = [
                    `📦 *بيانات الشحنة:* #${shipment.order_id || '---'}`,
                    `👤 *العميل:* ${shipment.اسم_العميل || '---'}`,
                    ` *العنوان:* ${shipment.العنوان || '---'}`,
                    `🗺 *الزون:* ${shipment.الزون || '---'}`,
                    ` *المنتج:* ${shipment.المنتج || '---'}`,
                    `💰 *المبلغ المطلوب:* ${shipment.المبلغ ? shipment.المبلغ + ' ج.م' : '---'}`,
                    `📱 *الهاتف:* ${shipment.الهات || '---'}`,
                    `📱 *هاتف بديل:* ${shipment.هات_بديل || '---'}`,
                    ` *المكتب (الراسل):* ${shipment.الراسل || '---'}`,
                    `🚚 *المندوب:* ${shipment.المندوب || 'غير محدد'}`
                ].join('\n');

                try {
                    await navigator.clipboard.writeText(info);

                    // Construct WA link (prefer primary phone, format number if needed)
                    let tel = getShipmentPhone(shipment, phoneKey);
                    // Simple format to add +20 if it's an Egyptian 010/011/etc
                    if (tel.startsWith('01') && tel.length === 11) {
                        tel = '+20' + tel.substring(1);
                    } else {
                        tel = tel.replace(/\\D/g, '');
                    }

                    const waUrl = tel ?
                        `https://wa.me/${tel}?text=${encodeURIComponent(info)}` :
                        `https://wa.me/?text=${encodeURIComponent(info)}`; // fallback to contact picker

                    window.open(waUrl, '_blank');
                } catch (err) {
                    console.error('Failed to copy: ', err);
                    Swal.fire('خطأ', 'فشل في نسخ بيانات الشحنة', 'error');
                }
            }

            
