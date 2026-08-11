const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/score: 0,\r\?\n/g, 'score: 0,\n');
content = content.replace(/note: "",\r\?\n/g, 'note: "",\n');

// let's check line 2827 as well
const lines = content.split('\n');
for (let i = 2820; i <= 2835; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed regex literals');
