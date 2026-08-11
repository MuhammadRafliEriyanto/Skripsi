const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-admin\\AdminStudents.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Table Columns
content = content.replace(
  /\{\s*key:\s*"loginCode"[\s\S]*?(?=\{\s*key:\s*"branch")/g,
`    {
      key: "loginCode",
      header: "Kode Login",
      cell: (student) => (
        <p className="truncate text-sm font-semibold text-slate-800">
          {student.loginCode || student.id}
        </p>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (student) => (
        <p className="text-sm text-slate-600">{student.email}</p>
      ),
    },
    {
      key: "phone",
      header: "No HP",
      cell: (student) => (
        <p className="text-sm text-slate-600">{student.phone || "-"}</p>
      ),
    },
    {
      key: "address",
      header: "Alamat",
      cell: (student) => (
        <p className="text-sm text-slate-600 max-w-[150px] truncate" title={student.address}>
          {student.address || "-"}
        </p>
      ),
    },
`
);

content = content.replace(
/\{\s*key:\s*"branch"[\s\S]*?\},/g,
''
);

// 2. StudentFormValues type
content = content.replace(
  /phone:\s*string;\s*branch:\s*string;/,
  'phone: string;\n  address: string;'
);

// 3. createEmptyStudentForm
content = content.replace(
  /phone:\s*"-",\s*branch:\s*"",/,
  'phone: "-",\n    address: "",'
);

// 4. toStudentFormValues
content = content.replace(
  /phone:\s*student\.phone,\s*branch:\s*student\.branch,/,
  'phone: student.phone,\n    address: student.address || "",'
);

// 5. handleSubmit validations & logic
content = content.replace(
  /const normalizedBranch = getRegisteredBranchName\([\s\S]*?\);/,
  'const normalizedAddress = formValues.address.trim();'
);

content = content.replace(
  /phone:\s*normalizedPhone,\s*branch:\s*normalizedBranch,/,
  'phone: normalizedPhone,\n            address: normalizedAddress,'
);

// 6. JSX Form Fields
const targetFormJSX = `                <StudentField label="Nama Lengkap">
                  <Input
                    className={warmFieldClassName}
                    value={formValues.name}
                    onChange={(event) => updateFormValue("name", event.target.value)}
                    placeholder="Nama lengkap siswa"
                  />
                </StudentField>`;

const newFormJSX = targetFormJSX + `

                <StudentField label="Email">
                  <Input
                    className={warmFieldClassName}
                    type="email"
                    value={formValues.email}
                    onChange={(event) => updateFormValue("email", event.target.value)}
                    placeholder="Kosongkan untuk otomatis"
                  />
                </StudentField>

                <StudentField label="No HP">
                  <Input
                    className={warmFieldClassName}
                    value={formValues.phone}
                    onChange={(event) => updateFormValue("phone", event.target.value)}
                    placeholder="Nomor HP / WA"
                  />
                </StudentField>

                <StudentField label="Alamat">
                  <Input
                    className={warmFieldClassName}
                    value={formValues.address}
                    onChange={(event) => updateFormValue("address", event.target.value)}
                    placeholder="Alamat domisili"
                  />
                </StudentField>`;

content = content.replace(targetFormJSX, newFormJSX);

fs.writeFileSync(file, content);
console.log('Fixed everything in AdminStudents.tsx');
