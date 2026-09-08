import {
  pgTable,
  text,
  serial,
  boolean,
  timestamp,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  stageCount: integer("stage_count").notNull(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  planId: integer("plan_id")
    .notNull()
    .references(() => plansTable.id),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  startDate: date("start_date"),
  planEndsAt: date("plan_ends_at"),
  nextSessionAt: timestamp("next_session_at", { withTimezone: true }),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
