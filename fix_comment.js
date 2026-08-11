const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\}int-disable react-hooks\/set-state-in-effect \*\//g, '}\n/* eslint-disable react-hooks/set-state-in-effect */');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed lint comment');
