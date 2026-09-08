import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { studentsTable } from "./students";

export const formTypeEnum = pgEnum("form_type", [
  "anamnese",
  "objectives",
  "smart_goals",
]);

export const formResponsesTable = pgTable("form_responses", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  formType: formTypeEnum("form_type").notNull(),
  responseData: text("response_data"),
  areaScores: text("area_scores"),
  respondedAt: timestamp("responded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFormResponseSchema = createInsertSchema(formResponsesTable).omit({ id: true });
export type InsertFormResponse = z.infer<typeof insertFormResponseSchema>;
export type FormResponse = typeof formResponsesTable.$inferSelect;

export const fileTypeEnum = pgEnum("file_type", [
  "contract",
  "transcript",
  "mindmap",
  "other",
]);

export const studentFilesTable = pgTable("student_files", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: fileTypeEnum("file_type").notNull().default("other"),
  storageKey: text("storage_key").notNull(),
  fileSize: integer("file_size"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  uploadedBy: integer("uploaded_by").references(() => usersTable.id, { onDelete: "set null" }),
});

export const insertStudentFileSchema = createInsertSchema(studentFilesTable).omit({ id: true });
export type InsertStudentFile = z.infer<typeof insertStudentFileSchema>;
export type StudentFile = typeof studentFilesTable.$inferSelect;
