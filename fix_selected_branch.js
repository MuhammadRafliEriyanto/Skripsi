const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-admin\\AdminStudents.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const resolvedBranchOptions = branchOptions;\n  const selectedBranchValue =[\s\S]*?unassignedBranchValue;/g,
  ''
);

fs.writeFileSync(file, content);
console.log('Removed selectedBranchValue');
