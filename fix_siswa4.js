const fs = require('fs');

// 1. check NilaiSiswaPageView.tsx
const viewFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\pages\\NilaiSiswaPageView.tsx';
let view = fs.readFileSync(viewFile, 'utf8');
if (view.includes('export default function NilaiSiswaPageView')) {
    // it IS a default export. But the error "has no default export" must have been because of my regex!
    // Let's set page.tsx correctly
    const nilaiPageFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\app\\dashboard-siswa\\nilai\\page.tsx';
    let nilaiPage = fs.readFileSync(nilaiPageFile, 'utf8');
    nilaiPage = nilaiPage.replace(/import \{ NilaiSiswaPageView \} from/g, 'import NilaiSiswaPageView from');
    fs.writeFileSync(nilaiPageFile, nilaiPage, 'utf8');
} else if (view.includes('export function NilaiSiswaPageView')) {
    const nilaiPageFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\app\\dashboard-siswa\\nilai\\page.tsx';
    let nilaiPage = fs.readFileSync(nilaiPageFile, 'utf8');
    nilaiPage = nilaiPage.replace(/import NilaiSiswaPageView from/g, 'import { NilaiSiswaPageView } from');
    fs.writeFileSync(nilaiPageFile, nilaiPage, 'utf8');
} else {
    // It's a named export? Or not exported?
    console.log("No export found in NilaiSiswaPageView?");
}

// 2. MateriSiswaPageView.tsx
const materiPageFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\pages\\MateriSiswaPageView.tsx';
let materiPage = fs.readFileSync(materiPageFile, 'utf8');
materiPage = materiPage.replace(/academicAccessMessage=\{[\s\S]*?\}/g, '');
fs.writeFileSync(materiPageFile, materiPage, 'utf8');

console.log('Fixed final dashboard-siswa errors part 4');
