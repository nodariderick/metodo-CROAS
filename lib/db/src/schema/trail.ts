import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  date,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { studentsTable } from "./students";

export const stageStatusEnum = pgEnum("stage_status", [
  "pending",
  "in_progress",
  "complete",
  "delayed",
]);

export const trailStagesTable = pgTable(
  "trail_stages",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    stageIndex: integer("stage_index").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: stageStatusEnum("status").notNull().default("pending"),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.studentId, t.stageIndex)],
);

export const insertTrailStageSchema = createInsertSchema(trailStagesTable).omit({ id: true });
export type InsertTrailStage = z.infer<typeof insertTrailStageSchema>;
export type TrailStage = typeof trailStagesTable.$inferSelect;

export const sessionsTable = pgTable("student_sessions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  sessionNumber: integer("session_number").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  conductedAt: timestamp("conducted_at", { withTimezone: true }),
  summary: text("summary"),
  actionPlan: text("action_plan"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;

export const studentTasksTable = pgTable("student_tasks", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  assignedBy: integer("assigned_by").references(() => usersTable.id, { onDelete: "set null" }),
});

export const insertStudentTaskSchema = createInsertSchema(studentTasksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStudentTask = z.infer<typeof insertStudentTaskSchema>;
export type StudentTask = typeof studentTasksTable.$inferSelect;
