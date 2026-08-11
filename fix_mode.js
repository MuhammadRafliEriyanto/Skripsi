const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\models\\TaskSubmission.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/"file",\n\s+"text",\n\s+"drive",/g, '"file",\n  "text",\n  "drive",\n  "cbt",');
fs.writeFileSync(file, content);
console.log('Added cbt to TaskSubmissionModes');
