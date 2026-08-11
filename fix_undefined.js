const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

const undefinedIdx = content.indexOf('\nundefined\n');
if (undefinedIdx > -1) {
  content = content.substring(0, undefinedIdx + 1);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Removed undefined lines at EOF');
} else {
  // Try cleaning just the word undefined
  const lines = content.split('\n');
  const validLines = lines.filter(l => l.trim() !== 'undefined');
  if (lines.length !== validLines.length) {
     fs.writeFileSync(file, validLines.join('\n'), 'utf8');
     console.log('Removed undefined lines');
  }
}

