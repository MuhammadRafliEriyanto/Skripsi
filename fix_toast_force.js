const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\pages\\TugasSiswaPageView.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import toast')) {
  content = content.replace(
    /import \{ Suspense, useEffect, useState \} from "react";/,
    `import { Suspense, useEffect, useState } from "react";\nimport toast from "react-hot-toast";`
  );
}

fs.writeFileSync(file, content);
console.log('Force injected toast into TugasSiswaPageView');
