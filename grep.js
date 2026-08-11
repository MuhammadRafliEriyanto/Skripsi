const fs = require('fs');
const lines = fs.readFileSync('backend/src/controllers/studentLearningController.ts', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('getStudentDashboardSchedules')) console.log(i + 1, l.trim());
});
