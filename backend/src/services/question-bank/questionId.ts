import { randomBytes } from "node:crypto";

export function createQuestionId(prefix: string): string {
  const normalizedPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "QB";
  return `${normalizedPrefix}-${randomBytes(6).toString("hex").toUpperCase()}`;
}
