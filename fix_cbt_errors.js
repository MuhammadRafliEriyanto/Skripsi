const fs = require('fs');

function fixController(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Fix sendSuccess calls
  content = content.replace(
    /sendSuccess\(res,\n?\s*(\d+),\n?\s*"([^"]+)",\n?\s*(\{[\s\S]*?\})\n?\s*\);/g,
    'sendSuccess(res, {\n      statusCode: $1,\n      message: "$2",\n      data: $3 as any,\n    });'
  );
  
  content = content.replace(
    /sendSuccess\(res,\s*(\d+),\s*"([^"]+)",\s*(\{[\s\S]*?\})\s*\);/g,
    'sendSuccess(res, { statusCode: $1, message: "$2", data: $3 as any });'
  );

  fs.writeFileSync(file, content);
}

fixController('D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\studentTaskCbtController.ts');
fixController('D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\teacherTaskCbtController.ts');

let stContent = fs.readFileSync('D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\studentTaskCbtController.ts', 'utf8');
stContent = stContent.replace(
  /import \{ getStudentProfileByUserId \} from "\.\/studentController";/,
  `import { Student } from "../models/Student";`
);
stContent = stContent.replace(
  /const student = await getStudentProfileByUserId\(req\.user\._id\.toString\(\)\);/g,
  `const student = await Student.findOne({ userId: req.user._id, isArchived: { $ne: true } });`
);
// Make sure we didn't duplicate `import { Student } from "../models/Student";`
// Actually it's already imported above, so let's just remove the bad import
stContent = stContent.replace(/import \{ Student \} from "\.\.\/models\/Student";\nimport \{ Student \} from "\.\.\/models\/Student";/, 'import { Student } from "../models/Student";');

fs.writeFileSync('D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\studentTaskCbtController.ts', stContent);

let teContent = fs.readFileSync('D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\teacherTaskCbtController.ts', 'utf8');
teContent = teContent.replace(
  /import \{ getTeacherProfileByUserId \} from "\.\/teacherController";/,
  `import { Teacher } from "../models/Teacher";`
);
teContent = teContent.replace(
  /const teacher = await getTeacherProfileByUserId\(req\.user\._id\.toString\(\)\);/g,
  `const teacher = await Teacher.findOne({ userId: req.user._id, isArchived: { $ne: true } });`
);
fs.writeFileSync('D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\teacherTaskCbtController.ts', teContent);

console.log('Fixed typescript errors in CBT controllers');
