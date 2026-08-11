const fs = require('fs');

function replaceWord(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/"Tugas"/g, '"Latihan"');
  fs.writeFileSync(filePath, content);
}

replaceWord('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\academic-history\\AcademicHistoryDetailPanel.tsx');
console.log('Renamed Tugas to Latihan in AcademicHistoryDetailPanel');
