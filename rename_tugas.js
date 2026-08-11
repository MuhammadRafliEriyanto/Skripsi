const fs = require('fs');

function replaceWord(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace capitalized "Tugas" with "Latihan", "tugas" with "latihan" in strings
  // but be careful not to break variable names or API endpoints. 
  // We'll replace specific phrases or UI strings.
  
  content = content.replace(/Tugas Aktif/g, 'Latihan Aktif');
  content = content.replace(/tugas aktif/g, 'latihan aktif');
  content = content.replace(/Memuat tugas/g, 'Memuat latihan');
  content = content.replace(/Sedang Memuat Tugas/g, 'Sedang Memuat Latihan');
  content = content.replace(/mengambil tugas/g, 'mengambil latihan');
  content = content.replace(/Belum Ada Tugas/g, 'Belum Ada Latihan');
  content = content.replace(/menambahkan tugas/g, 'menambahkan latihan');
  content = content.replace(/Detail Tugas/g, 'Detail Latihan');
  content = content.replace(/Tugas sudah dikumpulkan/g, 'Latihan sudah dikumpulkan');
  content = content.replace(/Tugas Regul/g, 'Latihan Regul');
  content = content.replace(/tab tugas/g, 'tab latihan');
  
  // DetailKelasGuruSection
  content = content.replace(/Tambah Tugas/g, 'Tambah Latihan');
  content = content.replace(/Tugas Kelas/g, 'Latihan Kelas');
  content = content.replace(/Tugas Pertemuan/g, 'Latihan Pertemuan');
  content = content.replace(/Tugas disimpan/g, 'Latihan disimpan');
  content = content.replace(/Hapus Tugas/g, 'Hapus Latihan');
  content = content.replace(/judul tugas/g, 'judul latihan');
  content = content.replace(/Tugas baru/g, 'Latihan baru');
  content = content.replace(/Edit Tugas/g, 'Edit Latihan');

  fs.writeFileSync(filePath, content);
}

replaceWord('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\pages\\TugasSiswaPageView.tsx');
replaceWord('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx');
replaceWord('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\detail-kelas\\TugasFormDialog.tsx');
replaceWord('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\detail-kelas\\TugasPertemuanTable.tsx');
replaceWord('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\components\\SiswaDashboardView.tsx');

// SiswaDashboardView Sidebar might have "Tugas" mapped in navigation, let's look for label: "Tugas"
let siswaDash = fs.readFileSync('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\components\\SiswaDashboardView.tsx', 'utf8');
siswaDash = siswaDash.replace(/label: "Tugas",/g, 'label: "Latihan",');
fs.writeFileSync('D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\components\\SiswaDashboardView.tsx', siswaDash);

console.log('Renamed Tugas to Latihan in UI');
