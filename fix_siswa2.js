const fs = require('fs');

// 1. nilai page.tsx
const nilaiPageFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\app\\dashboard-siswa\\nilai\\page.tsx';
let nilaiPage = fs.readFileSync(nilaiPageFile, 'utf8');
nilaiPage = nilaiPage.replace(/import \{ NilaiSiswaPageView \} from/g, 'import NilaiSiswaPageView from');
fs.writeFileSync(nilaiPageFile, nilaiPage, 'utf8');

// 2. MateriSiswaPageView.tsx
const materiPageFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\pages\\MateriSiswaPageView.tsx';
let materiPage = fs.readFileSync(materiPageFile, 'utf8');
materiPage = materiPage.replace(/loading=\{loading\}/g, '');
materiPage = materiPage.replace(/loading=\{!academicSummary\}/g, '');
materiPage = materiPage.replace(/loading=\{.*?\}/g, ''); // just remove loading prop entirely if it exists
fs.writeFileSync(materiPageFile, materiPage, 'utf8');

console.log('Fixed final dashboard-siswa errors');
