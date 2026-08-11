const fs = require('fs');
const lines = fs.readFileSync('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx', 'utf8').split('\n');

for (let i = 2680; i <= 2700; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
