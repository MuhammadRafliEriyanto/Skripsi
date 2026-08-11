const fs = require('fs');
const file = 'C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\105f0767-1f77-4725-a407-e37706252304\\walkthrough.md';
const content = `# Ringkasan Integrasi Sistem Latihan CBT

Sistem Latihan CBT untuk tugas harian sekarang telah **SELESAI** diintegrasikan sepenuhnya, menghubungkan antara *dashboard* guru (sebagai pengunggah soal) dengan *dashboard* siswa (sebagai pengerja soal) serta *backend* sebagai otak sistemnya.

## Apa yang telah diselesaikan?

### 1. Perubahan Struktur Backend
- Menambahkan *schema* \`ClassTaskQuestion\` untuk menyimpan butir soal pilihan ganda dari tugas latihan.
- Menambahkan *schema* \`StudentTaskAttempt\` untuk melacak riwayat dan progres ujian/latihan CBT milik siswa (menyimpan *timer*, jawaban yang diplih, dsb).
- Menambahkan metadata batas lulus, jumlah soal, dan rentang waktu ujian pada *schema* \`ClassTask\`.

### 2. Integrasi Pengunggahan Soal oleh Guru
- Membuat \`teacherTaskCbtController\` dan \`POST /api/teacher/me/classes/:classId/tasks/:taskId/questions/xlsx\` yang menggunakan *parser* file Excel Ujian Tryout yang sudah ada untuk menelan soal Latihan.
- Memodifikasi alur pembuatan Tugas di \`DetailKelasGuruSection.tsx\` agar ketika guru melampirkan file \`.xlsx\`, *frontend* secara otomatis mengunggahnya ke jalur *parser* soal CBT dan mengekstraksinya menjadi soal latihan siap pakai.

### 3. Integrasi Pengerjaan CBT oleh Siswa
- Membuat \`studentTaskCbtController\` yang menangani logika \`start\`, pengambilan butir soal CBT, dan kalkulasi nilai (*submission*).
- Menghidupkan kembali rute \`/dashboard-siswa/latihan/:attemptId/cbt\` di \`ActiveLatihanPageView.tsx\`. Saat ini *page* tersebut akan langsung menarik data sesi dari API CBT yang baru saja kita bangun, lalu mengirim nilainya (skor Latihan) saat menekan kumpul.
- Tombol "Mulai Latihan" di Dashboard Siswa telah di-sinkronisasikan dengan \`POST /.../cbt/start\` untuk membuat ID percobaan terlebih dahulu sebelum memulai ujian.

## Verifikasi
Baik \`npm run build\` di Next.js maupun \`npx tsc\` di backend saat ini telah berhasil melalui kompilasi dengan **0 (Nol) Errors**. Keseluruhan alur telah sesuai dari ujung ke ujung.
`;

fs.writeFileSync(file, content);
console.log('Updated walkthrough.md');
