<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:smartbimbel-instructions -->
# Smart Bimbel CBT System - AI Development Guidelines

## Project Overview
**Computer-Based Testing (CBT)** educational platform for Indonesian tutoring centers. Hybrid architecture with **Next.js 16 frontend** + **Express backend**, sharing single MongoDB database.

🔗 **Key Documentation**: See [`CBT_SYSTEM_INVENTORY.md`](./CBT_SYSTEM_INVENTORY.md) for complete system overview, [`FINAL-AUDIT-REPORT.md`](./FINAL-AUDIT-REPORT.md) for questionbank analysis.

---

## Quick Start Commands
```bash
npm run dev           # Concurrent frontend + backend development servers
npm run build         # Production build
npm run lint          # ESLint check
npm run test:blackbox:guru  # Test teacher workflow
```

---

## Architecture & Conventions

### File Structure
```
├── src/app/              # Next.js frontend (App Router)
├── src/lib/              # Frontend utilities (100% named exports)
├── backend/src/          # Express API layer
│   ├── controllers/      # Business logic (studentTaskCbtController, etc.)
│   ├── models/           # Mongoose schemas (25 TypeScript models)
│   └── routes/           # API endpoints
├── tests/                # Playwright E2E blackbox tests
└── *.js/*.mjs            # Audit/debug scripts (excluded from lint)
```

### Database Patterns

#### ✅ Mongoose Model Caching (MANDATORY)
```typescript
import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export interface IQuestionBank {
  questionId: string;
  program: string;
  subject: string;
  // ... other fields
}

const questionBankSchema = new Schema<IQuestionBank>({ /* schema */ });

// MUST use caching pattern to prevent overwrites
export const QuestionBank = models.QuestionBank ?? 
  model<IQuestionBank>("QuestionBank", questionBankSchema);
```

#### ✅ Enum First Approach
```typescript
export const QUESTION_BANK_ANSWERS = ["A", "B", "C", "D"] as const;
export type QuestionBankAnswer = (typeof QUESTION_BANK_ANSWERS)[number];

const schema = new Schema({
  correctAnswer: {
    type: String,
    enum: QUESTION_BANK_ANSWERS,
    required: [true, "Jawaban benar wajib diisi."]
  }
});
```

#### ❌ NEVER Hardcode MongoDB URIs
```typescript
// WRONG ⚠️
mongoose.connect("mongodb://localhost:27017/smartbimbel_dev");

// CORRECT ✅
mongoose.connect(process.env.MONGO_URI!);
```
See [`AUDIT-DATABASE-COMPLETE.md`](./AUDIT-DATABASE-COMPLETE.md) for security audit results.

---

### Code Quality Standards

#### Naming Conventions
| Type | Pattern | Example |
|------|---------|---------|
| Models/PascalCase | `Student.ts`, `Teacher.ts` | PascalCase.ts |
| Components | `Button.tsx`, `Card.tsx` | PascalCase |
| Utility functions | `fetchPayments()`, `formatCurrency()` | camelCase verbs |
| Audit/debug scripts | `fix_student.js`, `audit-security.js` | `verb-target.extension` |
| Constants | `AUTH_TOKEN_COOKIE_NAME` | SCREAMING_SNAKE_CASE |

#### Import Organization
```typescript
// Grouped imports with blank lines
import { X, Y } from "package";
import { Z } from "@/lib/utils";
import type { IUser } from "@/models/User";
```

#### Export Rules
- ✅ **100% Named Exports** - No default exports in lib files
- ✅ Explicit types: `export function getName(): string`
- ✅ Constants: `export const MAX_RETRY_ATTEMPTS = 3;`

---

### QuestionBank V6 Format (CRITICAL)

MongoDB stores questions in **V6 format** (`options[]` array) but TypeScript models use legacy fields (`optionA`, `optionB`, `optionC`, `optionD`).

**Compatibility Layer**: `backend/src/lib/question-option-compat.ts`
```typescript
import { createOriginalOptions } from "@/lib/question-option-compat";

const originalOptions = createOriginalOptions(question);
// Returns: { A: "...", B: "...", C: "...", D: "..." }

// Access options safely (works for both V6 & legacy)
const optionA = originalOptions.A;
```

**Never assume** `question.optionA` exists for V6 documents! Always use compat helpers.

See [`questionbank-v6-compatibility.md`](./memories/repo/questionbank-v6-compatibility.md).

---

## Key Files to Know

### 🎯 Exemplary Patterns
1. **Model Template**: [`backend/src/models/Student.ts`](./backend/src/models/Student.ts)
2. **Frontend Utils**: [`src/lib/utils.ts`](./src/lib/utils.ts), [`src/lib/admin-api.ts`](./src/lib/admin-api.ts)
3. **Controller**: [`backend/src/controllers/studentTaskCbtController.ts`](./backend/src/controllers/studentTaskCbtController.ts)
4. **Security Fix**: [`audit-security-hardcoded-connections.js`](./audit-security-hardcoded-connections.js)

### 📚 Comprehensive Docs
- [`FRONTEND-VS-BACKEND-INVESTIGATION.md`](./FRONTEND-VS-BACKEND-INVESTIGATION.md) - Common discrepancies
- [`ROOT-CAUSE-FINAL.md`](./ROOT-CAUSE-FINAL.md) - Debugging methodology
- [`CHECKLIST-MIGRASI-BESOK.md`](./CHECKLIST-MIGRASI-BESOK.md) - Migration procedures

---

## Common Pitfalls & Warnings

### 🔴 Critical Security Issues
- **NEVER hardcode MongoDB URIs or API keys** - Use environment variables only
- MongoDB connections must use SRV format with authentication

### ⚠️ Frequent Developer Mistakes
1. **Assuming question formats**: Legacy vs V6 requires compat layer
2. **Using `undefined` without validation**: All validations use Indonesian messages
3. **Mixed TS/JS in same feature**: Prefer TypeScript everywhere except audit scripts
4. **Missing authentication checks**: Verify JWT tokens in API routes

### ✅ Best Practices Observed
- Mongoose model caching prevents runtime errors
- Enum type safety throughout codebase
- Indonesian language validation messages
- Index on `branch`, `className`, `userId` fields

---

## Testing Strategy

### Playwright E2E Tests Only
```bash
npm run test:blackbox:owner  # Owner role testing
npm run test:blackbox:siswa  # Student role testing
npm run test:blackbox:guru   # Teacher role testing
```

No unit/integration tests found - pure visual/regression testing approach.

---

## Environment Configuration

Required in `.env.local`:
```bash
MONGODB_URI=mongodb+srv://user:pass@cluster/dbname
AUTH_API_URL=http://127.0.0.1:5000
AUTH_API_KEY=bimbel_lms_api_key_123
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

Always access via `process.env.VAR_NAME` (never direct hardcoded values).

---

## When in Doubt

1. Check existing similar code in `/backend/src/controllers/` or `/src/app/`
2. Review related audit files for known issues/patterns
3. Follow the pattern templates above strictly
4. Link to documentation rather than duplicating content

---

## Next Steps for AI Agents

Useful customizations to consider:
- Create `/create-audit-script` skill for generating consistent audit files
- Add `/verify-questionbank-format` hook for V6 compatibility checks
- Implement `/check-database-secrets` linter rule for hardcoded URIs
<!-- END:smartbimbel-instructions -->
<!-- END:nextjs-agent-rules -->
