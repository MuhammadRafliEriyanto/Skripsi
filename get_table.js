const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

const tableStart = content.indexOf('<TabelNilaiTable');
if (tableStart > -1) {
  const tableEnd = content.indexOf('/>', tableStart) + 2;
  console.log(content.substring(tableStart, tableEnd));
}
