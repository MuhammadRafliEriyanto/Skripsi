const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix mapTeacherApiTaskToFormItem
const mapOld = `  return {
    id: taskId,
    kelasId: normalizeText(task.classId) || kelasId,
    pertemuanKe: Math.max(toSafeNumber(task.meetingNumber), 1),
    judulTugas: normalizeText(task.title),
    deskripsi: normalizeText(task.description),
    deadline: normalizeText(task.deadline),
    jumlahMengumpulkan: Math.max(toSafeNumber(task.submittedCount), 0),
    statusPenilaian: toTugasStatusPenilaian(task.reviewStatus),`;

const mapNew = `  return {
    id: taskId,
    kelasId: normalizeText(task.classId) || kelasId,
    pertemuanKe: Math.max(toSafeNumber(task.meetingNumber), 1),
    judulTugas: normalizeText(task.title),
    deskripsi: normalizeText(task.description),
    tanggalMulai: normalizeText(task.startAt) || normalizeText(task.deadline) || "",
    tanggalSelesai: normalizeText(task.endAt) || normalizeText(task.deadline) || "",
    durasiMenit: Math.max(toSafeNumber(task.durationMinutes), 1),
    jumlahMengumpulkan: Math.max(toSafeNumber(task.submittedCount), 0),
    statusPenilaian: toTugasStatusPenilaian(task.reviewStatus),`;

content = content.replace(mapOld, mapNew);

// 2. Fix saveTaskRequest
const saveOld = `    const body: Record<string, string | number | boolean> = {
      meetingNumber: draft.pertemuanKe,
      title: draft.judulTugas,
      description: draft.deskripsi,
      deadline: draft.deadline,
    };`;

const saveNew = `    const body: Record<string, string | number | boolean> = {
      meetingNumber: draft.pertemuanKe,
      title: draft.judulTugas,
      description: draft.deskripsi,
      deadline: draft.tanggalSelesai,
      startAt: draft.tanggalMulai,
      endAt: draft.tanggalSelesai,
      durationMinutes: draft.durasiMenit,
      questionCount: 10,
      passingGrade: 70,
    };`;

content = content.replace(saveOld, saveNew);

fs.writeFileSync(file, content);
console.log('Fixed DetailKelasGuruSection.tsx');
