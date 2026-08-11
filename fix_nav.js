const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\learning\\StudentLearningNav.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /label: "Latihan Soal",\n\s+href: "\/dashboard-siswa\/ujian",\n\s+icon: FileText,/g,
  `label: "Latihan Soal",\n    href: "/dashboard-siswa/tugas",\n    icon: FileText,`
);

fs.writeFileSync(file, content);
console.log('Fixed link in StudentLearningNav');
