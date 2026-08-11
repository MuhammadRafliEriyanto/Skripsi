const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\pages\\TugasSiswaPageView.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { toast } from "react-hot-toast"')) {
  // Wait, I did add it in fix_tugas_siswa.js!
  // `import { toast } from "react-hot-toast";`
  // Let me check if it's there.
  content = content.replace(
    /import \{ useRouter \} from "next\/navigation";/,
    `import { useRouter } from "next/navigation";\nimport { toast } from "react-hot-toast";`
  );
}

fs.writeFileSync(file, content);
console.log('Fixed toast import in TugasSiswaPageView.tsx');
