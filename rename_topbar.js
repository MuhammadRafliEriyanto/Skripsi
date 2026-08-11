const fs = require('fs');

function replaceWord(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/return "Tugas";/g, 'return "Latihan";');
  fs.writeFileSync(filePath, content);
}

replaceWord('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\siswa-topbar.tsx');
replaceWord('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\components\\GuruTopbar.tsx');
console.log('Renamed Tugas to Latihan in topbar');
