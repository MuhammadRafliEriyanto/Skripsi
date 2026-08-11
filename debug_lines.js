const fs = require('fs');
const lines = fs.readFileSync('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx', 'utf8').split('\n');

for (let i = 2620; i < 2640; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
console.log('---');
for (let i = 2670; i < 2690; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
