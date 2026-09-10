import assert from "node:assert/strict";
import test from "node:test";

import { prepareBulkQuestionBankStatus } from "./bulkStatus";

test("prepares a deduplicated bulk status request", () => {
  assert.deepEqual(
    prepareBulkQuestionBankStatus({ itemIds: ["a", "a", "b"], status: "approved" }),
    { itemIds: ["a", "b"], status: "approved" },
  );
});

test("rejects unsupported bulk statuses and empty selections", () => {
  assert.throws(() => prepareBulkQuestionBankStatus({ itemIds: [], status: "draft" }), /minimal satu/i);
  assert.throws(() => prepareBulkQuestionBankStatus({ itemIds: ["a"], status: "draft" }), /approved atau rejected/i);
});

test("rejects malformed item ids", () => {
  assert.throws(() => prepareBulkQuestionBankStatus({ itemIds: [""], status: "rejected" }), /ID soal tidak valid/i);
});
