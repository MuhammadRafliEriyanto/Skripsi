const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-admin\\AdminStudents.tsx';
let content = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file, content, 'utf8');
console.log('Saved with utf8');
