const fs = require('fs');
const lines = fs.readFileSync('backend/src/utils/classroomLearning.ts', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('buildStudentLearningClassFilter')) console.log(i + 1, l.trim());
});
