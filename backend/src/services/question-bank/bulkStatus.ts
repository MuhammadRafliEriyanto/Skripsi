export type BulkQuestionBankStatus = "approved" | "rejected";

export type BulkQuestionBankStatusInput = {
  itemIds?: unknown;
  status?: unknown;
};

export function prepareBulkQuestionBankStatus(input: BulkQuestionBankStatusInput): {
  itemIds: string[];
  status: BulkQuestionBankStatus;
} {
  if (!Array.isArray(input.itemIds) || input.itemIds.length === 0) {
    throw new Error("Pilih minimal satu soal.");
  }
  if (input.itemIds.length > 100) {
    throw new Error("Maksimal 100 soal per aksi bulk.");
  }
  if (input.status !== "approved" && input.status !== "rejected") {
    throw new Error("Status bulk harus approved atau rejected.");
  }
  const itemIds = [...new Set(input.itemIds.map((itemId) => typeof itemId === "string" ? itemId.trim() : ""))];
  if (itemIds.some((itemId) => !itemId)) {
    throw new Error("ID soal tidak valid.");
  }
  return { itemIds, status: input.status };
}
