require("dotenv").config({ path: "backend/.env" });

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");

const outputPath = path.resolve(__dirname, "../../..", "docs", "audit-student-major-sma.md");
const jsonPath = path.resolve(__dirname, "../../..", "docs", "audit-student-major-sma.json");

const academicFields = ["studentId", "class", "className", "grade", "gradeLevel", "program", "major", "jurusan", "peminatan", "specialization", "department", "academicClass", "schoolClass", "utbkTrack", "targetJurusan"];
function text(value) { return String(value ?? "").trim().replace(/\s+/g, " "); }
function norm(value) { return text(value).toLowerCase(); }
function clean(value) { return text(value).replaceAll("|", "\\|").replaceAll("\n", " "); }
function countAnswers(attempt) { return Array.isArray(attempt.answers) ? attempt.answers.length : 0; }
function source(id, classById, bankById, bankObjectById) { const key = text(id); if (classById.has(key)) return "ClassTaskQuestion"; if (bankById.has(key)) return "QuestionBank.questionId"; if (bankObjectById.has(key)) return "QuestionBank._id"; return "NOT_FOUND"; }
function classGroup(student) { const value = norm(student.className || student.class || student.academicClass || student.schoolClass); if (value === "sma 10") return "SMA 10"; if (value === "sma 12") return "SMA 12"; return null; }
function publicStudent(student) { const result = {}; for (const field of academicFields) if (Object.prototype.hasOwnProperty.call(student, field)) result[field] = student[field]; return result; }
function isP1P9(task) { return /p[1-9]/i.test(`${task?.taskId || ""} ${task?.title || ""}`); }

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const [students, tasks, attempts, classQuestions, banks] = await Promise.all([
    db.collection("students").find({}).toArray(),
    db.collection("classtasks").find({}).toArray(),
    db.collection("studenttaskattempts").find({}).toArray(),
    db.collection("classtaskquestions").find({}).project({ questionId: 1, taskId: 1 }).toArray(),
    db.collection("questionbanks").find({}).project({ questionId: 1, _id: 1, program: 1, subject: 1, topic: 1 }).toArray(),
  ]);
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));
  const classById = new Map(classQuestions.map((question) => [text(question.questionId), question]));
  const bankById = new Map(banks.map((question) => [text(question.questionId), question]));
  const bankObjectById = new Map(banks.map((question) => [text(question._id), question]));
  const smaStudents = students.filter((student) => classGroup(student));
  const samples = { "SMA 10": smaStudents.filter((student) => classGroup(student) === "SMA 10").slice(0, 10), "SMA 12": smaStudents.filter((student) => classGroup(student) === "SMA 12").slice(0, 10) };
  const relevantFields = [...new Set(students.flatMap((student) => academicFields.filter((field) => Object.prototype.hasOwnProperty.call(student, field))))];
  const majorValues = {};
  for (const student of smaStudents) {
    const values = [student.major, student.jurusan, student.peminatan, student.specialization, student.department, student.targetJurusan].map(text).filter(Boolean);
    const key = values.join(" / ") || "NO_MAJOR";
    majorValues[key] = (majorValues[key] || 0) + 1;
  }
  const studentTrace = [];
  for (const student of smaStudents) {
    const group = classGroup(student);
    const studentAttempts = attempts.filter((attempt) => attempt.studentId === student.studentId && countAnswers(attempt) === 30);
    for (const attempt of studentAttempts) {
      const task = taskById.get(attempt.taskId);
      const sources = (attempt.answers || []).map((answer) => source(answer.questionId, classById, bankById, bankObjectById));
      const bankQuestions = (attempt.answers || []).map((answer) => bankById.get(text(answer.questionId)) || bankObjectById.get(text(answer.questionId))).filter(Boolean);
      const isExactPartial = sources.slice(0, 10).every((value) => value === "ClassTaskQuestion") && sources.slice(10).every((value) => value.startsWith("QuestionBank"));
      studentTrace.push({ studentId: student.studentId, group, taskId: attempt.taskId, className: student.className, taskSubject: task?.subject || null, meetingNumber: task?.meetingNumber ?? null, attemptId: attempt.attemptId, attemptType: Number(attempt.remedialCount || 0) > 0 || (attempt.history || []).length ? "remedial_or_has_history" : "utama_or_unspecified", exactPartialPattern: isExactPartial, sourceCounts: sources.reduce((map, value) => { map[value] = (map[value] || 0) + 1; return map; }, {}), questionBankPrograms: [...new Set(bankQuestions.map((question) => question.program).filter(Boolean))], questionBankSubjects: [...new Set(bankQuestions.map((question) => question.subject).filter(Boolean))], questionBankTopics: [...new Set(bankQuestions.map((question) => question.topic).filter(Boolean))] });
    }
  }
  const groupRows = ["SMA 10", "SMA 12"].flatMap((group) => {
    const rows = studentTrace.filter((row) => row.group === group && row.exactPartialPattern);
    const programs = [...new Set(rows.flatMap((row) => row.questionBankPrograms))];
    return programs.length ? programs.map((program) => ({ studentGroup: group, qbProgram: program, attempts: rows.filter((row) => row.questionBankPrograms.includes(program)).length, evidence: "exact 10 ClassTaskQuestion + 20 QuestionBank" })) : [{ studentGroup: group, qbProgram: "NO_QUESTIONBANK_SOURCE", attempts: rows.length, evidence: "Tidak ada program QuestionBank teridentifikasi" }];
  });
  const studentsWithoutMajor = smaStudents.filter((student) => ![student.major, student.jurusan, student.peminatan, student.specialization, student.department, student.targetJurusan].some((value) => text(value))).map(publicStudent);
  const programMajorMap = {};
  for (const student of smaStudents) {
    const group = classGroup(student);
    const values = [student.major, student.jurusan, student.peminatan, student.specialization, student.department, student.targetJurusan].map(text).filter(Boolean);
    const major = values.join(" / ") || "NO_MAJOR";
    programMajorMap[group] ||= {};
    programMajorMap[group][major] = (programMajorMap[group][major] || 0) + 1;
  }
  const output = { readOnly: true, generatedAt: new Date().toISOString(), database: { students: students.length, smaStudents: smaStudents.length, tasks: tasks.length, attempts: attempts.length, attempts30: attempts.filter((attempt) => countAnswers(attempt) === 30).length, questionbanks: banks.length }, relevantFields, samples: Object.fromEntries(Object.entries(samples).map(([key, value]) => [key, value.map(publicStudent)])), majorValues, programMajorMap, studentTrace, groupRows, studentsWithoutMajor, mappingStatus: Object.fromEntries(["SMA 10", "SMA 12"].map((group) => [group, Object.keys(programMajorMap[group] || {}).some((key) => key !== "NO_MAJOR") ? "MAPPING_NOT_PROVEN" : "MAJOR_NOT_STORED"])), noDatabaseMutation: true };
  await fs.writeFile(jsonPath, JSON.stringify(output, null, 2), "utf8");
  await fs.writeFile(outputPath, buildMarkdown(output), "utf8");
  console.log(JSON.stringify({ mdPath: outputPath, jsonPath, database: output.database, relevantFields, samples: Object.fromEntries(Object.entries(samples).map(([key, value]) => [key, value.length])), majorValues, programMajorMap, traceRows: studentTrace.length, exactPartialTraceRows: studentTrace.filter((row) => row.exactPartialPattern).length, groupRows, studentsWithoutMajor: studentsWithoutMajor.length, mappingStatus: output.mappingStatus }, null, 2));
  await mongoose.disconnect();
}

function buildMarkdown(output) {
  const lines = ["# Audit Student Major SMA (Read-Only)", "", `Generated: ${output.generatedAt}`, "", "> READ-ONLY: tidak ada perubahan database, attempt, answers, score, QuestionBank, atau ClassTaskQuestion.", "", "## 1. Ringkasan", "", `- Total siswa: **${output.database.students}**`, `- Siswa SMA 10/12: **${output.database.smaStudents}**`, `- Total task: **${output.database.tasks}**`, `- Total attempt: **${output.database.attempts}**`, `- Attempt 30 soal: **${output.database.attempts30}**`, `- QuestionBank: **${output.database.questionbanks}**`, "", "## 2. Field Siswa Aktual", "", `Field akademik yang benar-benar ditemukan: ${output.relevantFields.map((field) => `\`${field}\``).join(", ") || "tidak ada"}.`, "", "## 3. Sample Siswa SMA 10", "", "| studentId | className | program | major | jurusan | peminatan | field relevan |", "| --- | --- | --- | --- | --- | --- | --- |", ...output.samples["SMA 10"].map((student) => `| ${clean(student.studentId)} | ${clean(student.className || student.class || "-")} | ${clean(student.program || "-")} | ${clean(student.major || "-")} | ${clean(student.jurusan || "-")} | ${clean(student.peminatan || "-")} | ${clean(JSON.stringify(student))} |`), "", "## 4. Sample Siswa SMA 12", "", "| studentId | className | program | major | jurusan | peminatan | field relevan |", "| --- | --- | --- | --- | --- | --- | --- |", ...output.samples["SMA 12"].map((student) => `| ${clean(student.studentId)} | ${clean(student.className || student.class || "-")} | ${clean(student.program || "-")} | ${clean(student.major || "-")} | ${clean(student.jurusan || "-")} | ${clean(student.peminatan || "-")} | ${clean(JSON.stringify(student))} |`), "", "## 5. Distribusi Jurusan/Program", "", ...Object.entries(output.majorValues).map(([key, count]) => `- ${clean(key)}: **${count}**`), "", "### Distribusi per Kelas", "", ...Object.entries(output.programMajorMap).flatMap(([group, values]) => [`- **${group}**`, ...Object.entries(values).map(([key, count]) => `  - ${clean(key)}: **${count}**`)]), "", "## 6. Trace Student ke Task dan Attempt", "", "| studentId | className | taskId | subject | meeting | attemptId | tipe | pola 10+20 | source | QB program | QB subject |", "| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |", ...output.studentTrace.slice(0, 300).map((row) => `| ${clean(row.studentId)} | ${clean(row.className)} | ${clean(row.taskId)} | ${clean(row.taskSubject)} | ${row.meetingNumber ?? "-"} | ${clean(row.attemptId)} | ${row.attemptType} | ${row.exactPartialPattern ? "Ya" : "Tidak"} | ${clean(JSON.stringify(row.sourceCounts))} | ${clean(row.questionBankPrograms.join(", ") || "-")} | ${clean(row.questionBankSubjects.join(", ") || "-")} |`), "", "## 7. Evidence Mapping Group", "", "| Student Group | QB Program | Attempt | Evidence |", "| --- | --- | ---: | --- |", ...output.groupRows.map((row) => `| ${row.studentGroup} | ${clean(row.qbProgram)} | ${row.attempts} | ${row.evidence} |`), "", "## 8. Status Mapping", "", ...Object.entries(output.mappingStatus).map(([group, status]) => `- ${group}: **${status}**`), "", "## 9. Siswa Tanpa Jurusan", "", `Jumlah siswa SMA tanpa informasi jurusan/peminatan: **${output.studentsWithoutMajor.length}**.`, "", "## 10. Kesimpulan", "", "Database hanya menyimpan pembeda kelas/program umum yang ditemukan pada field siswa. Mapping IPA/IPS hanya dapat dinyatakan bila field jurusan/peminatan aktual berisi IPA atau IPS dan konsisten dengan program QuestionBank pada attempt siswa.", "", "- Tidak ada mapping final yang dipilih.", "- Attempt utama dan remedial tidak digabungkan.", "- Tidak ada data sensitif yang ditulis ke laporan.", "", "## Keamanan", "", "Audit hanya melakukan operasi baca dan menulis laporan lokal."];
  return `${lines.join("\n")}\n`;
}

main().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });
