const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/savedTask\.jumlahSoal = 10; \/\/ Trigger refresh conceptually\n/g, '');

fs.writeFileSync(file, content);
console.log('Fixed detail frontend error');
