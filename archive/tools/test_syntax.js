const fs = require('fs');
const html = fs.readFileSync('rep.html', 'utf8');
const scriptMatches = [...html.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
let fullScript = scriptMatches.map(m => m[1]).join('\n\n');
try {
    new Function(fullScript);
    console.log('Syntax OK');
} catch (e) {
    const lines = fullScript.split('\n');
    let errLineMatch = e.stack.match(/<anonymous>:(\d+):/);
    if(errLineMatch) {
        let lineNum = parseInt(errLineMatch[1]);
        console.log('Syntax Error at line:', lineNum);
        console.log('Context:');
        console.log(lines.slice(Math.max(0, lineNum - 5), lineNum + 5).join('\n'));
    }
    console.log(e.stack);
}
