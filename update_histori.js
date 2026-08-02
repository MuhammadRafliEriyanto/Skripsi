const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/dashboard-siswa/sections/HistoriTagihanSiswa.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const jsxNew = fs.readFileSync(path.join(__dirname, 'histori_jsx.txt'), 'utf8');

const startStr1 = '  return (\n    <>\n    <section className="overflow-hidden';
const startStr2 = '  return (\r\n    <>\r\n    <section className="overflow-hidden';

let startIdx = content.indexOf(startStr1);
if (startIdx === -1) startIdx = content.indexOf(startStr2);

if (startIdx !== -1) {
    const componentEnd = content.indexOf('  );\r\n}\r\n') !== -1 ? '  );\r\n}\r\n' : (content.indexOf('  );\n}\n') !== -1 ? '  );\n}\n' : (content.indexOf('  );\r\n}') !== -1 ? '  );\r\n}' : '  );\n}'));
    const endIdx = content.lastIndexOf(componentEnd);
    
    if (endIdx !== -1) {
        content = content.substring(0, startIdx) + '  return (\n    ' + jsxNew + '\n  );\n}\n';
        fs.writeFileSync(filePath, content);
        console.log('Update histori complete.');
    } else {
        console.log('end block not found');
    }
} else {
    console.log('startStr not found');
}
