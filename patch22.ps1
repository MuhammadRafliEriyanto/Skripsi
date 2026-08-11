$file = "C:\Users\LENOVO\.gemini\antigravity-ide\brain\105f0767-1f77-4725-a407-e37706252304\task.md"
$content = @"
# Task: Migrasi Sistem Latihan Soal (seperti Ujian)

- [x] Ganti field Deadline menjadi Tanggal Mulai dan Tanggal Selesai di antarmuka Detail Kelas.
- [x] Pastikan timer bekerja pada modul Latihan sesuai dengan model di Ujian (termasuk setting jam pengerjaan).
- [x] Ubah format field file unggahan menjadi bentuk template soal berbasis Excel yang memuat pertanyaan sekaligus opsi ganda dan Kunci Jawaban.
- [x] Hapus field Lampiran Kunci Jawaban (terpisah) dari form Tambah Latihan dan sesuaikan agar tidak terjadi error (karena jawaban terintegrasi di dalam satu file Excel tersebut).
- [x] Verifikasi kompabilitas seluruh perubahan dengan menjalankan `npm run build` dan mengatasi seluruh isu Type Checking.
"@
Set-Content -Path $file -Value $content
