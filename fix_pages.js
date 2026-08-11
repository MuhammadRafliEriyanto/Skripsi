const fs = require('fs');
const path = require('path');

const dir = 'd:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\pages';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove academicYear argument
  content = content.replace(/useStudentDashboardData\([^)]*\)/g, 'useStudentDashboardData()');
  content = content.replace(/useStudentLearningData\([^)]*\)/g, 'useStudentLearningData()');
  
  // Remove isWaitingForYear from destructuring
  content = content.replace(/,\s*isWaitingForYear/g, '');
  content = content.replace(/isWaitingForYear\s*,/g, '');
  
  // Remove isWaitingForYear from StudentLearningShell props
  content = content.replace(/isWaitingForYear=\{isWaitingForYear\}/g, '');

  fs.writeFileSync(filePath, content);
  console.log(`Processed ${file}`);
}
