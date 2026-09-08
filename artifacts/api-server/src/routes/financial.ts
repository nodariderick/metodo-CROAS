import { Router, type IRouter } from "express";
import { eq, and, gte, lte, like, or, isNull } from "drizzle-orm";
import multer from "multer";
import { randomUUID } from "crypto";
import {
  db,
  financialCategoriesTable,
  financialTransactionsTable,
  receivablesTable,
  revenueGoalsTable,
  studentsTable,
  usersTable,
} from "@workspace/db";
import {
  ListFinancialTransactionsQueryParams,
  CreateFinancialTransactionBody,
  UpdateFinancialTransactionBody,
  ReconcileTransactionBody,
  CreateFinancialCategoryBody,
  ListReceivablesQueryParams,
  CreateReceivableBody,
  UpdateReceivableBody,
  GetRevenueGoalParams,
  SetRevenueGoalParams,
  SetRevenueGoalBody,
  GetCashFlowQueryParams,
  GetDreQueryParams,
  GetComparativesQueryParams,
  DeleteFinancialTransactionParams,
  UpdateFinancialTransactionParams,
  ReconcileTransactionParams,
  UpdateFinancialCategoryParams,
  DeleteFinancialCategoryParams,
  DeleteReceivableParams,
  UpdateReceivableParams,
} from "@workspace/api-zod";
import { requireAuth, requireMaster } from "../middlewares/auth";
import { logActivity } from "../lib/activity";
import { permissionsTable } from "@workspace/db";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── FINANCE ACCESS MIDDLEWARE ────────────────────────────────────────────────
async function requireFinanceAccess(req: any, res: any, next: any): Promise<void> {
  const user = req.user as { id?: number; role?: string } | undefined;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (user.role === "MASTER") { next(); return; }
  if (user.role === "COLLABORATOR") {
    // Check if this collaborator has at least READ on the finance module
    const [perm] = await db.select().from(permissionsTable).where(
      and(eq(permissionsTable.userId, user.id!), eq(permissionsTable.module, "finance"))
    ).limit(1);
    if (perm && perm.level !== "NONE") { next(); return; }
    res.status(403).json({ error: "Forbidden: no finance module access" });
    return;
  }
  res.status(403).json({ error: "Forbidden" });
}

// ─── INPUT HELPERS ────────────────────────────────────────────────────────────
/** Strict calendar-date validation — rejects overflow dates like 2025-02-30 */
function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
function isPositiveCents(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function enrichTransaction(
  tx: typeof financialTransactionsTable.$inferSelect,
  categories: (typeof financialCategoriesTable.$inferSelect)[],
  reconciledByMap: Record<number, string>,
) {
  const cat = categories.find((c) => c.id === tx.categoryId);
  const sugCat = categories.find((c) => c.id === tx.suggestedCategoryId);
  return {
    ...tx,
    categoryName: cat?.name ?? null,
    categoryColor: cat?.color ?? null,
    suggestedCategoryName: sugCat?.name ?? null,
    reconciledAt: tx.reconciledAt?.toISOString() ?? null,
    reconciledByName: tx.reconciledById ? (reconciledByMap[tx.reconciledById] ?? null) : null,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  };
}

async function getAllCategories() {
  return db.select().from(financialCategoriesTable);
}

/** Simple keyword-based category suggestion */
function suggestCategory(
  description: string,
  categories: (typeof financialCategoriesTable.$inferSelect)[],
  type: "revenue" | "expense",
): number | null {
  const desc = description.toLowerCase();
  const typed = categories.filter((c) => c.type === type && c.keywords.length > 0);
  for (const cat of typed) {
    const kws = cat.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (kws.some((k) => desc.includes(k))) return cat.id;
  }
  return null;
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

router.get("/finance/categories", requireAuth, requireFinanceAccess, async (req, res): Promise<void> => {
  const cats = await getAllCategories();
  res.json(cats.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })));
});

router.post("/finance/categories", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const parsed = CreateFinancialCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, type, color, keywords } = parsed.data;
  const [cat] = await db.insert(financialCategoriesTable).values({
    name, type: type as any,
    color: color ?? "#8A7F6E",
    keywords: keywords ?? "",
  }).returning();
  res.status(201).json({ ...cat, createdAt: cat.createdAt.toISOString(), updatedAt: cat.updatedAt.toISOString() });
});

router.patch("/finance/categories/:id", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = UpdateFinancialCategoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateFinancialCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, type, color, keywords } = parsed.data;
  const [cat] = await db.update(financialCategoriesTable)
    .set({ name, type: type as any, color: color ?? undefined, keywords: keywords ?? undefined, updatedAt: new Date() })
    .where(eq(financialCategoriesTable.id, params.data.id))
    .returning();
  if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
  res.json({ ...cat, createdAt: cat.createdAt.toISOString(), updatedAt: cat.updatedAt.toISOString() });
});

router.delete("/finance/categories/:id", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = DeleteFinancialCategoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [cat] = await db.select().from(financialCategoriesTable).where(eq(financialCategoriesTable.id, params.data.id)).limit(1);
  if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
  if (cat.isSystem) { res.status(400).json({ error: "Cannot delete system categories" }); return; }
  await db.delete(financialCategoriesTable).where(eq(financialCategoriesTable.id, params.data.id));
  res.sendStatus(204);
});

// ─── TRANSACTIONS — LIST ─────────────────────────────────────────────────────

router.get("/finance/transactions", requireAuth, requireFinanceAccess, async (req, res): Promise<void> => {
  const parsed = ListFinancialTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { status, type, categoryId, startDate, endDate, search } = parsed.data;

  let rows = await db.select().from(financialTransactionsTable);
  if (status) rows = rows.filter((t) => t.status === status);
  if (type) rows = rows.filter((t) => t.type === type);
  if (categoryId) rows = rows.filter((t) => t.categoryId === categoryId);
  if (startDate) rows = rows.filter((t) => t.transactionDate >= startDate);
  if (endDate) rows = rows.filter((t) => t.transactionDate <= endDate);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((t) => t.description.toLowerCase().includes(q) || (t.notes ?? "").toLowerCase().includes(q));
  }

  rows.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));

  const categories = await getAllCategories();
  const reconciledByIds = [...new Set(rows.map((t) => t.reconciledById).filter(Boolean) as number[])];
  const userMap: Record<number, string> = {};
  if (reconciledByIds.length > 0) {
    const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
    users.forEach((u) => { userMap[u.id] = u.name; });
  }

  res.json(rows.map((t) => enrichTransaction(t, categories, userMap)));
});

// ─── TRANSACTIONS — CREATE ───────────────────────────────────────────────────

router.post("/finance/transactions", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const parsed = CreateFinancialTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const actor = req.user as { id: number };
  const { amount, transactionDate, description, type, categoryId, notes } = parsed.data;

  if (!isPositiveCents(amount)) { res.status(400).json({ error: "amount must be a positive integer (cents)" }); return; }
  if (!isValidDate(transactionDate)) { res.status(400).json({ error: "transactionDate must be a valid ISO date (YYYY-MM-DD)" }); return; }

  const categories = await getAllCategories();
  const suggested = categoryId ? null : suggestCategory(description, categories, type as any);

  const [tx] = await db.insert(financialTransactionsTable).values({
    amount, transactionDate, description,
    type: type as any,
    categoryId: categoryId ?? null,
    suggestedCategoryId: suggested,
    notes: notes ?? null,
    importSource: "manual",
    // Manual creates go directly to reconciled
    status: "reconciled",
    reconciledAt: new Date(),
    reconciledById: actor.id,
  }).returning();

  await logActivity({ userId: actor.id, action: "create_transaction", entityType: "transaction", entityId: tx.id, entityLabel: tx.description });
  res.status(201).json(enrichTransaction(tx, categories, { [actor.id]: "" }));
});

// ─── TRANSACTIONS — IMPORT (CSV/OFX) ────────────────────────────────────────

// Note: The file field in the OpenAPI spec uses type: string (not format: binary) because
// Zod v3 does not support zod.instanceof(File). The generated hook is intentionally unused;
// the UI submits multipart/form-data via a hand-written fetch to bypass this limitation.
router.post("/finance/transactions/import", requireAuth, requireMaster, upload.single("file"), async (req, res): Promise<void> => {
  const actor = req.user as { id: number };
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  // Validate accepted file types by extension and MIME type
  const rawFileType = ((req.body.fileType as string) || "").toLowerCase().trim();
  const fileType = rawFileType === "ofx" || req.file.originalname.toLowerCase().endsWith(".ofx") ? "ofx" : "csv";
  const allowedMime = ["text/plain", "text/csv", "application/csv", "application/x-ofx", "application/octet-stream", "text/x-csv"];
  if (!allowedMime.includes(req.file.mimetype) && !req.file.originalname.match(/\.(csv|ofx)$/i)) {
    res.status(400).json({ error: "Unsupported file type. Upload a .csv or .ofx file." }); return;
  }
  if (req.file.size === 0) { res.status(400).json({ error: "Uploaded file is empty" }); return; }

  const content = req.file.buffer.toString("utf-8");
  const batchId = randomUUID();

  type ParsedEntry = { date: string; description: string; amount: number; type: "revenue" | "expense" };
  let entries: ParsedEntry[] = [];

  try {
    if (fileType === "ofx") {
      // Parse SGML-style OFX: extract STMTTRN blocks
      const blocks = content.split("</STMTTRN>").filter((b) => b.includes("<STMTTRN>"));
      for (const block of blocks) {
        const get = (tag: string) => {
          const m = block.match(new RegExp(`<${tag}>([^<\n\r]+)`));
          return m ? m[1].trim() : "";
        };
        const raw = get("TRNAMT") || get("DTAMOUNT");
        const rawDate = get("DTPOSTED") || get("DTAVAIL");
        if (!raw || !rawDate) continue;
        const amountFloat = parseFloat(raw.replace(",", "."));
        if (isNaN(amountFloat)) continue;
        const dateStr = rawDate.slice(0, 8);
        const isoDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        const memo = get("MEMO") || get("NAME") || get("TRNTYPE") || "Importado";
        entries.push({
          date: isoDate,
          description: memo,
          amount: Math.round(Math.abs(amountFloat) * 100),
          type: amountFloat >= 0 ? "revenue" : "expense",
        });
      }
    } else {
      // CSV: expect columns date,description,amount,type (optional header)
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const start = lines[0].toLowerCase().includes("date") ? 1 : 0;
      for (const line of lines.slice(start)) {
        const cols = line.split(/[;,]/).map((c) => c.trim().replace(/^["']|["']$/g, ""));
        if (cols.length < 3) continue;
        const [dateRaw, desc, amtRaw, typeRaw] = cols;
        const amountFloat = parseFloat(amtRaw.replace(",", ".").replace(/[^\d.-]/g, ""));
        if (isNaN(amountFloat)) continue;
        const txType = typeRaw?.toLowerCase().includes("despesa") || typeRaw?.toLowerCase().includes("expense") || amountFloat < 0
          ? "expense" : "revenue";
        entries.push({ date: dateRaw, description: desc || "Importado", amount: Math.round(Math.abs(amountFloat) * 100), type: txType });
      }
    }
  } catch (e) {
    res.status(400).json({ error: "Failed to parse file" });
    return;
  }

  // Validate parsed entries: drop zero-value amounts and invalid dates
  const validEntries = entries.filter((e) => e.amount > 0 && isValidDate(e.date));
  const skippedInvalid = entries.length - validEntries.length;

  if (validEntries.length === 0) { res.status(400).json({ error: "No valid transactions found in file" }); return; }

  // Build fingerprint set from existing transactions (date+amount+type+desc prefix)
  const fingerprint = (date: string, amount: number, type: string, desc: string) =>
    `${date}|${amount}|${type}|${desc.toLowerCase().slice(0, 60).trim()}`;

  const existingTxs = await db.select({
    transactionDate: financialTransactionsTable.transactionDate,
    amount: financialTransactionsTable.amount,
    type: financialTransactionsTable.type,
    description: financialTransactionsTable.description,
  }).from(financialTransactionsTable);

  const existingFingerprints = new Set(
    existingTxs.map((t) => fingerprint(t.transactionDate, t.amount, t.type, t.description))
  );

  const categories = await getAllCategories();
  const inserted: (typeof financialTransactionsTable.$inferSelect)[] = [];
  let duplicatesSkipped = 0;
  let errors = skippedInvalid;

  for (const entry of validEntries) {
    const fp = fingerprint(entry.date, entry.amount, entry.type, entry.description);
    if (existingFingerprints.has(fp)) { duplicatesSkipped++; continue; }
    existingFingerprints.add(fp); // prevent intra-batch duplicates too
    try {
      const suggested = suggestCategory(entry.description, categories, entry.type);
      const [tx] = await db.insert(financialTransactionsTable).values({
        amount: entry.amount,
        transactionDate: entry.date,
        description: entry.description.slice(0, 500),
        type: entry.type,
        suggestedCategoryId: suggested,
        status: "pending_reconciliation",
        importSource: fileType as any,
        importBatch: batchId,
      }).returning();
      inserted.push(tx);
    } catch { errors++; }
  }

  await logActivity({ userId: actor.id, action: "import_transactions", entityType: "transaction", entityLabel: `${inserted.length} transactions imported`, metadata: JSON.stringify({ batchId, fileType, duplicatesSkipped }) });

  const userMap: Record<number, string> = {};
  res.status(201).json({
    imported: inserted.length,
    duplicatesSkipped,
    errors,
    batchId,
    transactions: inserted.map((t) => enrichTransaction(t, categories, userMap)),
  });
});

// ─── TRANSACTIONS — UPDATE ───────────────────────────────────────────────────

router.patch("/finance/transactions/:id", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = UpdateFinancialTransactionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateFinancialTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const d = parsed.data;
  if (d.transactionDate !== undefined && !isValidDate(d.transactionDate)) {
    res.status(400).json({ error: "transactionDate must be a valid ISO date (YYYY-MM-DD)" }); return;
  }

  const update: Partial<typeof financialTransactionsTable.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
  if (d.description !== undefined) update.description = d.description;
  if (d.transactionDate !== undefined) update.transactionDate = d.transactionDate;
  if (d.type !== undefined) update.type = d.type as any;
  if (d.categoryId !== undefined) update.categoryId = d.categoryId ?? null;
  if (d.notes !== undefined) update.notes = d.notes ?? null;

  const [tx] = await db.update(financialTransactionsTable).set(update).where(eq(financialTransactionsTable.id, params.data.id)).returning();
  if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }

  const categories = await getAllCategories();
  res.json(enrichTransaction(tx, categories, {}));
});

// ─── TRANSACTIONS — DELETE ───────────────────────────────────────────────────

router.delete("/finance/transactions/:id", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = DeleteFinancialTransactionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [tx] = await db.delete(financialTransactionsTable).where(eq(financialTransactionsTable.id, params.data.id)).returning();
  if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }
  res.sendStatus(204);
});

// ─── TRANSACTIONS — RECONCILE ────────────────────────────────────────────────

router.post("/finance/transactions/:id/reconcile", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = ReconcileTransactionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = ReconcileTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const actor = req.user as { id: number; name: string };

  const [existing] = await db.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Transaction not found" }); return; }
  if (existing.status === "reconciled") { res.status(400).json({ error: "Transaction already reconciled" }); return; }

  const [tx] = await db.update(financialTransactionsTable).set({
    status: "reconciled",
    categoryId: parsed.data.categoryId,
    notes: parsed.data.notes ?? existing.notes,
    reconciledAt: new Date(),
    reconciledById: actor.id,
    updatedAt: new Date(),
  }).where(eq(financialTransactionsTable.id, params.data.id)).returning();

  await logActivity({ userId: actor.id, action: "reconcile_transaction", entityType: "transaction", entityId: tx.id, entityLabel: tx.description });

  const categories = await getAllCategories();
  res.json(enrichTransaction(tx, categories, { [actor.id]: actor.name }));
});

// ─── CASH FLOW ────────────────────────────────────────────────────────────────

router.get("/finance/cash-flow", requireAuth, requireFinanceAccess, async (req, res): Promise<void> => {
  const parsed = GetCashFlowQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const months = Math.min(Math.max(Math.floor(parsed.data.months ?? 3), 1), 24);

  const today = new Date();
  const past60 = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
  const futureEnd = new Date(today.getTime() + months * 30 * 24 * 60 * 60 * 1000);

  const toISO = (d: Date) => d.toISOString().slice(0, 10);

  const reconciledTx = await db.select().from(financialTransactionsTable).where(
    and(eq(financialTransactionsTable.status, "reconciled"), gte(financialTransactionsTable.transactionDate, toISO(past60)), lte(financialTransactionsTable.transactionDate, toISO(today)))
  );

  const receivables = await db.select().from(receivablesTable).where(
    and(gte(receivablesTable.dueDate, toISO(today)), lte(receivablesTable.dueDate, toISO(futureEnd)))
  );

  // Group realized by week
  const realizedByDate: Record<string, { revenue: number; expense: number }> = {};
  for (const tx of reconciledTx) {
    if (!realizedByDate[tx.transactionDate]) realizedByDate[tx.transactionDate] = { revenue: 0, expense: 0 };
    if (tx.type === "revenue") realizedByDate[tx.transactionDate].revenue += tx.amount;
    else realizedByDate[tx.transactionDate].expense += tx.amount;
  }

  // Group projected receivables by date
  const projectedByDate: Record<string, { revenue: number; expense: number }> = {};
  for (const r of receivables) {
    if (r.paidAt) continue; // already paid
    if (!projectedByDate[r.dueDate]) projectedByDate[r.dueDate] = { revenue: 0, expense: 0 };
    projectedByDate[r.dueDate].revenue += r.amount;
  }

  // Emit realized and projected as separate entry streams — a date can appear in both
  const realizedEntries = Object.keys(realizedByDate).sort().map((date) => {
    const r = realizedByDate[date];
    return { date, revenue: r.revenue, expense: r.expense, net: r.revenue - r.expense, type: "realized" as const };
  });
  const projectedEntries = Object.keys(projectedByDate).sort().map((date) => {
    const r = projectedByDate[date];
    return { date, revenue: r.revenue, expense: 0, net: r.revenue, type: "projected" as const };
  });
  const entries = [...realizedEntries, ...projectedEntries].sort((a, b) => a.date.localeCompare(b.date));

  const totalRealized = entries.filter((e) => e.type === "realized").reduce((s, e) => s + e.net, 0);
  const totalProjected = entries.filter((e) => e.type === "projected").reduce((s, e) => s + e.net, 0);

  res.json({ entries, totalRealized, totalProjected, runningBalance: totalRealized + totalProjected });
});

// ─── DRE ──────────────────────────────────────────────────────────────────────

router.get("/finance/dre", requireAuth, requireFinanceAccess, async (req, res): Promise<void> => {
  const parsed = GetDreQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { view = "monthly" } = parsed.data;
  const today = new Date();
  const year = parsed.data.year ?? today.getFullYear();
  const month = parsed.data.month ?? today.getMonth() + 1;

  let startDate: string;
  let endDate: string;
  if (view === "ytd") {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else {
    const mm = String(month).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    startDate = `${year}-${mm}-01`;
    endDate = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
  }

  const transactions = await db.select().from(financialTransactionsTable).where(
    and(eq(financialTransactionsTable.status, "reconciled"), gte(financialTransactionsTable.transactionDate, startDate), lte(financialTransactionsTable.transactionDate, endDate))
  );
  const categories = await getAllCategories();

  const linesByCategory = (type: "revenue" | "expense") => {
    const typed = transactions.filter((t) => t.type === type);
    const byCategory: Record<string, number> = {};
    for (const tx of typed) {
      const key = tx.categoryId ?? -1;
      byCategory[key] = (byCategory[key] ?? 0) + tx.amount;
    }
    return Object.entries(byCategory).map(([catIdStr, amount]) => {
      const catId = parseInt(catIdStr);
      const cat = categories.find((c) => c.id === catId);
      return { categoryId: catId, categoryName: cat?.name ?? "Sem Categoria", categoryColor: cat?.color ?? "#8A7F6E", amount };
    }).sort((a, b) => b.amount - a.amount);
  };

  const revenueLines = linesByCategory("revenue");
  const expenseLines = linesByCategory("expense");
  const totalRevenue = revenueLines.reduce((s, l) => s + l.amount, 0);
  const totalExpense = expenseLines.reduce((s, l) => s + l.amount, 0);
  const grossMargin = totalRevenue - totalExpense;
  const marginPercent = totalRevenue > 0 ? Math.round((grossMargin / totalRevenue) * 10000) / 100 : 0;

  res.json({ year, month: view === "monthly" ? month : null, view, totalRevenue, totalExpense, grossMargin, marginPercent, revenueLines, expenseLines });
});

// ─── COMPARATIVES ────────────────────────────────────────────────────────────

router.get("/finance/comparatives", requireAuth, requireFinanceAccess, async (req, res): Promise<void> => {
  const parsed = GetComparativesQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const today = new Date();
  const year = parsed.data.year ?? today.getFullYear();
  const month = parsed.data.month ?? today.getMonth() + 1;

  const allTx = await db.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.status, "reconciled"));

  function periodTotals(startDate: string, endDate: string, label: string) {
    const rows = allTx.filter((t) => t.transactionDate >= startDate && t.transactionDate <= endDate);
    return {
      period: label,
      revenue: rows.filter((t) => t.type === "revenue").reduce((s, t) => s + t.amount, 0),
      expense: rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      net: rows.reduce((s, t) => s + (t.type === "revenue" ? t.amount : -t.amount), 0),
    };
  }

  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  const currentMonthEnd = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMm = String(prevMonth).padStart(2, "0");
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();

  res.json({
    currentMonth: periodTotals(`${year}-${mm}-01`, currentMonthEnd, `${mm}/${year}`),
    previousMonth: periodTotals(`${prevYear}-${prevMm}-01`, `${prevYear}-${prevMm}-${String(prevLastDay).padStart(2, "0")}`, `${prevMm}/${prevYear}`),
    sameMonthLastYear: periodTotals(`${year - 1}-${mm}-01`, `${year - 1}-${mm}-${String(lastDay).padStart(2, "0")}`, `${mm}/${year - 1}`),
    currentYtd: periodTotals(`${year}-01-01`, currentMonthEnd, `YTD ${year}`),
    previousYtd: periodTotals(`${year - 1}-01-01`, `${year - 1}-${mm}-${String(lastDay).padStart(2, "0")}`, `YTD ${year - 1}`),
  });
});

// ─── RECEIVABLES ─────────────────────────────────────────────────────────────

async function enrichReceivable(r: typeof receivablesTable.$inferSelect) {
  const [student] = await db.select({ fullName: studentsTable.fullName }).from(studentsTable).where(eq(studentsTable.id, r.studentId)).limit(1);
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...r,
    studentName: student?.fullName ?? "Aluno Desconhecido",
    isOverdue: !r.paidAt && r.dueDate < today,
    paidAt: r.paidAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/finance/receivables", requireAuth, requireFinanceAccess, async (req, res): Promise<void> => {
  const parsed = ListReceivablesQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { studentId, overdue, unpaid } = parsed.data;

  let rows = await db.select().from(receivablesTable);
  if (studentId) rows = rows.filter((r) => r.studentId === studentId);
  const today = new Date().toISOString().slice(0, 10);
  if (overdue) rows = rows.filter((r) => !r.paidAt && r.dueDate < today);
  if (unpaid) rows = rows.filter((r) => !r.paidAt);
  rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const enriched = await Promise.all(rows.map(enrichReceivable));
  res.json(enriched);
});

router.post("/finance/receivables", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const parsed = CreateReceivableBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { studentId, description, amount, dueDate, notes } = parsed.data;

  if (!isPositiveCents(amount)) { res.status(400).json({ error: "amount must be a positive integer (cents)" }); return; }
  if (!isValidDate(dueDate)) { res.status(400).json({ error: "dueDate must be a valid ISO date (YYYY-MM-DD)" }); return; }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId)).limit(1);
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const [r] = await db.insert(receivablesTable).values({ studentId, description, amount, dueDate, notes: notes ?? null }).returning();
  res.status(201).json(await enrichReceivable(r));
});

router.patch("/finance/receivables/:id", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = UpdateReceivableParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateReceivableBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const d = parsed.data;
  if (d.amount !== undefined && !isPositiveCents(d.amount)) {
    res.status(400).json({ error: "amount must be a positive integer (cents)" }); return;
  }
  if (d.paidAmount !== undefined && d.paidAmount !== null && !isPositiveCents(d.paidAmount)) {
    res.status(400).json({ error: "paidAmount must be a positive integer (cents)" }); return;
  }
  if (d.dueDate !== undefined && !isValidDate(d.dueDate)) {
    res.status(400).json({ error: "dueDate must be a valid ISO date (YYYY-MM-DD)" }); return;
  }
  // Strict calendar validation on paidAt (rejects 2025-02-30 etc.)
  if (d.paidAt !== undefined && d.paidAt !== null) {
    const paidDateStr = (d.paidAt as string).slice(0, 10);
    if (!isValidDate(paidDateStr)) {
      res.status(400).json({ error: "paidAt contains an invalid calendar date" }); return;
    }
  }

  // Fetch the existing receivable before update
  const [existing] = await db.select().from(receivablesTable).where(eq(receivablesTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Receivable not found" }); return; }

  // Idempotency guard: block re-settlement if already paid
  const attemptingSettle = d.paidAt !== undefined && d.paidAt !== null;
  if (attemptingSettle && existing.paidAt !== null) {
    res.status(409).json({ error: "Receivable is already settled. Clear paidAt first to reverse." }); return;
  }

  const isSettling = attemptingSettle && !existing.paidAt;
  const settledAmount = isSettling ? (d.paidAmount ?? existing.amount) : 0;
  const settledDateStr = isSettling ? (d.paidAt as string).slice(0, 10) : "";

  const actor = req.user as { id: number };

  // Atomically update receivable + create reconciled revenue transaction when settling
  // Use paidAt IS NULL as concurrency guard so concurrent requests only settle once
  const r = await db.transaction(async (tx) => {
    const update: Partial<typeof receivablesTable.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
    if (d.description !== undefined) update.description = d.description;
    if (d.amount !== undefined) update.amount = d.amount;
    if (d.dueDate !== undefined) update.dueDate = d.dueDate;
    if (d.paidAt !== undefined) update.paidAt = d.paidAt ? new Date(d.paidAt) : null;
    if (d.paidAmount !== undefined) update.paidAmount = d.paidAmount ?? null;
    if (d.notes !== undefined) update.notes = d.notes ?? null;

    // When settling, only update if still unpaid (prevents concurrent double-settlement)
    const whereClause = isSettling
      ? and(eq(receivablesTable.id, params.data.id), isNull(receivablesTable.paidAt))
      : eq(receivablesTable.id, params.data.id);

    const [updated] = await tx.update(receivablesTable).set(update).where(whereClause).returning();
    if (!updated) {
      // Row was already settled by a concurrent request
      throw new Error("ALREADY_SETTLED");
    }

    if (isSettling && settledAmount > 0) {
      // Create a linked reconciled revenue transaction
      const categories = await getAllCategories();
      const suggestedCatId = suggestCategory(existing.description, categories, "revenue");
      const categoryId = suggestedCatId ?? categories.find((c) => c.type === "revenue")?.id ?? null;
      await tx.insert(financialTransactionsTable).values({
        amount: settledAmount,
        transactionDate: settledDateStr,
        description: `Pagamento: ${existing.description}`,
        type: "revenue",
        categoryId,
        status: "reconciled",
        importSource: "manual",
        reconciledAt: new Date(),
        reconciledById: actor.id,
        notes: `Auto-gerado ao marcar recebível #${existing.id} como pago`,
      });
    }

    return updated;
  }).catch((err: Error) => {
    if (err.message === "ALREADY_SETTLED") return null;
    throw err;
  });

  if (!r) { res.status(409).json({ error: "Already settled by a concurrent request" }); return; }
  res.json(await enrichReceivable(r));
});

router.delete("/finance/receivables/:id", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = DeleteReceivableParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [r] = await db.delete(receivablesTable).where(eq(receivablesTable.id, params.data.id)).returning();
  if (!r) { res.status(404).json({ error: "Receivable not found" }); return; }
  res.sendStatus(204);
});

// ─── REVENUE GOALS ────────────────────────────────────────────────────────────

async function buildGoalDetail(goal: typeof revenueGoalsTable.$inferSelect, year: number) {
  const allTx = await db.select().from(financialTransactionsTable).where(
    and(eq(financialTransactionsTable.status, "reconciled"), gte(financialTransactionsTable.transactionDate, `${year}-01-01`), lte(financialTransactionsTable.transactionDate, `${year}-12-31`), eq(financialTransactionsTable.type, "revenue"))
  );

  const monthlyActuals = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const lastDay = new Date(year, i + 1, 0).getDate();
    const start = `${year}-${mm}-01`;
    const end = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
    return allTx.filter((t) => t.transactionDate >= start && t.transactionDate <= end).reduce((s, t) => s + t.amount, 0);
  });

  const annualActual = monthlyActuals.reduce((s, v) => s + v, 0);
  const currentMonth = new Date().getMonth(); // 0-indexed
  const remainingMonths = 11 - currentMonth;
  const avgMonthly = currentMonth > 0 ? annualActual / (currentMonth + 1) : 0;
  const projectedYearEnd = annualActual + avgMonthly * remainingMonths;

  return {
    ...goal,
    monthlyTargets: Array.isArray(goal.monthlyTargets) ? goal.monthlyTargets : [],
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
    monthlyActuals,
    annualActual,
    projectedYearEnd: Math.round(projectedYearEnd),
  };
}

router.get("/finance/goals/:year", requireAuth, requireFinanceAccess, async (req, res): Promise<void> => {
  const params = GetRevenueGoalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const { year } = params.data;
  const [goal] = await db.select().from(revenueGoalsTable).where(eq(revenueGoalsTable.year, year)).limit(1);
  if (!goal) { res.status(404).json({ error: "Goal not set for this year" }); return; }
  res.json(await buildGoalDetail(goal, year));
});

router.put("/finance/goals/:year", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = SetRevenueGoalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = SetRevenueGoalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { year } = params.data;
  const { annualTarget, monthlyTargets, notes } = parsed.data;

  if (!Array.isArray(monthlyTargets) || monthlyTargets.length !== 12) {
    res.status(400).json({ error: "monthlyTargets must be an array of exactly 12 numbers" }); return;
  }

  const [existing] = await db.select().from(revenueGoalsTable).where(eq(revenueGoalsTable.year, year)).limit(1);
  let goal: typeof revenueGoalsTable.$inferSelect;
  if (existing) {
    const [updated] = await db.update(revenueGoalsTable).set({ annualTarget, monthlyTargets, notes: notes ?? null, updatedAt: new Date() }).where(eq(revenueGoalsTable.id, existing.id)).returning();
    goal = updated;
  } else {
    const [created] = await db.insert(revenueGoalsTable).values({ year, annualTarget, monthlyTargets, notes: notes ?? null }).returning();
    goal = created;
  }

  res.json(await buildGoalDetail(goal, year));
});

export default router;
