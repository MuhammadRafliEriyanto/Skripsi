const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-admin\\AdminStudents.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `      {
        key: "loginCode",
        header: "Kode Login",
        cell: (student) => (
          <div className="max-w-[240px]">
            <p className="truncate text-sm font-semibold text-slate-800">
              {student.loginCode || student.id}
            </p>
            {!student.email.endsWith("@bimbel.local") && (
              <p className="truncate text-xs text-slate-500">{student.email}</p>
            )}
          </div>
        ),
      },`;

const replacementStr = `      {
        key: "loginCode",
        header: "Kode Login",
        cell: (student) => (
          <p className="text-sm font-semibold text-slate-800">
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
      },`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync(file, content);
console.log('Updated columns in AdminStudents.tsx');
