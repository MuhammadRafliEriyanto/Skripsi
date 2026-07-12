const fs = require('fs');

const files = [
  'src/components/dashboard-siswa/pages/AbsensiSiswaPageView.tsx',
  'src/components/dashboard-siswa/pages/ActiveTryoutPageView.tsx',
  'src/components/dashboard-siswa/pages/JadwalSiswaPageView.tsx',
  'src/components/dashboard-siswa/pages/KirimTugasSiswaPageView.tsx',
  'src/components/dashboard-siswa/pages/MateriSiswaPageView.tsx',
  'src/components/dashboard-siswa/pages/NilaiSiswaPageView.tsx',
  'src/components/dashboard-siswa/pages/ScanAbsenClient.tsx',
  'src/components/dashboard-siswa/pages/TryoutSiswaPageView.tsx',
  'src/components/dashboard-siswa/sections/HeaderAkademikSiswa.tsx',
  'src/components/dashboard-siswa/sections/PelajaranSiswaSection.tsx',
  'src/components/dashboard-siswa/learning/FlexibleSubmissionPanel.tsx',
  'src/components/dashboard-siswa/SiswaUserProfileDialog.tsx',
  'src/components/dashboard-siswa/siswa-topbar.tsx',
  'src/components/dashboard-siswa/StudentMembershipAccessGate.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1. Alerts to Toasts
  if (content.includes('window.alert(')) {
    content = content.replace(/window\.alert\(/g, 'toast.error(');
    changed = true;
  }
  if (content.includes('window.confirm(')) {
    // window.confirm is tricky if used in an if statement, but let's see if we can just wrap it or if we should skip
    // Wait, replacing confirm with toast.error breaks if(window.confirm) because toast returns string not boolean.
    // Let's just find where window.confirm is used first, or skip it for now and do it manually.
  }

  // Add toast import if we changed alert
  if (changed && !content.includes('import toast')) {
    content = content.replace('import', 'import toast from "react-hot-toast";\nimport');
  }

  // 2. Marquee
  if (content.includes('animate-marquee')) {
    content = content.replace(/animate-marquee /g, '');
    changed = true;
  }

  // 3. Button replacements
  if (content.includes('<button') || content.includes('</button>')) {
    content = content.replace(/<button/g, '<Button');
    content = content.replace(/<\/button>/g, '</Button>');
    changed = true;
  }

  // Add Button import if missing and Button is used
  if (content.includes('<Button') && !content.includes('import { Button }')) {
    content = content.replace('import', 'import { Button } from "@/components/ui/button";\nimport');
  }

  if (changed) {
    fs.writeFileSync(file, content);
  }
}
console.log('Massive string replacements complete.');
