const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

const sortOld = `    if (left.pertemuanKe !== right.pertemuanKe) {
      return left.pertemuanKe - right.pertemuanKe;
    }

    return left.deadline.localeCompare(right.deadline);`;

const sortNew = `    if (left.pertemuanKe !== right.pertemuanKe) {
      return left.pertemuanKe - right.pertemuanKe;
    }

    return left.tanggalSelesai.localeCompare(right.tanggalSelesai);`;

content = content.replace(sortOld, sortNew);

fs.writeFileSync(file, content);
console.log('Fixed sort function in DetailKelasGuruSection.tsx');
