import assert from "node:assert/strict";
import test from "node:test";

import { createQuestionId } from "./questionId";

test("creates unique admin question IDs", () => {
  const ids = new Set(Array.from({ length: 100 }, () => createQuestionId("QB-ADM")));
  assert.equal(ids.size, 100);
  assert.match([...ids][0], /^QB-ADM-[0-9A-F]{12}$/);
});

test("normalizes an unsafe prefix", () => {
  assert.match(createQuestionId(" qb pdf! "), /^QB-PDF-[0-9A-F]{12}$/);
});
