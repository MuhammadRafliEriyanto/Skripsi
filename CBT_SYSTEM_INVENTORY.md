# INVENTORY - CBT/LATIHAN SOAL SYSTEM AUDIT (READ-ONLY)

## 📁 WILAYAH EXPLORASI
Path: `d:\Skripsi\Next Js\bimbel-new\src\components\dashboard-siswa\`

---

## 🎯 KATEGORI 1: HALAMAN UTAMA PRINSIPAL

### 1. LATIHAN SOAL / TUGAS
**File:** `src/components/dashboard-siswa/pages/LatihanSiswaPageView.tsx`
- **Component Name:** `LatihanSiswaPageView`
- **Fungsi Utama:** Halaman daftar tugas/latihan yang tersedia untuk siswa
- **Fitur:**
  - Menampilkan list semua tugas dengan status (Belum Dikerjakan, Menunggu Dikirim, Sudah Dikirim, Sudah Dinilai, Perlu Remedial)
  - Filter berdasarkan mata pelajaran
  - Dialog konfirmasi sebelum memulai latihan
  - Sorting dan pagination
- **API Endpoints:**
  - `GET /api/student/me/learning/data` (via useStudentLearningData)
  - `POST /api/student/me/learning/tasks/{taskId}/cbt/start` - Start CBT session
  - `GET /api/student/me/learning/tasks/cbt/{attemptId}` - Fetch task questions
  - `POST /api/student/me/learning/tasks/cbt/{attemptId}/submission` - Submit answers
- **Data UI:**
  - taskId, title, mapel (mata pelajaran), deadline
  - status, submissionStatus, grade
  - questionCount, durationMinutes
  - mySubmission, myGrade, myAttempt

**Routing:** `/dashboard-siswa/latihan/page.tsx` → redirects to LatihanSiswaPageView

---

### 2. HALAMAN PENGERJAAN LATIHAN (CBT INTERFACE)
**File:** `src/components/dashboard-siswa/pages/ActiveLatihanPageView.tsx`
- **Component Name:** `ActiveLatihanPageView`
- **Fungsi Utama:** Interface pengerjaan soal latihan dengan timer CBT
- **Fitur:**
  - Question-by-question navigation
  - Timer countdown real-time
  - Flag/unflag pertanyaan untuk review
  - Skip atau lanjut ke nomor berikutnya
  - Summary dashboard (jawab, belum, flagged)
  - Navigation prev/next question
  - Auto-submit when timer expires
- **API Endpoints:**
  - `GET /api/student/me/learning/tasks/cbt/{attemptId}` - Get task & questions
  - `POST /api/student/me/learning/tasks/cbt/{attemptId}/submission` - Submit answers
- **Data UI:**
  - activeAttempt (attemptId, status, score)
  - questions array with options
  - answerMap (selected answers)
  - remainingSeconds (timer)
  - totalQuestions, flags
- **Route Parameter:** attemptId dari URL params

**Route File:** `src/app/dashboard-siswa/latihan/[taskId]/cbt/page.tsx`

---

### 3. TRYOUT / UJIAN
**File:** `src/components/dashboard-siswa/pages/TryoutSiswaPageView.tsx`
- **Component Name:** `TryoutSiswaPageView`
- **Fungsi Utama:** Daftar tryout/ujian tersedia (UTS, UAS, Tryout UTBK)
- **Fitur:**
  - Filter by assessment type (UTS/UAS/Tryout)
  - Status availability (scheduled, open, closed)
  - Target score display
  - UTBK stage tracking
- **API Endpoints:**
  - `GET /api/student/me/tryouts` (via useStudentTryouts)
  - `POST /api/student/me/tryouts/{tryoutId}/start` - Start attempt
  - `GET /api/student/me/tryouts/{tryoutId}` - Get tryout details
  - `POST /api/student/me/tryouts/{tryoutId}/submission` - Submit result
- **Data UI:**
  - tryout list dengan myAttempt status
  - assessmentType (UTS/UAS/Tryout)
  - startAt, endAt, durationMinutes
  - questionCount, totalQuestions
  - availability, availabilityMessage
  - stage (untuk UTBK)

**Route:** `/dashboard-siswa/tryout/page.tsx` → redirects to `/dashboard-siswa/ujian`

---

### 4. HALAMAN PENGERJAAN TRYOUT (ACTIVE SESSION)
**File:** `src/components/dashboard-siswa/pages/ActiveTryoutPageView.tsx`
- **Component Name:** `ActiveTryoutPageView`
- **Fungsi Utama:** Interface pengerjaan tryout dengan full CBT engine
- **Fitur:**
  - Question navigator dengan grid view
  - Color-coded status (answerred, unanswered, flagged, correct/incorrect)
  - Timer countdown dengan alarm
  - Review mode after submission
  - Result display post-submission
  - Explanation viewer
  - Score breakdown
- **API Endpoints:**
  - `GET /api/student/me/tryouts/{tryoutId}` - Fetch tryout data
  - `POST /api/student/me/tryouts/{tryoutId}/submission` - Submit and get results
- **Data UI:**
  - ActiveTryoutSession object
  - StudentTryoutQuestion[] 
  - StudentTryoutResult (score, correctCount, wrongCount, etc.)
  - myAttempt history dengan answers detail

**Route File:** `src/app/dashboard-siswa/ujian/[attemptId]/page.tsx`

---

## 📊 KATEGORI 2: HASIL & STATISTIK

### 5. NILAI / GRADES
**File:** `src/components/dashboard-siswa/pages/NilaiSiswaPageView.tsx`
- **Component Name:** `NilaiSiswaPageView`
- **Fungsi Utama:** Display nilai latihan, tryout, dan akademik
- **Fitur:**
  - UTBK score progress tracking
  - Grade summary per subject
  - Best score highlighter
  - Stage completion tracker
  - Readiness indicator ("Perlu Penguatan", "Data Lengkap")
  - Filter by semester/class
- **API Endpoints:**
  - `GET /api/student/me/learning/data` - Academic scores
  - `GET /api/student/me/tryouts` - Tryout scores
- **Data UI:**
  - StudentTaskGradeSummary
  - StudentTryoutItem[] dengan score history
  - AcademicScores breakdown
  - UTBK stage progress

---

### 6. PROGRESS TRACKING WIDGETS

#### a. UtbkProgressWidget
**File:** `src/components/dashboard-siswa/widgets/UtbkProgressWidget.tsx`
- **Fungsi:** Progress widget khusus UTBK student
- **Data:**
  - Completed stage count vs target
  - Best score per stage
  - Latest tryout date
  - Material count

#### b. UtbkTargetWidget  
**File:** `src/components/dashboard-siswa/widgets/UtbkTargetWidget.tsx`
- **Fungsi:** Target campus/major display
- **Data:**
  - targetKampus, targetJurusan
  - utbkTrack status
  - Completion metrics

#### c. HeaderAkademikSiswa
**File:** `src/components/dashboard-siswa/sections/HeaderAkademikSiswa.tsx`
- **Fungsi:** Header summary learning access
- **Data:**
  - Membership status
  - Class info
  - Quick action buttons

---

## 📜 KATEGORI 3: RIWAYAT & SEJARAH

### 7. RIWAYAT AKADEMIK
**File:** `src/components/dashboard-siswa/pages/RiwayatAkademikSiswaPageView.tsx`
- **Component Name:** `RiwayatAkademikSiswaPageView`
- **Fungsi:** Historical membership data viewer
- **Sub-Components:**
  - `AcademicHistoryPeriodList` - Subscription period selector
  - `AcademicHistoryDetailPanel` - Detailed metrics per period
- **API Endpoints:**
  - `GET /api/student/me/academic-history` - List subscriptions
  - `GET /api/student/me/academic-history/{subscriptionId}` - Period detail
- **Data UI:**
  - AcademicHistorySubscription[]
  - AcademicHistoryDetailData (nilai, absensi, latihan, tryout per periode)

---

## 📚 KATEGORI 4: MATERI BELAJAR

### 8. MATERI SISWA
**File:** `src/components/dashboard-siswa/pages/MateriSiswaPageView.tsx`
- **Component Name:** `MateriSiswaPageView`
- **Fungsi:** Library materi pembelajaran
- **Fitur:**
  - Subject-based categorization
  - Progress tracking (belum dibuka, sedang dipelajari, selesai)
  - Meeting number organization
  - Attachment viewer
- **API Endpoints:**
  - `GET /api/student/me/learning/data`
  - `POST /api/student/me/learning/materials/{materialId}/progress` - Update progress
  - `GET /api/student/me/learning/materials/{materialId}/attachment`
- **Data UI:**
  - StudentMaterial[]
  - progressLabel, status
  - attachment file info

---

## 🧩 KATEGORI 5: DATA LAYER & HOOKS

### 9. CUSTOM REACT HOOKS

#### a. useStudentLearningData
**File:** `src/components/dashboard-siswa/data/useStudentLearningData.ts`
- **Return Values:**
  - materials: StudentMaterial[]
  - tasks: StudentTask[]
  - academicSummaries: StudentAcademicSummary[]
  - student: StudentLearningProfile
  - academicAccess: StudentAcademicAccess
  - isLoading, loadError, refreshLearningData
- **API Calls:**
  - Single fetch to `/api/student/me/learning/data`
  - Normalizes raw API response into typed objects

#### b. useStudentTryouts
**File:** `src/components/dashboard-siswa/data/useStudentTryouts.ts`
- **Return Values:**
  - tryouts: StudentTryoutItem[]
  - academicAccess: StudentAcademicAccess | null
  - isLoading, loadError
- **API Calls:**
  - `GET /api/student/me/tryouts`
  - Auto-refresh on dashboard events

---

## 🎨 KATEGORI 6: SHELL & NAVIGATION

### 10. LEARNING SHELL & NAV

#### StudentLearningShell
**File:** `src/components/dashboard-siswa/learning/StudentLearningShell.tsx`
- **Fungsi:** Wrapper layout dengan header belajar
- **Features:**
  - Breadcrumb navigation
  - UTBK vs regular student theming
  - Back to dashboard link

#### StudentLearningNav
**File:** `src/components/dashboard-siswa/learning/StudentLearningNav.tsx`
- **Fungsi:** Tab navigation untuk area belajar
- **Menu Items:**
  - Regular: Materi | Latihan Soal
  - UTBK: Materi | Tryout

---

## 🔧 KATEGORI 7: UTILITIES & HELPERS

### 11. tryoutUtils.ts
**File:** `src/components/dashboard-siswa/pages/tryoutUtils.ts`
- **Exports:**
  - Type definitions (AnswerMap, AssessmentType, StudentTryoutOption, etc.)
  - `buildSessionFromTryout()` - Construct ActiveTryoutSession
  - `fetchStudentTryoutJson()` - Fetch tryout data JSON
  - `formatTimer()` - HH:MM:SS format
  - `getOptionClass()`, `getPaletteClass()` - UI class helpers
  - `getQuestionKey()`, `getTotalQuestions()` - Navigation helpers
  - `normalizeText()` - Text sanitization
- **Types Defined:**
  - StudentTryoutAttempt
  - StudentTryoutItem
  - StudentTryoutQuestion
  - StudentTryoutOption
  - StudentTryoutResult
  - StudentTryoutDetailResponse
  - StudentTryoutStartResponse
  - StudentTryoutSubmitResponse
  - StudentTryoutListResponse
  - ActiveTryoutSession

---

## 📋 KATEGORI 8: SECTION COMPONENTS

### 12. PelajaranSiswaSection
**File:** `src/components/dashboard-siswa/sections/PelajaranSiswaSection.tsx`
- **Fungsi:** Dashboard section untuk quick access materi & latihan
- **Tabs:** Materi | Latihan
- **Features:**
  - Inline preview cards
  - Quick start CBT button
  - Loading states

### 13. HeaderProfilSiswa
- Display student profile summary

### 14. HistoriTagihanSiswa
- Billing/payment history

### 15. HeaderAkademikSiswa
- Academic access header (lihat point 6c)

---

## 🗺️ KATEGORI 9: ROUTES & PAGE STRUCTURE

### Dashboard Routes Mapping:
```
/dashboard-siswa/latihan              → LatihanSiswaPageView
/dashboard-siswa/latihan/[attemptId]/cbt → ActiveLatihanPageView
/dashboard-siswa/ujian                → TryoutSiswaPageView (via redirect from /tryout)
/dashboard-siswa/ujian/[attemptId]    → ActiveTryoutPageView
/dashboard-siswa/materi               → MateriSiswaPageView
/dashboard-siswa/niai                 → NilaiSiswaPageView
/dashboard-siswa/riwayat-akademik     → RiwayatAkademikSiswaPageView
/dashboard-siswa/jadwal               → JadwalSiswaPageView
/dashboard-siswa/absensi              → AbsensiSiswaPageView
/dashboard-siswa/tagihan              → TagihanSiswaPageView
```

---

## 🔌 KATEGORI 10: API ENDPOINTS SUMMARY

### Learning Data API:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/student/me/learning/data` | GET | Main learning data feed |
| `/api/student/me/learning/tasks/{taskId}/cbt/start` | POST | Start CBT session |
| `/api/student/me/learning/tasks/cbt/{attemptId}` | GET | Get questions |
| `/api/student/me/learning/tasks/cbt/{attemptId}/submission` | POST | Submit answers |
| `/api/student/me/learning/tasks/{taskId}/submission` | POST | Manual submission |
| `/api/student/me/learning/materials/{materialId}/progress` | POST | Update material progress |
| `/api/student/me/learning/materials/{materialId}/attachment` | GET | Download attachment |
| `/api/student/me/learning/tasks/{taskId}/attachment` | GET | Download task attachment |

### Tryout API:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/student/me/tryouts` | GET | List available tryouts |
| `/api/student/me/tryouts/{tryoutId}` | GET | Get tryout details |
| `/api/student/me/tryouts/{tryoutId}/submission` | POST | Submit & calculate score |

### Academic History API:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/student/me/academic-history` | GET | List memberships |
| `/api/student/me/academic-history/{subscriptionId}` | GET | Period detail |

---

## 🎭 KATEGORI 11: TYPES & DATA MODELS

### Core Types (from learning-types.ts):
- `StudentLearningProfile` - Student basic info
- `StudentAcademicAccess` - Access permissions
- `StudentMaterial` - Learning material
- `StudentTask` - Assignment/task
- `StudentTaskSubmissionSummary` - Submission metadata
- `StudentTaskGradeSummary` - Grade info
- `StudentAcademicSummary` - Aggregate stats

### Tryout Types (from tryoutUtils.ts):
- See Section 11 above

---

## 🔍 PENCARIAN POLA NAMING

### Files terkait CBT/Tugas/Practice:
1. `LatihanSiswaPageView.tsx` - Practice list
2. `ActiveLatihanPageView.tsx` - Practice interface
3. `TryoutSiswaPageView.tsx` - Tryout list  
4. `ActiveTryoutPageView.tsx` - Tryout interface
5. `tryoutUtils.ts` - Tryout utilities
6. `useStudentLearningData.ts` - Learning data hook
7. `useStudentTryouts.ts` - Tryouts hook
8. `NilaiSiswaPageView.tsx` - Grades page
9. `MateriSiswaPageView.tsx` - Materials page
10. `RiwayatAkademikSiswaPageView.tsx` - History page
11. `UtbkProgressWidget.tsx` - UTBK progress
12. `UtbkTargetWidget.tsx` - UTBK target

### Routing Patterns:
- `/latihan/` - Practice/tugas management
- `/ujian/` - Tryout/exam management
- `/materi/` - Learning materials
- `/nilai/` - Grades/scores
- `/riwayat-akademik/` - Academic history

---

## ⚙️ FITUR KHUSUS UTBK TRACKING

### UTBK-Specific Features:
1. **Stage System:** Multiple tryout stages dengan progression tracking
2. **Target Campus/Major:** Personalized goal setting
3. **Best Score Tracking:** Across all attempts
4. **Readiness Indicators:** "Perlu Penguatan" → "Data Lengkap"
5. **Subject Label Formatting:** FormatUtbkSubjectLabel utility

---

## 📝 CATATAN ARSITEKTUR

### Client Components:
- Semua component utama adalah `"use client"` (Next.js client components)
- React hooks untuk state management
- Suspense boundaries di beberapa halaman

### Authentication:
- `withStoredAuthHeader()` helper untuk auth headers
- Session validation pada API calls
- Clear auth state on 401 responses

### Refresh Mechanism:
- `subscribeStudentDashboardRefresh()` for real-time updates
- Token-based reload pattern (`reloadToken`)

### Error Handling:
- Graceful error states dengan retry buttons
- User-friendly error messages
- Console logging for debugging

---

## 🔗 RELATIONSHIP MAP

```
Dashboard Siswa
├── Learning Shell (Layout wrapper)
│   ├── Learning Nav (Materi | Latihan/Tryout tabs)
│   └── Page Content
│
├── Materi Flow
│   ├── MateriSiswaPageView (list)
│   │   └── Open dialog → Detail
│   │       └── Update progress API
│
├── Latihan Flow
│   ├── LatihanSiswaPageView (list)
│   │   ├── Click task → Confirm dialog
│   │   │   └── Start CBT API
│   │   │       └── ActiveLatihanPageView (interface)
│   │   │           ├── View questions
│   │   │           ├── Answer navigation
│   │   │           └── Submit API
│   │   └── Show status badges
│
├── Tryout Flow
│   ├── TryoutSiswaPageView (list)
│   │   ├── Select tryout → Start
│   │   │   └── ActiveTryoutPageView (interface)
│   │   │       ├── Full CBT engine
│   │   │       ├── Timer system
│   │   │       ├── Grid navigator
│   │   │       └── Results post-submission
│   │   └── Score tracking
│
├── Grades Display
│   ├── NilaiSiswaPageView
│   │   ├── UTBK score card
│   │   ├── Stage progress
│   │   └── Readiness indicator
│
└── History
    ├── RiwayatAkademikSiswaPageView
│       ├── Subscription list
│       └── Detail panel per period
```

---

## 📊 SUMMARY METRICS

- **Total .tsx files in dashboard-siswa:** 41 files
- **CBT-related pages:** 4 primary pages
- **Widgets:** 2 UTBK-specific + general widgets
- **Sections:** 4 section components
- **Data hooks:** 2 custom hooks
- **API endpoints used:** ~12 unique endpoints
- **Type definitions:** 15+ types across files

---

*Audit completed as READ-ONLY exploration*
*Date: 2026-08-28*
*No code modifications made*
