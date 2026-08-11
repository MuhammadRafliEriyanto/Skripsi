$file = "C:\Users\LENOVO\.gemini\antigravity-ide\brain\105f0767-1f77-4725-a407-e37706252304\task.md"
$content = @"
# Migrasi Latihan Siswa ke CBT

- [x] Analisis struktur API dan antarmuka Ujian (CBT) saat ini
- [x] Ubah `TugasSiswaPageView.tsx` agar tombol aksinya mengarahkan siswa ke antarmuka kuis/CBT.
- [x] Implementasikan halaman `ActiveLatihanPageView.tsx` (mengadopsi _engine_ dari `ActiveTryoutPageView`).
- [ ] Buat/Sesuaikan rute API untuk memuat soal latihan (TERTUNDA: Menunggu Backend).
- [ ] Buat/Sesuaikan rute API untuk memproses _submit_ jawaban pilihan ganda latihan (TERTUNDA: Menunggu Backend).
- [ ] Verifikasi keseluruhan alur kerja (TERTUNDA).
"@
Set-Content -Path $file -Value $content
