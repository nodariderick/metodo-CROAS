import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  pgEnum,
  date,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const teamTaskStatusEnum = pgEnum("team_task_status", [
  "pending",
  "in_progress",
  "done",
]);

// ─── TEAM TASKS ───────────────────────────────────────────────────────────────

export const teamTasksTable = pgTable("team_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assignedToId: integer("assigned_to_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  assignedById: integer("assigned_by_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  dueDate: date("due_date"),
  status: teamTaskStatusEnum("status").notNull().default("pending"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TeamTask = typeof teamTasksTable.$inferSelect;
export type InsertTeamTask = typeof teamTasksTable.$inferInsert;

// ─── TEAM GOALS ───────────────────────────────────────────────────────────────

export const teamGoalsTable = pgTable("team_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1–12
  targetTasks: integer("target_tasks").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TeamGoal = typeof teamGoalsTable.$inferSelect;
export type InsertTeamGoal = typeof teamGoalsTable.$inferInsert;

// ─── CAPACITY SETTINGS ────────────────────────────────────────────────────────

export const capacitySettingsTable = pgTable("capacity_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  weeklySessionCapacity: integer("weekly_session_capacity").notNull().default(20),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CapacitySettings = typeof capacitySettingsTable.$inferSelect;
export type InsertCapacitySettings = typeof capacitySettingsTable.$inferInsert;
