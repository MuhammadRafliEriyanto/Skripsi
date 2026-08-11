const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\studentController.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace CSV headers
content = content.replace(
  '"Email",\n          "Cabang",',
  '"Email",\n          "No HP",\n          "Alamat",'
);

// Replace CSV row values
content = content.replace(
  'student.email,\n          student.branch,',
  'student.email,\n          student.phone || "-",\n          student.address || "-",\n'
);

fs.writeFileSync(file, content);
console.log('Updated exportStudents CSV columns');
