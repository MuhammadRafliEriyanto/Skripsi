const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\pages\\ActiveLatihanPageView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\/api\/student\/me\/learning\/tasks\/\/cbt\$\{encodeURIComponent\(attemptId\)\}/g,
  '/api/student/me/learning/tasks/cbt/${encodeURIComponent(attemptId)}'
);

content = content.replace(
  /\/api\/student\/me\/learning\/tasks\/\/cbt\$\{encodeURIComponent\(activeAttemptId\)\}\/submission/g,
  '/api/student/me/learning/tasks/cbt/${encodeURIComponent(activeAttemptId)}/submission'
);

fs.writeFileSync(file, content);
console.log('Fixed CBT endpoints in ActiveLatihanPageView.tsx');
