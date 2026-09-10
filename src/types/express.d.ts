import type { UserDocument } from "../../backend/src/models/User";

declare module "express-serve-static-core" {
  interface Request {
    user?: UserDocument;
  }
}

export {};
