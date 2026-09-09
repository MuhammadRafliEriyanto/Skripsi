# Desain Import dan Entri Manual Bank Soal Admin

## Tujuan

Menambahkan kemampuan pada halaman Admin - Bank Soal untuk:

1. membuat soal secara manual seperti fitur guru;
2. mengimpor soal dari template Excel;
3. mengimpor soal dari PDF dengan mempertahankan gambar dan membaca jawaban yang ditandai biru;
4. meninjau hasil ekstraksi sebelum data digunakan.

## Keputusan Produk

- Soal manual buatan admin disimpan sebagai `approved` dan `bankScope: "global"`.
- Hasil import PDF dan Excel disimpan sebagai `review` setelah admin mengonfirmasi preview.
- Topik yang kosong dinormalisasi menjadi `Umum`.
- Jenjang, kelas, dan mata pelajaran dipilih admin pada saat upload dan dapat dikoreksi per soal di preview.
- Pembahasan yang kosong dapat dihasilkan otomatis dan ditandai sebagai hasil AI.
- Item yang tidak memiliki soal lengkap, opsi A-D, atau kunci valid tidak dapat disimpan.

## Arsitektur

### Antarmuka Admin

Halaman bank soal memperoleh tiga aksi utama:

- `Tambah soal` membuka formulir manual;
- `Import Excel` menerima template `.xlsx`;
- `Import PDF` menerima PDF dan metadata upload.

Import menggunakan alur dua tahap:

1. upload dan parsing menghasilkan sesi preview sementara;
2. admin mengoreksi pilihan, kunci, gambar, dan metadata lalu mengonfirmasi penyimpanan.

Preview menampilkan status validasi setiap item. Item valid dapat dipilih untuk disimpan; item bermasalah tetap terlihat dengan pesan kesalahan.

### Backend Express

Route admin bank soal ditambah endpoint untuk:

- membuat soal manual;
- memperbarui soal;
- mengarsipkan soal;
- mengunduh template Excel;
- membuat preview import Excel;
- membuat preview import PDF;
- mengonfirmasi dan menyimpan hasil preview.

Controller tidak menerima status, scope, ID pembuat, atau URL gambar secara mentah dari klien. Nilai tersebut ditetapkan server berdasarkan peran dan hasil upload tervalidasi.

### Kontrak Data

Data tetap menggunakan `QuestionBankItem` format V6:

- `program`: `SD`, `SMP`, atau `SMA`;
- `className`: kelas kanonis, misalnya `SD 6` atau `SMA 10`;
- `subject`: mata pelajaran pilihan admin;
- `topic`: nilai file atau `Umum`;
- `questionText`;
- `options.A` sampai `options.D`;
- `correctAnswer`: `A`, `B`, `C`, atau `D`;
- `explanation`;
- `difficulty`: `Mudah`, `Sedang`, atau `Sulit`;
- gambar opsional melalui `imageUrl` dan `imagePublicId`;
- metadata sumber import dan penanda pembahasan AI ditambahkan secara kompatibel pada schema.

ID soal dibuat server dengan ID unik yang tidak hanya bergantung pada timestamp.

## Import Excel

Template baku memakai satu baris per soal dengan kolom:

`program`, `className`, `subject`, `topic`, `questionText`, `optionA`, `optionB`, `optionC`, `optionD`, `correctAnswer`, `explanation`, `difficulty`, dan `imageUrl`.

Aturan:

- nama kolom memiliki alias Indonesia yang terbatas dan terdokumentasi;
- kolom topik kosong menjadi `Umum`;
- pembahasan kosong ditandai untuk dibuat otomatis;
- gambar menerima URL HTTPS; gambar tertanam di workbook tidak didukung pada versi pertama;
- semua baris divalidasi dan dideduplikasi sebelum preview.

## Import PDF

PDF diproses oleh service ekstraksi terpisah karena OCR, informasi warna, tata letak, dan crop gambar tidak cocok ditangani langsung oleh controller Node.

Pipeline:

1. halaman PDF dirender dan struktur teks dibaca;
2. blok soal dan opsi A-D dikelompokkan berdasarkan tata letak;
3. warna teks/glyph diperiksa untuk menentukan opsi biru sebagai kandidat kunci;
4. gambar atau diagram yang berada dalam area soal dipotong dan dikaitkan ke nomor soal;
5. hasil dinormalisasi menjadi payload preview;
6. tingkat keyakinan dan peringatan disertakan untuk setiap soal.

Jika warna biru tidak dapat ditentukan secara tunggal, kunci dikosongkan dan item wajib dikoreksi admin. Sistem tidak menebak kunci secara diam-diam.

Service ekstraksi harus dapat dijalankan lokal dan dikonfigurasi melalui environment variable. Kegagalan service tidak boleh memengaruhi tambah soal manual atau import Excel.

## Gambar

- Form manual menerima satu gambar per soal.
- Import PDF menghasilkan maksimal satu crop gabungan per soal pada versi pertama.
- Gambar diunggah melalui utilitas Cloudinary yang sudah ada.
- Upload yang gagal tidak meninggalkan dokumen soal setengah jadi.
- Gambar lama dihapus ketika diganti atau item diarsipkan sesuai kebijakan penyimpanan aplikasi.

## Pembahasan Otomatis

Pembuatan pembahasan berada di service terpisah dan berjalan hanya untuk item tanpa pembahasan. Input mencakup soal, opsi, kunci, dan gambar jika model mendukung vision.

Kegagalan AI tidak menggagalkan seluruh import. Item tetap berada di preview dengan pembahasan kosong dan peringatan. Admin dapat menulis pembahasan manual.

## Keamanan dan Batasan

- Semua endpoint memakai API key, autentikasi, dan otorisasi `admin`/`owner` yang sudah ada.
- Jenis MIME, ekstensi, ukuran file, jumlah baris, jumlah halaman, dan jumlah soal dibatasi.
- Nama file tidak dipakai langsung sebagai path penyimpanan.
- Payload preview diberi masa berlaku dan terikat ke pengguna yang mengunggah.
- HTML/Markdown hasil ekstraksi disanitasi sebelum ditampilkan.
- Penyimpanan menggunakan operasi bulk tervalidasi; kegagalan parsial dilaporkan secara eksplisit.

## Penanganan Duplikat

Duplikat diperiksa menggunakan fingerprint ternormalisasi dari jenjang, kelas, mapel, teks soal, dan opsi. Preview menandai duplikat di file maupun database. Secara default duplikat dilewati, tetapi admin dapat memilih mengganti item yang cocok setelah melihat perbandingan.

## Pengujian

- Unit test parser dan validator untuk baris valid, nilai kosong, alias kolom, dan kunci tidak valid.
- Test controller untuk autentikasi, batas file, status/scope buatan server, serta konfirmasi preview.
- Test pipeline PDF memakai fixture kecil yang mencakup jawaban biru, rumus, dan gambar.
- Playwright menguji tambah manual, preview Excel, error import, koreksi item, dan konfirmasi penyimpanan.
- Verifikasi regresi memastikan review/approve/reject yang sudah ada tetap bekerja.

## Tahapan Implementasi

1. Ekstrak validator dan service CRUD bersama dari alur guru tanpa mengubah perilaku guru.
2. Tambahkan CRUD manual admin dan UI-nya.
3. Tambahkan template, preview, validasi, dan konfirmasi Excel.
4. Tambahkan kontrak service serta pipeline PDF.
5. Tambahkan pembahasan otomatis sebagai kemampuan opsional setelah import dasar stabil.

Urutan ini membuat fitur manual dan Excel tetap dapat dipakai apabila runtime OCR PDF belum tersedia di mesin deployment.
