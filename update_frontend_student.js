const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-admin\\admin-data.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /phone: string;\n\s+branch: string;/g,
  'phone: string;\n    address: string;\n    branch: string;'
);

fs.writeFileSync(file, content);
console.log('Updated frontend admin-data.ts');
