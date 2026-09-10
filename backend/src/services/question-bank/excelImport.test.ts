import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import { createQuestionBankTemplate, parseQuestionWorkbook } from "./excelImport";

function workbook(rows: Record<string, unknown>[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  return XLSX.write({ SheetNames: ["Bank Soal"], Sheets: { "Bank Soal": sheet } }, { type: "buffer", bookType: "xlsx" });
}

const defaults = { program: "SD" as const, className: "SD 6", subject: "Matematika", topic: "Umum" };

test("parses Indonesian headers and applies upload defaults", () => {
  const [item] = parseQuestionWorkbook(workbook([{
    soal: "Hasil 1 + 1 adalah ...",
    "opsi A": "1",
    "opsi B": "2",
    "opsi C": "3",
    "opsi D": "4",
    kunci: "b",
    kesulitan: "Mudah",
  }]), defaults);
  assert.ok(item.errors.some((error) => error.field === "explanation"));
  assert.equal(item.selected, false);
  assert.equal(item.draft.topic, "Umum");
  assert.ok(item.warnings.includes("Pembahasan belum tersedia."));
});

test("normalizes curriculum labels and generic class names for every school level", () => {
  const items = parseQuestionWorkbook(workbook([
    { program: "Kurikulum Merdeka", className: "Kelas 1", subject: "Matematika", soal: "SD?", A: "1", B: "2", C: "3", D: "4", kunci: "A", explanation: "Jawaban A." },
    { program: "Kurikulum Merdeka", className: "Kelas 8", subject: "Matematika", soal: "SMP?", A: "1", B: "2", C: "3", D: "4", kunci: "A", explanation: "Jawaban A." },
    { program: "Kurikulum Merdeka", className: "Kelas 12", subject: "Matematika", soal: "SMA?", A: "1", B: "2", C: "3", D: "4", kunci: "A", explanation: "Jawaban A." },
  ]), { program: "SMP", className: "SMP 8", subject: "", topic: "Umum" });

  assert.deepEqual(items.map((item) => [item.draft.program, item.draft.className, item.selected]), [
    ["SD", "SD 1", true],
    ["SMP", "SMP 8", true],
    ["SMA", "SMA 12", true],
  ]);
});

test("keeps invalid rows for correction", () => {
  const [item] = parseQuestionWorkbook(workbook([{
    soal: "2 + 2?",
    A: "3",
    kunci: "B",
  }]), defaults);
  assert.equal(item.selected, false);
  assert.ok(item.errors.some((error) => error.field === "options.B"));
});

test("marks repeated rows in the same workbook as duplicates", () => {
  const row = {
    soal: "2 + 2?", A: "3", B: "4", C: "5", D: "6", kunci: "B", explanation: "Karena 2 + 2 = 4.",
  };
  const items = parseQuestionWorkbook(workbook([row, row]), defaults);
  assert.equal(items[0].duplicate, "none");
  assert.equal(items[1].duplicate, "file");
  assert.equal(items[1].selected, false);
});

test("rejects workbooks over the row limit", () => {
  const rows = Array.from({ length: 3 }, (_, index) => ({ soal: `Soal ${index + 1}` }));
  assert.throws(() => parseQuestionWorkbook(workbook(rows), defaults, { maxRows: 2 }), /maksimal 2 baris/i);
});

test("accepts workbooks with up to 5,000 rows", () => {
  const rows = Array.from({ length: 2_500 }, (_, index) => ({ soal: `Soal ${index + 1}` }));
  assert.equal(parseQuestionWorkbook(workbook(rows), defaults).length, 2_500);
});

test("creates a template with the documented headers", () => {
  const generated = XLSX.read(createQuestionBankTemplate(), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<string[]>(generated.Sheets[generated.SheetNames[0]], { header: 1 });
  assert.deepEqual(rows[0], [
    "program", "className", "subject", "topic", "questionText",
    "optionA", "optionB", "optionC", "optionD", "correctAnswer",
    "explanation", "difficulty", "imageUrl",
  ]);
});
