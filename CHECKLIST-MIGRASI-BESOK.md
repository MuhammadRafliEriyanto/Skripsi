# 🚀 CHECKLIST MIGRASI BESOK - Bank Soal Berkualitas V5

## Status Hari Ini (2025-08-28): ✅ SELESAI

### Generator Sudah:
- [x] Dibuat & diuji coba → **36,850 soal berhasil digenerate**
- [x] Excel output sudah ada di `outputs/assessment-bank-rekap/rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-V5-QUALITY.xlsx`
- [x] Dokumentasi lengkap sudah tersedia

---

## ⏭️ TUGAS BESOK (Hari 1: Backup & Audit)

### Pagi (09:00 - 12:00): BACKUP DATA EXISTING

#### 1. Jalankan Backup Script ⚠️ CRITICAL!
```bash
cd backend
node src/scripts/backup-existing-questionbank.mjs
```

**Expected Output**:
```
✅ Connected to MongoDB
📊 Current question banks: 79,200 documents
💾 Backing up questionbanks to JSON...
✅ Question banks backup saved to: backups/pre-quality-migration-[TODAY]/questionbanks-backup.json
```

**Verify**:
- [ ] Folder `backups/pre-quality-migration-[TODAY]/` ter-create
- [ ] File `questionbanks-backup.json` ada (ukuran ~50-100 MB)
- [ ] File `statistics-summary.json` ada
- [ ] Tidak ada error message

#### 2. Jalankan Audit Script 🔍
```bash
cd backend
node src/scripts/audit-existing-questionbank.mjs
```

**Expected Output**:
```
📊 TOTAL SOAL DI DATABASE: 79,200
📌 DISTRIBUTION BY PROGRAM: SMA IPA, SMA IPS, SMP 7-9
📌 DISTRIBUTION BY SUBJECT: Matematika, Fisika, Kimia, dll.
🔍 SAMPLE QUESTIONS: Check quality pattern
```

**Verify**:
- [ ] Report audit ter-create: `audit-reports/audit-existing-[TODAY].json`
- [ ] Jumlah subject dan program tercatat
- [ ] Sample questions ditampilkan dengan status "DUMMY" atau "real"

#### 3. Review Hasil Backup
[ ] Buka folder backup dan cek ukuran file
[ ] Catat jumlah existing questions: _______________
[ ] Screenshot hasil audit untuk dokumentasi

---

### Siang (13:00 - 15:00): ANALISIS & PERENCANAAN

#### 4. Review Audit Report
[ ] Buka `audit-reports/audit-existing-[TODAY].json`
[ ] Identifikasi mata pelajaran yang paling banyak soalnya
[ ] Cek apakah ada duplicate questions
[ ] Catatan masalah: ____________________________________________

#### 5. Persiapan Import
[ ] Pastikan package dependencies tersedia:
```bash
npm list mongodb xlsx dotenv
```

[ ] Jika belum ada, install:
```bash
npm install mongodb@^6.0.0 xlsx@^0.18.0 dotenv@^16.0.0
```

---

### Sore (15:00 - 17:00): KEPUTUSAN STRATEGI

#### 6. Tentukan Import Strategy
**Pilihan A**: REPLACE semua (hapus 79,200 dummy → isi 36,850 quality)  
- Pros: Fresh start, tidak ada sisa dummy  
- Cons: Total soal berkurang drastis (79k → 36k)  

**Pilihan B**: APPEND (tambah 36,850 ke existing 79,200)  
- Pros: Total meningkat menjadi ~116k, variasi lebih banyak  
- Cons: Database lebih besar, masih ada sisa dummy  

**RECOMMENDATION**: **APPEND** (total variation lebih tinggi untuk randomisasi maksimal)

Catat keputusan: [ ] REPLACE / [ ] APPEND

---

### End of Day Deliverables:

- [ ] ✅ Backup file tersimpan aman (pastikan di cloud + local)
- [ ] ✅ Audit report selesai
- [ ] ✅ Keputusan strategi import telah ditentukan
- [ ] ✅ Stakeholders notified tentang schedule import hari berikutnya

---

## 📋 PREPARATION UNTUK HARI BERIKUTNYA (Hari 2/3: Import)

### Checklist Pre-Import:
- [ ] Backup verified working (can restore if needed)
- [ ] Import script ready (`import-quality-questions-v5.mjs`)
- [ ] Dependencies installed and tested
- [ ] Maintenance window scheduled (if production impact)
- [ ] Team notified about planned downtime
- [ ] Rollback procedure documented
- [ ] Console access confirmed for monitoring

### Test Run (Optional but Recommended):
```bash
# Test connection first
node -e "const { MongoClient } = require('mongodb'); const client = new MongoClient(process.env.MONGODB_URI); client.connect().then(() => console.log('✅ Connection OK')).catch(console.error)"
```

---

## 🎯 Success Metrics Hari Ini:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Backup completed | Yes | ___ | ☐ |
| Audit completed | Yes | ___ | ☐ |
| Strategy decided | Yes | ___ | ☐ |
| Error-free process | Yes | ___ | ☐ |

---

## 📞 Contact Points:

| Issue Type | Contact |
|------------|---------|
| Technical problems | LMS Development Team |
| Database issues | DBA Team |
| Business decisions | Project Manager |
| Teacher review coordination | Academic Team Lead |

---

## 📝 Notes & Observations:

**Backup Location**: _________________________________________________

**Existing Question Count**: _________________________________________

**Key Findings from Audit**: 
_______________________________________________________________
_______________________________________________________________

**Import Strategy Decision**: [ ] REPLACE [ ] APPEND

**Decision Reason**: _______________________________________________
_______________________________________________________________

**Blockers/Issues**: _______________________________________________
_______________________________________________________________

**Next Action Owner**: _____________________________________________

**Next Action Deadline**: ___________________________________________

---

*Prepared by: ___________________ Date: ___________*  
*Approved by: ____________________ Date: ___________*
