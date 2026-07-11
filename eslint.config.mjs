import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "backend/dist/**",
    // Non-runtime utility/migration scripts and generated test artifacts are
    // excluded to avoid changing operational behavior during lint cleanup.
    "backend/*.js",
    "backend/*.ts",
    "backend/src/scripts/**",
    "output/**",
    "test-results/**",
    "tests/**",
    "*.js",
    "original_chatbot.tsx",
  ]),
]);

export default eslintConfig;
