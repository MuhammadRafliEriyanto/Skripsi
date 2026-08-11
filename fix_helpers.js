const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\detail-kelas\\helpers.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/statusPenilaian:\r?\n\s*statusPenilaian:/, 'statusPenilaian:');
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed helpers.ts');
