const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\studentController.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace branch with address in createStudent
content = content.replace(
  `    const phone = normalizePhone(req.body.phone);
    const branch = resolveAccessibleBranchName(
      await resolveStudentBranchName(req.body.branch ?? ""),
      scope,
      {
        useFirstManagedBranchAsDefault: true,
      },
    );`,
  `    const phone = normalizePhone(req.body.phone);
    const address = req.body.address ? String(req.body.address).trim() : "";`
);

// Replace branch with address in createStudent's saving part
content = content.replace(
  `        email,
        phone,
        branch,
        program,`,
  `        email,
        phone,
        address,
        program,`
);

// Replace branch with address in updateStudent
content = content.replace(
  `    const phone = normalizePhone(req.body.phone);
    const branch = resolveAccessibleBranchName(
      await resolveStudentBranchName(req.body.branch ?? ""),
      scope,
      {
        useFirstManagedBranchAsDefault: true,
      },
    );`,
  `    const phone = normalizePhone(req.body.phone);
    const address = req.body.address ? String(req.body.address).trim() : "";`
);

// Replace branch assignment in updateStudent's saving part
content = content.replace(
  `      student.phone = phone;
      student.branch = branch;
      student.program = program;`,
  `      student.phone = phone;
      student.address = address;
      student.program = program;`
);

fs.writeFileSync(file, content);
console.log('Updated backend studentController.ts');
