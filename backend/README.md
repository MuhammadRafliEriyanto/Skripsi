# SMART BIMBEL SYSTEM

## Business Flow, Architecture & Revision Specification

> **STATUS: MASTER SPECIFICATION — READ ONLY**
>
> Dokumen ini adalah dokumen acuan utama untuk memahami sistem sebelum melakukan perubahan.
>
> **PENTING:**
>
> * Jangan mengubah kode.
> * Jangan mengubah database.
> * Jangan melakukan migration.
> * Jangan INSERT data.
> * Jangan UPDATE data.
> * Jangan DELETE data.
> * Jangan menghapus attempt lama.
> * Jangan melakukan remediation.
> * Jangan memperbaiki bug secara langsung.
>
> Tahap pertama hanya **MEMPELAJARI, MEMETAKAN, DAN MENGAUDIT** sistem.

---

# 1. STRUKTUR PROJECT

Project terdiri dari dua bagian utama:

### Backend

```text
D:\Skripsi\Next Js\bimbel-new\backend
```

Backend menggunakan:

* Node.js
* Express.js
* TypeScript
* MongoDB
* Mongoose

Backend bertanggung jawab terhadap:

* API
* Authentication
* Business logic
* Database access
* Student
* Teacher
* Admin
* Attendance
* Material
* Task
* CBT
* QuestionBank
* Payment
* Membership
* Academic history

---

### Frontend

```text
D:\Skripsi\Next Js\bimbel-new\src\components
```

Frontend menggunakan:

* Next.js
* TypeScript
* React
* Tailwind CSS
* shadcn/ui

Frontend bertanggung jawab terhadap:

* Dashboard siswa
* Dashboard guru
* Dashboard admin
* CBT
* Materi
* Attendance UI
* Payment UI
* Question navigation
* History
* User interaction

---

# 2. INSTRUKSI WAJIB UNTUK AI AGENT

Sebelum melakukan perubahan apa pun:

## Tahap 1 — Pelajari dokumentasi

Baca:

```text
README.md
```

secara penuh.

Kemudian pahami aturan bisnis dan batasan pada dokumen ini.

---

# 3. Tahap 2 — Pelajari BACKEND

Wajib melakukan inspeksi terhadap:

```text
D:\Skripsi\Next Js\bimbel-new\backend
```

Pelajari minimal:

```text
backend/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── scripts/
│   └── ...
├── outputs/
├── storage/
└── ...
```

Struktur aktual harus mengikuti kondisi project.

Jangan berasumsi nama folder/file jika berbeda.

---

# 4. Backend yang Harus Dipahami

Agent harus mencari dan memetakan:

### Database

Cari:

* MongoDB connection
* Mongoose configuration
* Models
* Collections
* Schema
* Index
* Relationship/reference

Minimal identifikasi:

```text
Student
Teacher
QuestionBank
ClassTaskQuestion
StudentTaskAttempt
Attendance
AttendanceSession
Material
Payment
Subscription
Task
Schedule
```

Jika nama model berbeda, gunakan nama aktual yang ditemukan.

---

# 5. Backend API

Petakan endpoint yang berkaitan dengan:

```text
Authentication
Student
Teacher
Admin
Material
Attendance
Task
CBT
QuestionBank
Attempt
Payment
Membership
Academic History
```

Untuk setiap endpoint penting catat:

```text
METHOD
PATH
CONTROLLER
SERVICE
MODEL
DATA YANG DIKEMBALIKAN
```

Contoh:

```text
GET
/api/student/me/learning/tasks/cbt/:attemptId

→ controller
→ service
→ StudentTaskAttempt
→ QuestionBank / ClassTaskQuestion
→ response questions
```

Jangan mengubah endpoint.

---

# 6. Backend CBT

Pelajari secara khusus alur CBT:

```text
Task
 ↓
Start CBT
 ↓
Create Attempt
 ↓
Select Questions
 ↓
Save Attempt
 ↓
Get Attempt
 ↓
Return Questions
 ↓
Submit
 ↓
Calculate Result
 ↓
History
```

Temukan:

* bagaimana soal dipilih
* dari collection mana soal diambil
* bagaimana randomisasi dilakukan
* bagaimana jumlah soal ditentukan
* bagaimana questionId disimpan
* bagaimana attempt menyimpan answers
* bagaimana hasil dihitung
* bagaimana history dibuat

---

# 7. Backend QuestionBank

Pelajari secara khusus:

```text
QuestionBank
```

Cari:

* schema
* field
* questionId
* question text
* options
* answer
* jenjang
* kelas
* mata pelajaran
* materi
* source
* createdAt
* updatedAt

Jika field tertentu tidak ada, catat bahwa field tersebut tidak tersedia.

Jangan membuat field baru.

---

# 8. ClassTaskQuestion

Pelajari:

```text
ClassTaskQuestion
```

Tujuan:

Menentukan apakah soal CBT berasal dari:

```text
QuestionBank
```

atau:

```text
ClassTaskQuestion
```

Cari seluruh penggunaan model tersebut.

Catat:

* siapa yang membuat datanya
* kapan dibuat
* bagaimana questionId terbentuk
* apakah datanya merupakan soal master atau soal yang ditempelkan ke task
* apakah question content disalin atau hanya direferensikan

---

# 9. Attempt

Pelajari:

```text
StudentTaskAttempt
```

Cari:

* attemptId
* taskId
* studentId
* answers
* score
* totalQuestions
* status
* createdAt
* submittedAt
* questionId

Pahami perbedaan:

```text
QuestionBank
```

dengan:

```text
Attempt.answers
```

Jangan menganggap keberadaan questionId pada attempt berarti soal tersebut masih ada di QuestionBank.

---

# 10. Backend Migration V6

Audit script:

```text
D:\Skripsi\Next Js\bimbel-new\backend\src\scripts\migrate-to-v6.js
```

Jangan menjalankan migration.

Hanya baca dan analisis.

Cari tahu:

1. File Excel apa yang dibaca.
2. Apakah benar membaca:

```text
backend/outputs/assessment-bank-rekap/REKAP-BANK-SOAL-VARIED-V6.xlsx
```

3. Bagaimana Excel diparse.
4. Bagaimana validasi dilakukan.
5. Bagaimana answer diproses.
6. Bagaimana questionId dibuat.
7. Bagaimana INSERT dilakukan.
8. Apakah dry-run benar-benar read-only.
9. Berapa row yang diterima.
10. Berapa row yang dilewati.
11. Apakah numeric answer didukung.

---

# 11. SUMBER BANK SOAL UTAMA

File yang menjadi acuan bank soal:

```text
D:\Skripsi\Next Js\bimbel-new\backend\outputs\assessment-bank-rekap\REKAP-BANK-SOAL-VARIED-V6.xlsx
```

File ini harus diaudit.

Jangan langsung import ulang.

Jangan mengubah file.

---

# 12. Audit Excel V6

Hitung:

```text
Total row
Valid row
Invalid row
Valid setelah normalisasi
```

Analisis:

* jenjang
* kelas
* mata pelajaran
* materi
* pertanyaan
* pilihan
* jawaban
* duplikasi

---

# 13. Normalisasi Answer

Periksa apakah answer pada Excel berbentuk:

```text
A
B
C
D
```

atau:

```text
nilai option
```

Jika numeric answer ditemukan, jangan langsung menganggap numeric tersebut adalah index.

Contoh:

```text
A = 5
B = 7
C = 9
D = 12

Answer = 7

→ B
```

Normalisasi harus berdasarkan isi option.

---

# 14. Audit Database QuestionBank

Tanpa mengubah database, periksa:

```text
Total QuestionBank documents
```

Kemudian analisis:

* questionId
* createdAt
* updatedAt
* struktur data
* distribusi jenjang
* distribusi kelas
* distribusi mata pelajaran
* distribusi materi

Jika ada field source, gunakan untuk mengidentifikasi asal data.

---

# 15. PENTING — MATCHING V6

Jangan hanya membandingkan:

```text
questionId Excel
=
questionId Database
```

Karena questionId mungkin dibuat ulang saat migration.

Bandingkan berdasarkan content.

Gunakan kombinasi:

```text
question text
+
options
+
jenjang
+
kelas
+
mata pelajaran
+
materi
```

sesuai field yang benar-benar tersedia.

Tujuannya menentukan:

```text
Berapa soal V6 yang sudah berada di QuestionBank?
```

---

# 16. Backup Migration

Periksa file:

```text
D:\Skripsi\Next Js\bimbel-new\backend\backup-before-v6-migration-2026-08-28.json
```

Read-only.

Bandingkan:

```text
Backup
VS
Excel V6
VS
QuestionBank saat ini
```

Tujuan:

Mengetahui apakah data V6 benar-benar sudah masuk database atau hanya sebagian.

---

# 17. Frontend — WAJIB DIPELAJARI

Setelah backend dipahami, pelajari:

```text
D:\Skripsi\Next Js\bimbel-new\src\components
```

Cari komponen yang berkaitan dengan:

```text
dashboard-siswa
dashboard-guru
dashboard-admin
latihan
CBT
materi
attendance
history
task
question
```

---

# 18. Frontend CBT

Pelajari:

```text
ActiveLatihanPageView.tsx
```

dan seluruh component/service yang digunakan.

Jangan langsung mengubah file.

Pahami:

```text
API
 ↓
Response
 ↓
buildSessionFromTryout
 ↓
State
 ↓
activeSession
 ↓
questions
 ↓
navigator
 ↓
result
 ↓
history
```

---

# 19. Jangan Langsung Menyalahkan Frontend

Jika UI menampilkan:

```text
1 2 3 4 5 6 7 8 9 10
```

jangan langsung menyimpulkan navigator salah.

Trace:

```text
Database
 ↓
Backend
 ↓
API
 ↓
Frontend state
 ↓
DOM
```

Bandingkan count pada setiap tahap.

---

# 20. Proses Bisnis SISWA

Proses bisnis yang menjadi acuan:

```text
Siswa datang ke tempat bimbel
        ↓
Absensi
        ↓
Guru menerangkan materi
± 15–20 menit
        ↓
Siswa mengerjakan latihan CBT
        ↓
Sistem menampilkan hasil
        ↓
Guru melakukan review hasil
        ↓
Siswa pulang
```

---

# 21. Konsep Latihan

Latihan CBT bukan ujian sekolah.

Latihan merupakan bagian dari pembelajaran.

Flow:

```text
Materi
 ↓
Latihan
 ↓
Review
```

---

# 22. Sumber Soal

Guru **tidak membuat soal baru untuk setiap pertemuan**.

Soal berasal dari bank soal terpusat.

Konsep:

```text
Kumpulan soal pendidikan
        ↓
Kurasi / validasi
        ↓
Bank Soal
        ↓
Database
        ↓
Sistem memilih soal
        ↓
CBT
```

---

# 23. Peran Admin

Admin bertanggung jawab terhadap:

```text
Tambah siswa
Tambah guru
Kelola jadwal
Kelola pembayaran
Kelola membership
Kelola bank soal
```

Admin tidak memberikan materi pembelajaran.

---

# 24. Peran Guru

Guru bertanggung jawab terhadap:

```text
Mengajar
Memberikan materi
Memantau latihan
Review hasil latihan
```

Guru menggunakan bank soal yang sudah tersedia.

Guru tidak perlu membuat Excel soal baru setiap pertemuan.

---

# 25. Peran Siswa

Siswa:

```text
Login
 ↓
Datang
 ↓
Absensi
 ↓
Materi
 ↓
Latihan
 ↓
Hasil
```

---

# 26. Data Simulasi P1–P9

Saat ini terdapat data simulasi/dummy:

```text
P1
P2
P3
P4
P5
P6
P7
P8
P9
```

Contohnya:

```text
Latihan CBT P1
TSK-BIMBEL-P1P9-1puwcaf
```

Dengan informasi seperti:

```text
Latihan CBT P1
Status
Tanggal
Nilai
Histori
```

Data P1–P9 juga dapat memiliki relasi dengan:

```text
Material
Task
Attempt
Attendance
Result
History
```

---

# 27. RESET DATA P1–P9

Tujuan revisi adalah membuat simulasi baru dengan struktur bank soal V6.

Namun:

> **Jangan langsung menghapus P1–P9.**

Pertama petakan seluruh relasinya.

Cari:

```text
P1–P9
 ↓
Task
 ↓
Material
 ↓
Attempt
 ↓
Answer
 ↓
History
 ↓
Attendance
```

Kemudian bedakan:

### Data Master

dengan:

### Data Dummy / Transaction

---

# 28. Attendance

Absensi merupakan bagian dari proses pembelajaran.

```text
Datang
 ↓
Absensi
 ↓
Materi
 ↓
Latihan
```

Data absensi lama harus dipisahkan berdasarkan periode.

Jangan menghapus seluruh attendance tanpa audit.

---

# 29. Material

Materi:

```text
Guru menjelaskan
±15–20 menit
 ↓
Siswa latihan
```

Materi bukan sumber soal.

Soal berasal dari QuestionBank.

---

# 30. History

Histori latihan menyimpan hasil pengerjaan.

Contoh:

```text
30 soal
10 benar
20 belum dijawab
```

Histori lama jangan dihapus sebelum dipastikan merupakan data simulasi.

---

# 31. Target Arsitektur Bank Soal

Target yang diinginkan:

```text
                 ┌─────────────────────┐
                 │  Bank Soal Terpusat │
                 └──────────┬──────────┘
                            ↓
                       QuestionBank
                            ↓
                    Filter berdasarkan
                 kelas/materi/mapel/etc.
                            ↓
                       Randomisasi
                            ↓
                       CBT Session
                            ↓
                         Siswa
```

Guru tidak membuat soal untuk setiap latihan.

---

# 32. Target Arsitektur Pembelajaran

```text
Siswa datang
    ↓
Absensi
    ↓
Guru menjelaskan materi
    ↓
Latihan CBT
    ↓
Soal dari QuestionBank
    ↓
Hasil latihan
    ↓
Guru review
```

---

# 33. Prinsip Data CBT

Jika target:

```text
30 soal
```

maka sistem harus memiliki:

```text
30 valid question references
```

yang dapat ditemukan kembali ketika attempt dibuka.

Tidak boleh:

```text
Attempt = 30
API = 10
Frontend = 10
```

tanpa alasan yang valid.

---

# 34. Masalah yang Pernah Ditemukan

Pernah ditemukan attempt:

```text
ATTEMPT-BIMBEL-P1P9-08s3dlk
```

yang memiliki:

```text
answers = 30
```

tetapi backend mengembalikan:

```text
questions = 10
```

Karena sebagian questionId tidak ditemukan pada collection sumber soal.

Hal tersebut harus dipahami sebagai masalah **data/reference integrity** sampai audit membuktikan sebaliknya.

---

# 35. Jangan Menggunakan Placeholder sebagai Solusi Awal

Jangan langsung mengubah backend agar:

```text
question tidak ditemukan
↓
placeholder question
```

Tujuan revisi adalah memastikan source data benar terlebih dahulu.

---

# 36. Aturan Migration

Migration hanya boleh dilakukan setelah:

```text
Audit
 ↓
Validasi
 ↓
Approval
 ↓
Migration
 ↓
Verification
```

Jangan melakukan migration sebelum angka dan source data terbukti.

---

# 37. Aturan Database

Selama fase audit:

```text
READ ONLY
```

Dilarang:

```text
INSERT
UPDATE
DELETE
DROP
MIGRATION
REMEDIATION
```

Termasuk:

* jangan memperbaiki questionId
* jangan mengubah attempt
* jangan menghapus attempt
* jangan mengubah QuestionBank
* jangan mengubah P1–P9
* jangan membuat question baru

---

# 38. Audit yang Harus Dilakukan Terlebih Dahulu

Agent harus menghasilkan laporan:

## A. Project Architecture

```text
Backend:
...

Frontend:
...
```

## B. Database Models

```text
Model
Collection
Purpose
Relations
```

## C. CBT Flow

```text
Start
→ Select Questions
→ Attempt
→ API
→ Frontend
→ Submit
→ Result
→ History
```

## D. Bank Soal

```text
Excel V6
→ Migration
→ QuestionBank
```

## E. P1–P9

```text
P1–P9
→ Task
→ Material
→ Attempt
→ Attendance
→ History
```

---

# 39. Output Audit V6

Gunakan tabel:

| Sumber                       | Jumlah |
| ---------------------------- | -----: |
| Total Excel V6               |    ... |
| Valid awal                   |    ... |
| Invalid                      |    ... |
| Valid setelah normalisasi    |    ... |
| QuestionBank saat ini        |    ... |
| V6 sudah ada di QuestionBank |    ... |
| V6 belum ada di QuestionBank |    ... |

---

# 40. Audit 20 Question ID Lama

Khusus:

```text
QB-8789c4e7-6ad5
QB-947ea512-7d1a
QB-999f4934-2469
QB-b8403361-af69
QB-607027e5-e70f
QB-fa24551f-1dcc
QB-cbaea245-f493
QB-6c69e04f-7fc5
QB-d59d702f-f577
QB-413cf72e-8b63
QB-648376b3-cc57
QB-96a4627a-d2f2
QB-77da4b6d-0d3f
QB-7c86ccc6-720c
QB-eda3da74-b503
QB-a6cede59-008a
QB-8146c927-13a5
QB-665992f7-44ef
QB-a9d80732-e11f
QB-bc4edcdd-9968
```

Jangan hanya mencari berdasarkan ID.

Cari juga berdasarkan content jika memungkinkan.

---

# 41. Hasil Akhir Audit yang Diharapkan

Agent harus menjawab secara terbukti:

### Pertanyaan utama:

> **Apakah Bank Soal V6 sudah benar-benar masuk ke QuestionBank?**

Dan:

> **Berapa soal V6 yang sebenarnya berhasil masuk?**

Serta:

> **Apakah data yang sekarang digunakan CBT berasal dari V6 atau dari data lama?**

---

# 42. Batasan Agent

Pada tahap awal:

```text
READ
SEARCH
TRACE
AUDIT
REPORT
```

Yang TIDAK BOLEH:

```text
WRITE
INSERT
UPDATE
DELETE
MIGRATE
REMEDIATE
```

---

# 43. Instruksi Pertama untuk Agent

Setelah membaca README ini, **jangan melakukan perubahan apa pun**.

Lakukan:

### STEP 1

Pelajari seluruh struktur:

```text
D:\Skripsi\Next Js\bimbel-new\backend
```

dan:

```text
D:\Skripsi\Next Js\bimbel-new\src\components
```

### STEP 2

Identifikasi:

* architecture
* routes
* controllers
* services
* models
* database
* frontend pages
* frontend services
* CBT flow
* QuestionBank flow
* Task flow
* Attempt flow
* P1–P9 data flow

### STEP 3

Audit:

```text
REKAP-BANK-SOAL-VARIED-V6.xlsx
```

dan:

```text
backup-before-v6-migration-2026-08-28.json
```

### STEP 4

Audit:

```text
migrate-to-v6.js
```

tanpa menjalankannya.

### STEP 5

Audit database QuestionBank secara READ-ONLY.

### STEP 6

Bandingkan:

```text
Excel V6
VS
Backup
VS
QuestionBank
VS
CBT
```

### STEP 7

Buat laporan.

---

# 44. STOP CONDITION

Setelah audit selesai:

**STOP.**

Jangan memperbaiki apa pun.

Jangan menghapus P1–P9.

Jangan menghapus attendance.

Jangan menghapus history.

Jangan memperbaiki navigator.

Jangan migration.

Jangan mengubah QuestionBank.

Jangan mengubah attempt.

Tunggu instruksi berikutnya.

---

# 45. Prinsip Utama

Sistem yang diinginkan:

> **Guru mengajar.**
>
> **Admin mengelola operasional dan bank soal.**
>
> **Bank soal terpusat menyediakan soal latihan.**
>
> **Siswa melakukan absensi → menerima materi → mengerjakan latihan CBT → mendapatkan hasil.**

---

# 46. PRIORITAS REVISI

Urutan pekerjaan:

```text
1. Pahami project
        ↓
2. Audit database
        ↓
3. Audit Excel V6
        ↓
4. Audit migration
        ↓
5. Pastikan QuestionBank
        ↓
6. Petakan data P1–P9
        ↓
7. Tentukan data yang benar-benar dummy
        ↓
8. Baru reset data simulasi
        ↓
9. Baru implementasi struktur baru
        ↓
10. Test end-to-end
```

**Jangan melompati urutan tersebut.**
