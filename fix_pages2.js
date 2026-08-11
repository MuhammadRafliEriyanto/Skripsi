const fs = require('fs');
const path = require('path');

const dir = 'd:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\pages';

function replaceInFile(fileName, replacements) {
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  for (const { searchValue, replaceValue } of replacements) {
    // If it's a string, replace globally by splitting and joining
    if (typeof searchValue === 'string') {
      content = content.split(searchValue).join(replaceValue);
    } else {
      content = content.replace(searchValue, replaceValue);
    }
  }
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${fileName}`);
}

replaceInFile('JadwalSiswaPageView.tsx', [
  { searchValue: 'if (isWaitingForYear) {', replaceValue: 'if (false) {' },
  { searchValue: 'isWaitingForYear={isWaitingForYear}', replaceValue: '' },
  { searchValue: /isWaitingForYear \?/g, replaceValue: 'false ?' }
]);

replaceInFile('KirimTugasSiswaPageView.tsx', [
  { searchValue: 'if (isWaitingForYear) {', replaceValue: 'if (false) {' },
  { searchValue: /isWaitingForYear \?/g, replaceValue: 'false ?' }
]);

replaceInFile('MateriSiswaPageView.tsx', [
  { searchValue: 'if (isWaitingForYear) {', replaceValue: 'if (false) {' },
  { searchValue: /isWaitingForYear=\{isWaitingForYear\}/g, replaceValue: '' },
  { searchValue: /isWaitingForYear \?/g, replaceValue: 'false ?' },
  { searchValue: 'isWaitingForYear ||', replaceValue: 'false ||' },
  { searchValue: 'isWaitingForYear=', replaceValue: 'disabled=' } // fallback
]);

replaceInFile('NilaiSiswaPageView.tsx', [
  { searchValue: 'if (isWaitingForYear) {', replaceValue: 'if (false) {' },
  { searchValue: /isWaitingForYear \?/g, replaceValue: 'false ?' }
]);
