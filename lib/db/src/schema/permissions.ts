import { pgTable, serial, integer, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const moduleEnum = pgEnum("module_name", [
  "dashboard",
  "finance",
  "students",
  "files",
  "commercial",
  "team",
  "calendar",
]);

export const permissionLevelEnum = pgEnum("permission_level", ["NONE", "READ", "WRITE"]);

export const permissionsTable = pgTable(
  "permissions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    module: moduleEnum("module").notNull(),
    level: permissionLevelEnum("level").notNull().default("NONE"),
  },
  (t) => [unique().on(t.userId, t.module)],
);

export const insertPermissionSchema = createInsertSchema(permissionsTable).omit({ id: true });
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissionsTable.$inferSelect;
