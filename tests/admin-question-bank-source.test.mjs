import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePath = new URL("../src/components/dashboard-admin/AdminQuestionBank.tsx", import.meta.url);
const typesPath = new URL("../src/components/dashboard-admin/question-bank/types.ts", import.meta.url);
const catalogPath = new URL("../src/components/dashboard-admin/question-bank/catalog.ts", import.meta.url);
const importDialogPath = new URL("../src/components/dashboard-admin/question-bank/QuestionImportDialog.tsx", import.meta.url);
const editorDialogPath = new URL("../src/components/dashboard-admin/question-bank/QuestionEditorDialog.tsx", import.meta.url);
const adminQuestionBankPath = new URL("../src/components/dashboard-admin/AdminQuestionBank.tsx", import.meta.url);
const excelImportPath = new URL("../backend/src/services/question-bank/excelImport.ts", import.meta.url);
const adminControllerPath = new URL("../backend/src/controllers/adminQuestionBankController.ts", import.meta.url);

test("admin question bank exposes manual, Excel, and PDF actions", async () => {
  const source = await readFile(sourcePath, "utf8");
  const types = await readFile(typesPath, "utf8");
  assert.match(source, />Tambah soal</);
  assert.match(source, />Import Excel</);
  assert.match(source, />Import PDF</);
  assert.match(types, /topic: "Umum"/);
});

test("question forms share every school grade and a subject catalog", async () => {
  const [catalog, importDialog, editorDialog] = await Promise.all([
    readFile(catalogPath, "utf8"),
    readFile(importDialogPath, "utf8"),
    readFile(editorDialogPath, "utf8"),
  ]);

  for (const grade of ["SD 1", "SD 6", "SMP 7", "SMP 9", "SMA 10", "SMA 12"]) {
    assert.match(catalog, new RegExp(`"${grade}"`));
  }
  for (const subject of ["Matematika", "Bahasa Indonesia", "IPA", "Fisika", "Kimia", "Biologi"]) {
    assert.match(catalog, new RegExp(`"${subject}"`));
  }
  assert.match(catalog, /QUESTION_ALL_SUBJECT_OPTIONS/);
  assert.match(catalog, /"Semua Mapel"/);
  assert.match(importDialog, /QUESTION_ALL_SUBJECT_OPTIONS/);
  assert.match(editorDialog, /QUESTION_ALL_SUBJECT_OPTIONS/);
  assert.match(importDialog, /QUESTION_CLASS_OPTIONS/);
  assert.match(editorDialog, /QUESTION_CLASS_OPTIONS/);
});

test("Excel imports can take subject metadata from the workbook", async () => {
  const importDialog = await readFile(importDialogPath, "utf8");
  assert.match(importDialog, /mode === "pdf" && !meta\.subject/);
  assert.match(importDialog, /mode === "excel" \? "Otomatis dari Excel"/);
});

test("admin question bank exposes bulk status actions", async () => {
  const source = await readFile(adminQuestionBankPath, "utf8");
  assert.match(source, /bulk-status/);
  assert.match(source, /Setujui dipilih/);
  assert.match(source, /Tolak dipilih/);
  assert.match(source, /type="checkbox"/);
});

test("question imports use the 5,000 row limit consistently", async () => {
  const [excelImport, controller, importDialog] = await Promise.all([
    readFile(excelImportPath, "utf8"),
    readFile(adminControllerPath, "utf8"),
    readFile(importDialogPath, "utf8"),
  ]);
  assert.match(excelImport, /maxRows \?\? 5_000/);
  assert.match(controller, /rawItems\.length > 5_000/);
  assert.match(importDialog, /5\.000 baris/);
});
