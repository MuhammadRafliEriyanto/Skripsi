const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-admin\\AdminStudents.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update StudentFormValues
content = content.replace(
  'phone: string;\n  branch: string;',
  'phone: string;\n  address: string;\n  branch: string;'
);

// 2. Update createEmptyStudentForm
content = content.replace(
  'phone: "-",\n    branch: "",',
  'phone: "",\n    address: "",\n    branch: "",'
);

// 3. Update toStudentFormValues
content = content.replace(
  'phone: student.phone,\n    branch: student.branch,',
  'phone: student.phone,\n    address: student.address || "",\n    branch: student.branch,'
);

// 4. Update handleSubmit validations
// Remove normalizedBranch if it's not used (wait, let's just leave it if it is)
// We add address normalization
content = content.replace(
  'const normalizedPhone = normalizePhone(formValues.phone);',
  'const normalizedPhone = normalizePhone(formValues.phone);\n    const normalizedAddress = formValues.address.trim();'
);

// Add address to PUT request
content = content.replace(
  'phone: student.phone,\n          branch: student.branch,',
  'phone: student.phone,\n          address: student.address,\n          branch: student.branch,'
);

// Add address to POST / PUT form submit
content = content.replace(
  'phone: normalizedPhone,\n          branch: normalizedBranch,',
  'phone: normalizedPhone,\n          address: normalizedAddress,\n          branch: normalizedBranch,'
);

// Add form fields to JSX
const formFieldsHtml = `                <StudentField label="Email">
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

content = content.replace(
  'placeholder="Nama lengkap siswa"\n                  />\n                </StudentField>\n\n\n              </div>\n            </div>',
  'placeholder="Nama lengkap siswa"\n                  />\n                </StudentField>\n\n' + formFieldsHtml + '\n              </div>\n            </div>'
);

fs.writeFileSync(file, content);
console.log('Updated form fields in AdminStudents.tsx');
