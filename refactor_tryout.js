const fs = require('fs');
const file = 'src/components/dashboard-guru/sections/TryoutGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add toast import if missing
if (!content.includes('import toast')) {
  content = content.replace('import Link from "next/link";', 'import Link from "next/link";\nimport toast from "react-hot-toast";');
}

// 2. Replace all window.alert with toast.error
content = content.replace(/window\.alert\(/g, 'toast.error(');

// 3. Carefully remove "dari backend" without breaking JSX!
// The previous agent broke this:
// <p className="text-sm font-semibold text-slate-700">Memuat hasil ujian dari backend...</p>
content = content.replace(
  '<p className="text-sm font-semibold text-slate-700">\n                Memuat hasil ujian dari backend...\n              </p>',
  '<p className="text-sm font-semibold text-slate-700">\n                Memuat hasil ujian...\n              </p>'
);

// If it's single line
content = content.replace(
  '<p className="text-sm font-semibold text-slate-700">Memuat hasil ujian dari backend...</p>',
  '<p className="text-sm font-semibold text-slate-700">Memuat hasil ujian...</p>'
);

fs.writeFileSync(file, content);
console.log('TryoutGuruSection refactored safely');
