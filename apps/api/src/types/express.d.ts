import type { AuthenticatedUser } from "../modules/auth/domain/authenticated-user.js";

declare global {
  namespace Express {
    interface Request {
      currentUser?: AuthenticatedUser;
      requestId: string;
    }
  }
}

export {};
