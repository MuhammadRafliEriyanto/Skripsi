const fs = require('fs');
const viewFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\pages\\NilaiSiswaPageView.tsx';
let view = fs.readFileSync(viewFile, 'utf8');

// If not exported, add it at the end
if (!view.includes('export')) {
    view += '\nexport { NilaiSiswaPageContent as NilaiSiswaPageView };\n';
    fs.writeFileSync(viewFile, view, 'utf8');
}
