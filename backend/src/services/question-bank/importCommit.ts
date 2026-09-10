import { createQuestionId } from "./questionId";
import { normalizeQuestionDraft, questionFingerprint, type QuestionDraft } from "./questionDraft";

export type ImportActor = { id: string; name: string };
export type ImportCommitInput = {
  rowNumber: number;
  pageNumber?: number;
  draft: Record<string, unknown>;
  source: "excel" | "pdf";
  fileName: string;
  imageDataUri?: string;
};

export type PreparedQuestionDocument = QuestionDraft & {
  questionId: string;
  status: "review";
  bankScope: "global";
  createdBy: string;
  createdByName: string;
  fingerprint: string;
  explanationSource: "manual";
  source: {
    kind: "excel" | "pdf";
    fileName: string;
    rowNumber: number;
    pageNumber?: number;
  };
  imageDataUri?: string;
};

export type ImportPreparation = {
  documents: PreparedQuestionDocument[];
  skipped: Array<{ rowNumber: number; reason: string }>;
  failed: Array<{ rowNumber: number; reason: string }>;
};

export function prepareQuestionImport(
  items: ImportCommitInput[],
  actor: ImportActor,
  existingFingerprints: Set<string>,
): ImportPreparation {
  const documents: PreparedQuestionDocument[] = [];
  const skipped: ImportPreparation["skipped"] = [];
  const failed: ImportPreparation["failed"] = [];
  const accepted = new Set<string>();

  for (const item of items) {
    const result = normalizeQuestionDraft(item.draft, { requireExplanation: true });
    if (!result.ok) {
      failed.push({ rowNumber: item.rowNumber, reason: result.errors.map((error) => error.message).join(" ") });
      continue;
    }
    const fingerprint = questionFingerprint(result.value);
    if (existingFingerprints.has(fingerprint) || accepted.has(fingerprint)) {
      skipped.push({ rowNumber: item.rowNumber, reason: "Soal duplikat sudah ada di bank soal." });
      continue;
    }
    accepted.add(fingerprint);
    documents.push({
      ...result.value,
      questionId: createQuestionId(item.source === "pdf" ? "QB-PDF" : "QB-XLS"),
      status: "review",
      bankScope: "global",
      createdBy: actor.id,
      createdByName: actor.name,
      fingerprint,
      explanationSource: "manual",
      source: {
        kind: item.source,
        fileName: item.fileName,
        rowNumber: item.rowNumber,
        ...(item.pageNumber === undefined ? {} : { pageNumber: item.pageNumber }),
      },
      ...(item.imageDataUri ? { imageDataUri: item.imageDataUri } : {}),
    });
  }

  return { documents, skipped, failed };
}
