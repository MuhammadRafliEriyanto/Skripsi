import * as xlsx from 'xlsx';

const filePath = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\outputs\\assessment-bank-rekap\\REKAP-BANK-SOAL-BIMBEL-BINA-CENDEKIA-COMPLETE-ALL-JENJANG.xlsx';
const workbook = xlsx.readFile(filePath);

const sheetName = workbook.SheetNames[0];
console.log('Sheet Name:', sheetName);

const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Total Rows:', data.length);
if (data.length > 0) {
  console.log('Headers:', data[0]);
}
if (data.length > 1) {
  console.log('Row 1:', data[1]);
}
if (data.length > 2) {
  console.log('Row 2:', data[2]);
}
if (data.length > 3) {
  console.log('Row 3:', data[3]);
}
