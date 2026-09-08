import {
  pgTable,
  text,
  serial,
  boolean,
  timestamp,
  integer,
  pgEnum,
  json,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { studentsTable } from "./students";

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const transactionTypeEnum = pgEnum("transaction_type", [
  "revenue",
  "expense",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending_reconciliation",
  "reconciled",
]);

export const importSourceEnum = pgEnum("import_source", [
  "manual",
  "csv",
  "ofx",
]);

// ─── FINANCIAL CATEGORIES ────────────────────────────────────────────────────

export const financialCategoriesTable = pgTable("financial_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: transactionTypeEnum("type").notNull(),
  color: text("color").notNull().default("#D69A21"),
  // Comma-separated keywords for auto-categorization by description matching
  keywords: text("keywords").notNull().default(""),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FinancialCategory = typeof financialCategoriesTable.$inferSelect;
export type InsertFinancialCategory =
  typeof financialCategoriesTable.$inferInsert;

// ─── FINANCIAL TRANSACTIONS ──────────────────────────────────────────────────

export const financialTransactionsTable = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  // Amount in cents — positive for revenue, negative for expense
  amount: integer("amount").notNull(),
  transactionDate: text("transaction_date").notNull(), // ISO date string "YYYY-MM-DD"
  description: text("description").notNull(),
  type: transactionTypeEnum("type").notNull(),
  categoryId: integer("category_id").references(
    () => financialCategoriesTable.id,
    { onDelete: "set null" },
  ),
  suggestedCategoryId: integer("suggested_category_id").references(
    () => financialCategoriesTable.id,
    { onDelete: "set null" },
  ),
  status: transactionStatusEnum("status")
    .notNull()
    .default("pending_reconciliation"),
  importSource: importSourceEnum("import_source").notNull().default("manual"),
  // Group identifier for batch-imported transactions (e.g. upload session ID)
  importBatch: text("import_batch"),
  notes: text("notes"),
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
  reconciledById: integer("reconciled_by_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FinancialTransaction =
  typeof financialTransactionsTable.$inferSelect;
export type InsertFinancialTransaction =
  typeof financialTransactionsTable.$inferInsert;

// ─── RECEIVABLES ─────────────────────────────────────────────────────────────

export const receivablesTable = pgTable("receivables", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  // Amount owed, in cents
  amount: integer("amount").notNull(),
  dueDate: text("due_date").notNull(), // ISO date "YYYY-MM-DD"
  paidAt: timestamp("paid_at", { withTimezone: true }),
  // Actual amount paid (may differ from billed if discounted)
  paidAmount: integer("paid_amount"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Receivable = typeof receivablesTable.$inferSelect;
export type InsertReceivable = typeof receivablesTable.$inferInsert;

// ─── REVENUE GOALS ───────────────────────────────────────────────────────────

export const revenueGoalsTable = pgTable("revenue_goals", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull().unique(),
  // Annual target in cents
  annualTarget: integer("annual_target").notNull().default(0),
  // JSON array of 12 numbers (index 0 = January), monthly breakdowns in cents
  monthlyTargets: json("monthly_targets").$type<number[]>().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type RevenueGoal = typeof revenueGoalsTable.$inferSelect;
export type InsertRevenueGoal = typeof revenueGoalsTable.$inferInsert;
