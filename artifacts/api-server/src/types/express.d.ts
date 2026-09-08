import type { User as DbUser } from "@workspace/db";

declare global {
  namespace Express {
    interface User extends DbUser {}
  }
}
