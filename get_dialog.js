const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

const dialogStart = content.indexOf('<NilaiFormDialog');
if (dialogStart > -1) {
  const dialogEnd = content.indexOf('/>', dialogStart) + 2;
  console.log(content.substring(dialogStart, dialogEnd));
}
