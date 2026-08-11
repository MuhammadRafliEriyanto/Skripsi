const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

let results = [];
let i = -1;
while ((i = content.indexOf('buildNilaiRows(', i + 1)) !== -1) {
    const end = content.indexOf(')', i);
    results.push(content.substring(i, end + 1));
}

results.forEach((r, idx) => {
    console.log(`Call ${idx + 1}:\n${r}\n---\n`);
});
