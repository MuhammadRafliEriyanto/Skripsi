const fs = require('fs');
const lines = fs.readFileSync('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx', 'utf8').split('\n');

for (let i = 1005; i <= 1025; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
