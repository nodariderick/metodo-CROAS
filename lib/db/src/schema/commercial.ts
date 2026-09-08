import {
  pgTable,
  text,
  serial,
  boolean,
  timestamp,
  integer,
  pgEnum,
  date,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const leadStageEnum = pgEnum("lead_stage", [
  "lead",
  "call_agendada",
  "call_realizada",
  "proposta",
  "fechado",
  "perdido",
]);

export const leadOriginEnum = pgEnum("lead_origin", [
  "instagram",
  "indicacao",
  "parceria",
  "palestra",
  "outro",
]);

// ─── LEADS ───────────────────────────────────────────────────────────────────

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  origin: leadOriginEnum("origin").notNull().default("outro"),
  stage: leadStageEnum("stage").notNull().default("lead"),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  notes: text("notes"),
  proposalValue: integer("proposal_value"), // in cents
  isActive: boolean("is_active").notNull().default(true),
  // When stage becomes "fechado", auto-creates student record — store ref here
  convertedStudentId: integer("converted_student_id"),
  // Set once when stage transitions to "fechado"; never updated. Used for monthly goal attribution.
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Lead = typeof leadsTable.$inferSelect;
export type InsertLead = typeof leadsTable.$inferInsert;

// ─── COMMERCIAL GOALS ────────────────────────────────────────────────────────

export const commercialGoalsTable = pgTable("commercial_goals", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1–12
  targetDeals: integer("target_deals").notNull().default(0),
  targetRevenue: integer("target_revenue").notNull().default(0), // in cents
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CommercialGoal = typeof commercialGoalsTable.$inferSelect;
export type InsertCommercialGoal = typeof commercialGoalsTable.$inferInsert;
