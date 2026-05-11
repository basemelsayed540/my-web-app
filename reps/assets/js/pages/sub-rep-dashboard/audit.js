const AUDIT_LOGS_KEY = 'subRepAuditLogs_' + user.username;
        function getAuditLogs() {
            try { return JSON.parse(localStorage.getItem(AUDIT_LOGS_KEY)) || []; }
            catch (e) { return []; }
        }
        function saveAuditLog(actionType, shipment) {
            const logs = getAuditLogs();
            const logEntry = {
                action_date: new Date().toISOString(),
                action_type: actionType,
                order_id: shipment.order_id || shipment['كود الشحنة'] || '---',
                client_name: shipment.اسم_العميل || shipment['اسم العميل'] || '---',
                zone: shipment.الزون || '---',
                phone: shipment.الهات || '---',
                alt_phone: shipment.هات_بديل || shipment['هات بديل'] || '---',
                amount: shipment.السعر_بعد_التعديل || shipment.المبلغ || '0',
                status: shipment.الحالة || '---',
                sub_rep: shipment['المندوب الفرعي'] || shipment['المندوب الرعي'] || '---',
                الرع: shipment.الرع || '---',
                abydet: shipment.الابيديت || shipment['تاريخ التحديث'] || ''
            };
            logs.unshift(logEntry);
            if (logs.length > 500) logs.length = 500;
            localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs));
        }
        
        function populateAuditLogDateFilter() {
            const filter = document.getElementById('auditLogDateFilter');
            if (!filter) return;
            const prevValue = filter.value;
            
            const uniqueDates = [...new Set(allShipments.map(s => {
                const dateVal = s['تاريخ التحديث'] || s.الابيديت;
                if (!dateVal) return '';
                return String(dateVal).split('T')[0]; // Extact yyyy-mm-dd
            }).filter(Boolean))].sort((a,b) => new Date(b) - new Date(a));
            
            filter.innerHTML = '<option value="">كل التواريخ</option>';
            uniqueDates.forEach(date => {
                filter.innerHTML += `<option value="${date}">${date}</option>`;
            });
            if (uniqueDates.includes(prevValue)) filter.value = prevValue;
        }

        function renderAuditLogs() {
            const container = document.getElementById('auditLogsTableBody');
            if (!container) return;
            const filterDate = document.getElementById('auditLogDateFilter').value;
            
            let logs = getAuditLogs();
            if (filterDate) {
                logs = logs.filter(log => {
                    const logAbydet = log.abydet ? String(log.abydet).split('T')[0] : '';
                    return logAbydet === filterDate || String(log.action_date).startsWith(filterDate);
                });
            }
            
            if (logs.length === 0) {
                container.innerHTML = `<tr><td colspan="10" class="text-center p-8 text-slate-500 font-bold">لا توجد عمليات مسجلة...</td></tr>`;
                return;
            }
            
            container.innerHTML = logs.map(log => {
                const actionBadge = log.action_type === 'تم مسحها' 
                    ? `<span class="bg-rose-100 text-rose-700 px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap border border-rose-200"><i class="fas fa-trash-alt"></i> ${log.action_type}</span>`
                    : `<span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap border border-indigo-200"><i class="fas fa-file-excel"></i> ${log.action_type}</span>`;
                
                return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td class="px-2 py-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center border-l dark:border-slate-800/50">
                            ${new Date(log.action_date).toLocaleDateString()}
                        </td>
                        <td class="px-2 py-3 text-center border-l dark:border-slate-800/50">${actionBadge}</td>
                        <td class="px-2 py-3 text-xs font-black text-indigo-600 dark:text-indigo-400">${log.order_id}</td>
                        <td class="px-2 py-3 text-[11px] text-slate-700 dark:text-slate-300 min-w-[120px] truncate max-w-[150px]">${log.client_name}</td>
                        <td class="px-2 py-3 text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">${log.zone}</td>
                        <td class="px-2 py-3 text-[11px] font-mono text-slate-600 dark:text-slate-400">${log.phone}</td>
                        <td class="px-2 py-3 text-[11px] font-mono text-slate-600 dark:text-slate-400">${log.alt_phone}</td>
                        <td class="px-2 py-3 text-xs font-black text-slate-800 dark:text-white whitespace-nowrap">${log.amount}</td>
                        <td class="px-2 py-3 text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">${log.status}</td>
                        <td class="px-2 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">${log.sub_rep}</td>
                        <td class="px-2 py-3 text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">${log.الرع || '---'}</td>
                    </tr>
                `;
            }).join('');
        }

        function switchView(viewName) {
            const views = ['dashboard', 'accounts', 'auditLogs'];
            views.forEach(v => {
                const el = document.getElementById(v + 'View');
                const nav = document.getElementById('nav-' + v);
                if (!el || !nav) return;
                
                if (v === viewName) {
                    el.classList.remove('hidden');
                    nav.className = "w-full flex items-center gap-3 px-5 py-4 bg-indigo-600 text-white rounded-[1.25rem] font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95";
                    if (v === 'accounts') {
                        renderAccountsList();
                        renderSubRepStats();
                    }
                    if (v === 'auditLogs') {
                        populateAuditLogDateFilter();
                        renderAuditLogs();
                    }
                } else {
                    el.classList.add('hidden');
                    nav.className = "w-full flex items-center gap-3 px-5 py-4 text-slate-600 dark:text-slate-400 rounded-[1.25rem] font-bold hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all active:scale-95";
                }
            });
        }

        