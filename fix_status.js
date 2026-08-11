const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\studentTaskCbtController.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/submission\.status = "Terkirim";\n/g, '');
fs.writeFileSync(file, content);
console.log('Removed submission.status');
