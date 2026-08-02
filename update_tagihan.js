const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/dashboard-siswa/pages/TagihanSiswaPageView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const jsxNew = fs.readFileSync(path.join(__dirname, 'jsx.txt'), 'utf8');

const startStr = '<div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-slate-50 pb-20">';
const endStr = ') : null}\r\n\r\n\r\n      <Dialog';
const endStr2 = ') : null}\n\n\n      <Dialog';
const endStr3 = ') : null}\r\n\r\n      <Dialog';
const endStr4 = ') : null}\n\n      <Dialog';

let endIdx = content.indexOf(endStr);
if (endIdx === -1) endIdx = content.indexOf(endStr2);
if (endIdx === -1) endIdx = content.indexOf(endStr3);
if (endIdx === -1) endIdx = content.indexOf(endStr4);

let dialogIdx = content.indexOf('<Dialog', endIdx);

if (dialogIdx !== -1) {
    let idxStart = content.indexOf(startStr);
    if (idxStart !== -1) {
        content = content.substring(0, idxStart) + jsxNew + '\n\n      ' + content.substring(dialogIdx);
    } else {
        console.log('startStr not found');
    }
} else {
    console.log('dialogIdx not found');
}

fs.writeFileSync(filePath, content);
console.log('Update complete.');
