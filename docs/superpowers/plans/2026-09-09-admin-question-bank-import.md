# Admin Question Bank Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build admin-owned manual question entry and review-first Excel/PDF import with images, default topic `Umum`, validation, and optional generated explanations.

**Architecture:** Keep canonical validation and import normalization in focused backend services consumed by the admin controller. Excel parsing runs in Express; PDF parsing is accessed through a configurable HTTP adapter so manual and Excel flows do not depend on the OCR runtime. The Next.js layer only proxies authenticated requests and the admin component owns the upload/preview/edit/confirm experience.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, Express 4.21, Mongoose 8.18, TypeScript 5.9, SheetJS `xlsx` 0.18.5, Cloudinary 2.11, Marker PDF service, Playwright 1.61.

**Spec:** `docs/superpowers/specs/2026-09-09-admin-question-bank-import-design.md`

## Global Constraints

- Preserve the existing `QuestionBankItem` V6 `options` object.
- Manual admin items use `status: "approved"` and `bankScope: "global"`.
- Imported items use `status: "review"` and `bankScope: "global"`.
- Missing topics normalize to `Umum`.
- Never infer an ambiguous PDF answer; return a validation error for correction.
- Do not trust client-supplied status, creator identity, scope, image public ID, or review metadata.
- Existing unrelated working-tree changes belong to the user and must not be modified.
- PDF runtime failure must not break manual entry or Excel import.

---

### Task 1: Canonical Question Draft Validation

**Files:**
- Create: `backend/src/services/question-bank/questionDraft.ts`
- Create: `backend/src/services/question-bank/questionDraft.test.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `normalizeQuestionDraft(input, defaults): QuestionDraftResult`
- Produces: `questionFingerprint(draft): string`
- Produces: `QuestionDraft`, `QuestionDraftDefaults`, and `QuestionDraftError` types.

- [ ] **Step 1: Add a backend test command**

Add to `backend/package.json` scripts:

```json
"test": "node --import tsx --test src/**/*.test.ts"
```

- [ ] **Step 2: Write failing normalization tests**

Cover default topic, whitespace trimming, answer uppercasing, nested and flat option formats, invalid program/class/answer/difficulty, missing option, and stable fingerprints:

```ts
test("defaults an empty topic to Umum", () => {
  const result = normalizeQuestionDraft(validInput({ topic: "" }), {});
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.topic, "Umum");
});

test("rejects an invalid answer", () => {
  const result = normalizeQuestionDraft(validInput({ correctAnswer: "E" }), {});
  assert.deepEqual(result, { ok: false, errors: [{ field: "correctAnswer", message: "Kunci jawaban harus A, B, C, atau D." }] });
});
```

- [ ] **Step 3: Run the focused test and confirm failure**

Run: `npm --prefix backend test -- questionDraft.test.ts`

Expected: FAIL because `questionDraft.ts` does not exist.

- [ ] **Step 4: Implement canonical normalization**

Use explicit result types and a program/class check:

```ts
export type QuestionDraftResult =
  | { ok: true; value: QuestionDraft }
  | { ok: false; errors: QuestionDraftError[] };

export function normalizeQuestionDraft(
  input: Record<string, unknown>,
  defaults: QuestionDraftDefaults = {},
): QuestionDraftResult {
  // Normalize strings and options, apply topic/difficulty defaults,
  // validate required fields, then return a typed value or field errors.
}
```

Implement `questionFingerprint` with normalized lowercase text and `node:crypto` SHA-256 across program, class, subject, question, and A-D options.

- [ ] **Step 5: Run backend tests**

Run: `npm --prefix backend test`

Expected: all tests PASS.

- [ ] **Step 6: Commit the validator**

```bash
git add backend/package.json backend/src/services/question-bank/questionDraft.ts backend/src/services/question-bank/questionDraft.test.ts
git commit -m "feat(question-bank): add canonical draft validation"
```

---

### Task 2: Admin Manual CRUD

**Files:**
- Create: `backend/src/services/question-bank/questionId.ts`
- Create: `backend/src/services/question-bank/questionId.test.ts`
- Modify: `backend/src/controllers/adminQuestionBankController.ts`
- Modify: `backend/src/routes/adminQuestionBankRoutes.ts`
- Modify: `src/app/api/admin/question-bank/route.ts`
- Create: `src/app/api/admin/question-bank/[itemId]/route.ts`

**Interfaces:**
- Consumes: `normalizeQuestionDraft()` from Task 1.
- Produces: `POST /api/admin/question-bank`, `PATCH /api/admin/question-bank/:itemId`, and `DELETE /api/admin/question-bank/:itemId`.
- Produces: `createQuestionId(prefix: string): string`.

- [ ] **Step 1: Write failing ID tests**

```ts
test("creates unique admin question IDs", () => {
  const ids = new Set(Array.from({ length: 100 }, () => createQuestionId("QB-ADM")));
  assert.equal(ids.size, 100);
  assert.match([...ids][0], /^QB-ADM-/);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm --prefix backend test -- questionId.test.ts`

Expected: FAIL because `questionId.ts` does not exist.

- [ ] **Step 3: Implement IDs and admin handlers**

Use `crypto.randomUUID()` for IDs. Create handlers that always overwrite protected values:

```ts
const item = await QuestionBankItem.create({
  ...draft,
  questionId: createQuestionId("QB-ADM"),
  status: "approved",
  bankScope: "global",
  createdBy: req.user?._id.toString(),
  createdByName: req.user?.nama ?? "Admin",
  reviewedBy: req.user?._id.toString(),
  reviewedAt: new Date(),
});
```

PATCH revalidates the merged persisted item plus allowed changes. DELETE archives rather than physically deleting.

- [ ] **Step 4: Add Express and Next.js routes**

Register route methods under the existing admin authentication middleware. Proxy request bodies with `readRequestBody()` and encode `itemId`.

- [ ] **Step 5: Run type checks**

Run: `npm --prefix backend run build`

Run: `npx tsc --noEmit`

Expected: both PASS.

- [ ] **Step 6: Commit manual CRUD**

```bash
git add backend/src/services/question-bank/questionId.ts backend/src/services/question-bank/questionId.test.ts backend/src/controllers/adminQuestionBankController.ts backend/src/routes/adminQuestionBankRoutes.ts src/app/api/admin/question-bank/route.ts src/app/api/admin/question-bank/[itemId]/route.ts
git commit -m "feat(question-bank): add admin manual question CRUD"
```

---

### Task 3: Excel Template and Preview Parser

**Files:**
- Create: `backend/src/services/question-bank/excelImport.ts`
- Create: `backend/src/services/question-bank/excelImport.test.ts`
- Create: `backend/src/services/question-bank/importTypes.ts`
- Modify: `backend/src/controllers/adminQuestionBankController.ts`
- Modify: `backend/src/routes/adminQuestionBankRoutes.ts`
- Create: `src/app/api/admin/question-bank/import/template/route.ts`
- Create: `src/app/api/admin/question-bank/import/excel/preview/route.ts`

**Interfaces:**
- Consumes: `normalizeQuestionDraft()` and `questionFingerprint()` from Task 1.
- Produces: `createQuestionBankTemplate(): Buffer`.
- Produces: `parseQuestionWorkbook(buffer, defaults): ImportPreviewItem[]`.
- Produces: `POST /api/admin/question-bank/import/excel/preview` and `GET /api/admin/question-bank/import/template`.

- [ ] **Step 1: Define preview types**

```ts
export type ImportPreviewItem = {
  rowNumber: number;
  selected: boolean;
  draft: Partial<QuestionDraft>;
  fingerprint: string;
  errors: QuestionDraftError[];
  warnings: string[];
  duplicate: "none" | "file" | "database";
  imageDataUri?: string;
};
```

- [ ] **Step 2: Write failing workbook tests**

Generate buffers in memory with SheetJS and cover canonical headers, Indonesian aliases, blank topic, blank explanation warning, invalid rows retained in preview, duplicate rows, and maximum row count.

```ts
test("keeps invalid rows for correction", () => {
  const items = parseQuestionWorkbook(workbook([{ soal: "2 + 2?", A: "3" }]), defaults);
  assert.equal(items[0].selected, false);
  assert.ok(items[0].errors.some((error) => error.field === "options.B"));
});
```

- [ ] **Step 3: Run the focused test and confirm failure**

Run: `npm --prefix backend test -- excelImport.test.ts`

Expected: FAIL because the parser does not exist.

- [ ] **Step 4: Implement the parser and template**

Accept only the documented aliases. Limit decoded uploads to 10 MB and sheets to 2,000 data rows. Do not accept embedded workbook images in version one; validate `imageUrl` as HTTPS.

Template columns must be exactly:

```ts
const TEMPLATE_HEADERS = [
  "program", "className", "subject", "topic", "questionText",
  "optionA", "optionB", "optionC", "optionD", "correctAnswer",
  "explanation", "difficulty", "imageUrl",
] as const;
```

- [ ] **Step 5: Add preview endpoints**

The preview endpoint accepts base64 workbook content and upload defaults, checks fingerprints against MongoDB, and returns items without writing questions.

- [ ] **Step 6: Run tests and builds**

Run: `npm --prefix backend test`

Run: `npm --prefix backend run build`

Expected: both PASS.

- [ ] **Step 7: Commit Excel preview**

```bash
git add backend/src/services/question-bank/importTypes.ts backend/src/services/question-bank/excelImport.ts backend/src/services/question-bank/excelImport.test.ts backend/src/controllers/adminQuestionBankController.ts backend/src/routes/adminQuestionBankRoutes.ts src/app/api/admin/question-bank/import
git commit -m "feat(question-bank): add Excel template and import preview"
```

---

### Task 4: Import Confirmation and Duplicate Safety

**Files:**
- Create: `backend/src/services/question-bank/importCommit.ts`
- Create: `backend/src/services/question-bank/importCommit.test.ts`
- Modify: `backend/src/models/QuestionBankItem.ts`
- Modify: `backend/src/controllers/adminQuestionBankController.ts`
- Modify: `backend/src/routes/adminQuestionBankRoutes.ts`
- Create: `src/app/api/admin/question-bank/import/confirm/route.ts`

**Interfaces:**
- Consumes: validated `QuestionDraft` and fingerprints.
- Produces: `commitQuestionImport(input, actor): ImportCommitSummary`.
- Produces: `POST /api/admin/question-bank/import/confirm`.

- [ ] **Step 1: Write failing commit-service tests**

Test that invalid items are rejected, duplicate fingerprints are skipped, client-supplied protected properties are discarded, topic defaults to `Umum`, and valid items receive `review/global` metadata.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm --prefix backend test -- importCommit.test.ts`

Expected: FAIL because `importCommit.ts` does not exist.

- [ ] **Step 3: Extend the model compatibly**

Add optional fields:

```ts
source?: { kind: "manual" | "excel" | "pdf"; fileName?: string; rowNumber?: number; pageNumber?: number };
fingerprint?: string;
explanationSource?: "manual" | "ai";
```

Add a sparse index on `fingerprint`; do not make it globally unique until existing data is audited.

- [ ] **Step 4: Implement revalidation and bulk insertion**

Re-run canonical validation on confirm, query existing fingerprints in one request, upload any trusted server-produced image data, and insert valid nonduplicates. Return counts for created, skipped, and failed items with per-row messages.

- [ ] **Step 5: Run tests and backend build**

Run: `npm --prefix backend test`

Run: `npm --prefix backend run build`

Expected: both PASS.

- [ ] **Step 6: Commit confirmation flow**

```bash
git add backend/src/services/question-bank/importCommit.ts backend/src/services/question-bank/importCommit.test.ts backend/src/models/QuestionBankItem.ts backend/src/controllers/adminQuestionBankController.ts backend/src/routes/adminQuestionBankRoutes.ts src/app/api/admin/question-bank/import/confirm/route.ts
git commit -m "feat(question-bank): commit reviewed imports safely"
```

---

### Task 5: PDF Extraction Adapter and Marker Service

**Files:**
- Create: `backend/src/services/question-bank/pdfExtractor.ts`
- Create: `backend/src/services/question-bank/pdfExtractor.test.ts`
- Create: `services/marker/requirements.txt`
- Create: `services/marker/app.py`
- Create: `services/marker/extractor.py`
- Create: `services/marker/tests/test_extractor.py`
- Modify: `backend/src/config/env.ts`
- Modify: `backend/src/controllers/adminQuestionBankController.ts`
- Modify: `backend/src/routes/adminQuestionBankRoutes.ts`
- Create: `src/app/api/admin/question-bank/import/pdf/preview/route.ts`
- Modify: `backend/README.md`

**Interfaces:**
- Produces: Python `POST /extract` accepting multipart PDF plus JSON defaults.
- Produces: `extractPdfPreview(input): Promise<ImportPreviewItem[]>` in Express.
- Produces: `POST /api/admin/question-bank/import/pdf/preview`.

- [ ] **Step 1: Write failing adapter tests**

Mock `fetch` and test successful normalization, timeout, non-2xx response, malformed payload, and disabled service when `MARKER_SERVICE_URL` is absent.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm --prefix backend test -- pdfExtractor.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the Express adapter**

Use `AbortSignal.timeout(120_000)`, a 25 MB decoded-file limit, and an explicit error message:

```ts
if (!env.MARKER_SERVICE_URL) {
  throw new AppError(503, "Layanan ekstraksi PDF belum dikonfigurasi.");
}
```

- [ ] **Step 4: Write failing Python fixture tests**

Create a minimal fixture PDF in test setup containing one question, A-D options, one blue option, and one image. Assert the extractor returns exactly one candidate answer and an image crop. Add a two-blue-options fixture and assert `correctAnswer` is empty with a warning.

- [ ] **Step 5: Implement the Marker extraction service**

Pin compatible Python 3.11 dependencies in `requirements.txt`, including `marker-pdf`, FastAPI, Uvicorn, PyMuPDF, and Pillow. Use Marker for document structure; use PyMuPDF spans to retain RGB color and rectangles. Associate image blocks with the nearest enclosing question range and return base64 PNG crops only for question-related figures.

- [ ] **Step 6: Run service and adapter tests**

Run: `python -m pytest services/marker/tests -q`

Run: `npm --prefix backend test -- pdfExtractor.test.ts`

Expected: both PASS when Python 3.11 and service dependencies are installed. If Python is unavailable, record the environment blocker and keep Tasks 1-4 independently passing.

- [ ] **Step 7: Add PDF preview route and documentation**

Document `MARKER_SERVICE_URL`, local service startup, CPU `--disable_ocr` limitations, and Marker inference backend prerequisites. The endpoint returns preview data and never writes questions.

- [ ] **Step 8: Commit PDF extraction**

```bash
git add services/marker backend/src/services/question-bank/pdfExtractor.ts backend/src/services/question-bank/pdfExtractor.test.ts backend/src/config/env.ts backend/src/controllers/adminQuestionBankController.ts backend/src/routes/adminQuestionBankRoutes.ts src/app/api/admin/question-bank/import/pdf/preview/route.ts backend/README.md
git commit -m "feat(question-bank): add PDF extraction preview"
```

---

### Task 6: Optional Explanation Generation

**Files:**
- Create: `backend/src/services/question-bank/explanationGenerator.ts`
- Create: `backend/src/services/question-bank/explanationGenerator.test.ts`
- Modify: `backend/src/config/env.ts`
- Modify: `backend/src/controllers/adminQuestionBankController.ts`
- Modify: `backend/src/routes/adminQuestionBankRoutes.ts`
- Create: `src/app/api/admin/question-bank/import/explanations/route.ts`

**Interfaces:**
- Produces: `generateExplanation(draft): Promise<string>`.
- Produces: `POST /api/admin/question-bank/import/explanations`.

- [ ] **Step 1: Write failing generator tests**

Mock the configured OpenAI-compatible endpoint. Verify the prompt contains the question, A-D options, and known answer; verify timeout and malformed responses return item-level warnings rather than destroying preview data.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm --prefix backend test -- explanationGenerator.test.ts`

Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Implement an opt-in provider adapter**

Read `QUESTION_EXPLANATION_API_URL`, `QUESTION_EXPLANATION_API_KEY`, and `QUESTION_EXPLANATION_MODEL` from the environment. Never expose the key to Next.js or persist it. Generate only when explanation is blank and the answer is valid.

- [ ] **Step 4: Add the endpoint and partial-failure response**

Limit one request to 25 questions. Return generated explanations keyed by preview row number plus warnings for failed rows.

- [ ] **Step 5: Run backend tests and build**

Run: `npm --prefix backend test`

Run: `npm --prefix backend run build`

Expected: both PASS.

- [ ] **Step 6: Commit explanation generation**

```bash
git add backend/src/services/question-bank/explanationGenerator.ts backend/src/services/question-bank/explanationGenerator.test.ts backend/src/config/env.ts backend/src/controllers/adminQuestionBankController.ts backend/src/routes/adminQuestionBankRoutes.ts src/app/api/admin/question-bank/import/explanations/route.ts
git commit -m "feat(question-bank): generate missing explanations"
```

---

### Task 7: Admin Manual and Import UI

**Files:**
- Create: `src/components/dashboard-admin/question-bank/types.ts`
- Create: `src/components/dashboard-admin/question-bank/QuestionEditorDialog.tsx`
- Create: `src/components/dashboard-admin/question-bank/QuestionImportDialog.tsx`
- Create: `src/components/dashboard-admin/question-bank/QuestionImportPreview.tsx`
- Modify: `src/components/dashboard-admin/AdminQuestionBank.tsx`
- Modify: `tests/blackbox-admin-evidence.spec.ts`

**Interfaces:**
- Consumes: admin CRUD, template, Excel/PDF preview, explanation, and confirm endpoints.
- Produces: accessible manual editor and two-step import UI.

- [ ] **Step 1: Add failing Playwright assertions**

Add an admin bank-soal scenario that expects `Tambah soal`, `Import Excel`, and `Import PDF` controls; opens the manual dialog; verifies default topic `Umum`; and verifies import cannot confirm an invalid preview row.

- [ ] **Step 2: Run the focused browser test and confirm failure**

Run: `npx playwright test tests/blackbox-admin-evidence.spec.ts --project=chromium --grep "bank soal"`

Expected: FAIL because the controls do not exist.

- [ ] **Step 3: Extract shared UI types and implement the manual dialog**

Reuse the guru field set but keep an admin-specific component. Include program, class, subject, topic defaulting to `Umum`, difficulty, question, A-D options, answer, explanation, and optional image preview. Display backend validation errors without closing the dialog.

- [ ] **Step 4: Implement import selection and preview**

The import dialog collects file, program, class, subject, and optional topic. Render row/page number, validation errors, warnings, duplicate state, editable question fields, answer selection, and extracted image. Disable confirm for selected rows with errors.

- [ ] **Step 5: Integrate controls with the existing table**

Refresh the list and statistics after create/update/archive/import. Keep existing approve/reject behavior. Add edit/archive actions to the detail dialog for admin-owned items.

- [ ] **Step 6: Run lint, type check, and browser test**

Run: `npm run lint`

Run: `npx tsc --noEmit`

Run: `npx playwright test tests/blackbox-admin-evidence.spec.ts --project=chromium --grep "bank soal"`

Expected: all PASS.

- [ ] **Step 7: Commit the admin UI**

```bash
git add src/components/dashboard-admin/question-bank src/components/dashboard-admin/AdminQuestionBank.tsx tests/blackbox-admin-evidence.spec.ts
git commit -m "feat(question-bank): add admin editor and import preview UI"
```

---

### Task 8: End-to-End Verification and Documentation

**Files:**
- Modify: `backend/README.md`
- Modify: `README.md`
- Modify: `tests/blackbox-admin-evidence.spec.ts`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified operator workflow and setup documentation.

- [ ] **Step 1: Add an end-to-end mocked import scenario**

Exercise Excel preview, correction, confirmation, list refresh, and approval detail. Mock only the external explanation/PDF services; keep application routes real.

- [ ] **Step 2: Add setup and limits documentation**

Document the template columns, 10 MB Excel limit, 25 MB PDF limit, 2,000-row limit, `Umum` default, image URL policy, environment variables, Marker startup, and review-first behavior.

- [ ] **Step 3: Run the complete verification suite**

Run: `npm --prefix backend test`

Run: `npm --prefix backend run build`

Run: `npm run lint`

Run: `npm run build`

Run: `npm run test:blackbox:admin`

Expected: all commands PASS. If the local Python runtime is unavailable, the Marker service test is reported separately and the HTTP adapter failure-state test must still pass.

- [ ] **Step 4: Review the working tree**

Run: `git status --short`

Run: `git diff --check`

Expected: no whitespace errors; only intended files are staged for this feature. Do not stage unrelated pre-existing changes.

- [ ] **Step 5: Commit verification and docs**

```bash
git add README.md backend/README.md tests/blackbox-admin-evidence.spec.ts
git commit -m "docs(question-bank): document and verify import workflow"
```
