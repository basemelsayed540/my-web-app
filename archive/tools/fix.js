const fs = require('fs');

let fileContent = fs.readFileSync('rep.html', 'utf8');

const badRegex = /const senderCounts = \{\};\s*narrowedData\.forEach\(s => \{\s*const sn = s\.الراسل;\s*if \(sn\) senderCounts\[sn\] = \(senderCounts\[sn\] \|\| 0\) \+ 1;\s*\}\);\s*select\.appendChild\(opt\);\s*\}\);\s*select\.value = items\.includes\(currentValue\) \? currentValue : '';\s*\}/g;

const replacement = `            const senderCounts = {};
            narrowedData.forEach(s => {
                const sn = s.الراسل;
                if (sn) senderCounts[sn] = (senderCounts[sn] || 0) + 1;
            });

            let optionsHtml = '<option value="الكل" class="text-slate-800 bg-white">الراسل: الكل</option>';
            if (items && items.length > 0) {
                items.forEach(item => {
                    const count = senderCounts[item] || 0;
                    optionsHtml += \\\`<option value="\${item}" class="text-slate-800 bg-white">\${item} (\${count})</option>\\\`;
                });
            }

            select.innerHTML = optionsHtml;

            if (selectedArr.length > 0) {
                select.value = selectedArr[0];
                select.classList.add('bg-indigo-600', 'text-white', 'border-indigo-600', 'shadow-indigo-500/30');
                select.classList.remove('bg-white', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-200');
            } else {
                select.value = 'الكل';
                select.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-600', 'shadow-indigo-500/30');
                select.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-200');
            }
        }

        function fillSelect(id, items, defaultText, currentValue = '') {
            const select = document.getElementById(id);
            if (!select) return;
            select.innerHTML = \\\`<option value="">\${defaultText}</option>\\\`;
            items.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item;
                opt.innerText = item;
                select.appendChild(opt);
            });
            select.value = items.includes(currentValue) ? currentValue : '';
        }`;

const newContent = fileContent.replace(badRegex, replacement.replace(/\\\\`/g, '`'));
fs.writeFileSync('rep.html', newContent, 'utf8');
console.log('Regex matched:', badRegex.test(fileContent));
console.log('Fixed');
