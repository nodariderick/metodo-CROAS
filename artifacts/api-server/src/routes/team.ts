import { Router, type IRouter } from "express";
import { eq, and, or, gte, lte, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  usersTable,
  teamTasksTable,
  teamGoalsTable,
  capacitySettingsTable,
  studentsTable,
  trailStagesTable,
  leadsTable,
  commercialGoalsTable,
  financialTransactionsTable,
  receivablesTable,
  revenueGoalsTable,
  sessionsTable,
} from "@workspace/db";
import { requireAuth, requireMaster } from "../middlewares/auth";
import { permissionsTable } from "@workspace/db";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

// ─── INPUT HELPERS ─────────────────────────────────────────────────────────────
function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

// ─── ACCESS HELPERS ─────────────────────────────────────────────────────────────
/** READ or WRITE team permission — allows list/performance/goals reads */
async function requireTeamAccess(req: any, res: any, next: any): Promise<void> {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Not authenticated" }); return; }
  const user = req.user as { id: number; role: string };
  if (user.role === "MASTER") { next(); return; }
  if (user.role === "COLLABORATOR") {
    const [perm] = await db.select().from(permissionsTable)
      .where(and(eq(permissionsTable.userId, user.id), eq(permissionsTable.module, "team")))
      .limit(1);
    if (!perm || perm.level === "NONE") { res.status(403).json({ error: "Forbidden: no team access" }); return; }
    next(); return;
  }
  res.status(403).json({ error: "Forbidden" });
}

/** WRITE team permission only — required for task status/notes mutations */
async function requireTeamWrite(req: any, res: any, next: any): Promise<void> {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Not authenticated" }); return; }
  const user = req.user as { id: number; role: string };
  if (user.role === "MASTER") { next(); return; }
  if (user.role === "COLLABORATOR") {
    const [perm] = await db.select().from(permissionsTable)
      .where(and(eq(permissionsTable.userId, user.id), eq(permissionsTable.module, "team")))
      .limit(1);
    if (!perm || perm.level !== "WRITE") { res.status(403).json({ error: "Forbidden: team write access required" }); return; }
    next(); return;
  }
  res.status(403).json({ error: "Forbidden" });
}

// ─── VALIDATORS ────────────────────────────────────────────────────────────────
const CreateTeamTaskBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedToId: z.number().int().positive(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

const UpdateTeamTaskBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  assignedToId: z.number().int().positive().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["pending", "in_progress", "done"]).optional(),
  notes: z.string().nullable().optional(),
});

const TaskIdParam = z.object({ id: z.coerce.number().int().positive() });
const GoalIdParam = z.object({ id: z.coerce.number().int().positive() });

const CreateTeamGoalBody = z.object({
  userId: z.number().int().positive(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  targetTasks: z.number().int().min(0),
  notes: z.string().nullable().optional(),
});

const UpdateTeamGoalBody = z.object({
  targetTasks: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
});

const CapacityBody = z.object({
  weeklySessionCapacity: z.number().int().min(1).max(200),
});

// ─── TEAM TASKS — LIST ─────────────────────────────────────────────────────────

router.get("/team/tasks", requireAuth, requireTeamAccess, async (req, res): Promise<void> => {
  const actor = req.user as { id: number; role: string };
  const { assignedToId, status } = req.query;

  let rows = await db.select().from(teamTasksTable);

  // COLLABORATORs only see their own tasks
  if (actor.role === "COLLABORATOR") {
    rows = rows.filter((t) => t.assignedToId === actor.id);
  } else if (assignedToId) {
    const aid = Number(assignedToId);
    if (!isNaN(aid)) rows = rows.filter((t) => t.assignedToId === aid);
  }

  if (status && typeof status === "string") {
    rows = rows.filter((t) => t.status === status);
  }

  rows.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  // Enrich with assignee/assigner names
  const userIds = [...new Set([...rows.map((t) => t.assignedToId), ...rows.map((t) => t.assignedById)])];
  const users = userIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  res.json(rows.map((t) => ({ ...t, assignedToName: userMap[t.assignedToId] ?? null, assignedByName: userMap[t.assignedById] ?? null })));
});

// ─── TEAM TASKS — CREATE ───────────────────────────────────────────────────────

router.post("/team/tasks", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const actor = req.user as { id: number };
  const parsed = CreateTeamTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { title, description, assignedToId, dueDate, notes } = parsed.data;

  if (dueDate !== undefined && !isValidDate(dueDate)) {
    res.status(400).json({ error: "dueDate must be a valid ISO date (YYYY-MM-DD)" }); return;
  }

  const [assignee] = await db.select().from(usersTable).where(eq(usersTable.id, assignedToId)).limit(1);
  if (!assignee) { res.status(404).json({ error: "Assignee not found" }); return; }

  const [task] = await db.insert(teamTasksTable).values({
    title,
    description: description ?? null,
    assignedToId,
    assignedById: actor.id,
    dueDate: dueDate ?? null,
    notes: notes ?? null,
  }).returning();

  await logActivity({ userId: actor.id, action: "create_team_task", entityType: "team_task", entityLabel: title, metadata: JSON.stringify({ assignedToId }) });
  res.status(201).json({ ...task, assignedToName: assignee.name, assignedByName: null });
});

// ─── TEAM TASKS — PATCH ────────────────────────────────────────────────────────

router.patch("/team/tasks/:id", requireAuth, requireTeamWrite, async (req, res): Promise<void> => {
  const actor = req.user as { id: number; role: string };
  const params = TaskIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid task id" }); return; }
  const parsed = UpdateTeamTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(teamTasksTable).where(eq(teamTasksTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Task not found" }); return; }

  // COLLABORATORs can only update their own tasks' status/notes
  if (actor.role === "COLLABORATOR" && existing.assignedToId !== actor.id) {
    res.status(403).json({ error: "Forbidden: not your task" }); return;
  }

  const d = parsed.data;
  if (d.dueDate !== undefined && d.dueDate !== null && !isValidDate(d.dueDate)) {
    res.status(400).json({ error: "dueDate must be a valid ISO date (YYYY-MM-DD)" }); return;
  }

  const update: Partial<typeof teamTasksTable.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
  if (actor.role === "MASTER") {
    // MASTER can edit all fields
    if (d.title !== undefined) update.title = d.title;
    if (d.description !== undefined) update.description = d.description ?? null;
    if (d.assignedToId !== undefined) update.assignedToId = d.assignedToId;
    if (d.dueDate !== undefined) update.dueDate = d.dueDate ?? null;
  }
  // COLLABORATORs may only change status and notes on their own tasks
  if (d.notes !== undefined) update.notes = d.notes ?? null;
  if (d.status !== undefined) {
    update.status = d.status as any;
    if (d.status === "done" && existing.status !== "done") update.completedAt = new Date();
    if (d.status !== "done" && existing.status === "done") update.completedAt = null;
  }

  const [updated] = await db.update(teamTasksTable).set(update).where(eq(teamTasksTable.id, params.data.id)).returning();
  res.json(updated);
});

// ─── TEAM TASKS — DELETE ───────────────────────────────────────────────────────

router.delete("/team/tasks/:id", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = TaskIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid task id" }); return; }
  const [t] = await db.delete(teamTasksTable).where(eq(teamTasksTable.id, params.data.id)).returning();
  if (!t) { res.status(404).json({ error: "Task not found" }); return; }
  res.sendStatus(204);
});

// ─── TEAM GOALS — LIST ─────────────────────────────────────────────────────────

router.get("/team/goals", requireAuth, requireTeamAccess, async (req, res): Promise<void> => {
  const actor = req.user as { id: number; role: string };
  let rows = await db.select().from(teamGoalsTable);

  if (actor.role === "COLLABORATOR") {
    rows = rows.filter((g) => g.userId === actor.id);
  } else {
    const { userId } = req.query;
    if (userId) {
      const uid = Number(userId);
      if (!isNaN(uid)) rows = rows.filter((g) => g.userId === uid);
    }
  }
  rows.sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month);
  res.json(rows);
});

// ─── TEAM GOALS — UPSERT ──────────────────────────────────────────────────────

router.put("/team/goals", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const parsed = CreateTeamGoalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { userId, year, month, targetTasks, notes } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const existing = await db.select().from(teamGoalsTable)
    .where(and(eq(teamGoalsTable.userId, userId), eq(teamGoalsTable.year, year), eq(teamGoalsTable.month, month)))
    .limit(1);

  let goal;
  if (existing.length > 0) {
    const upd: Partial<typeof teamGoalsTable.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date(), targetTasks };
    if (notes !== undefined) upd.notes = notes ?? null;
    const [updated] = await db.update(teamGoalsTable).set(upd).where(eq(teamGoalsTable.id, existing[0].id)).returning();
    goal = updated;
  } else {
    const [created] = await db.insert(teamGoalsTable).values({ userId, year, month, targetTasks, notes: notes ?? null }).returning();
    goal = created;
  }
  res.json(goal);
});

// ─── TEAM GOALS — DELETE ───────────────────────────────────────────────────────

router.delete("/team/goals/:id", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = GoalIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid goal id" }); return; }
  const [g] = await db.delete(teamGoalsTable).where(eq(teamGoalsTable.id, params.data.id)).returning();
  if (!g) { res.status(404).json({ error: "Goal not found" }); return; }
  res.sendStatus(204);
});

// ─── TEAM PERFORMANCE SUMMARY ─────────────────────────────────────────────────

router.get("/team/performance", requireAuth, requireTeamAccess, async (req, res): Promise<void> => {
  const actor = req.user as { id: number; role: string };
  const yearNum = Number(req.query.year) || new Date().getFullYear();
  const monthNum = Number(req.query.month) || new Date().getMonth() + 1;

  const collaborators = actor.role === "MASTER"
    ? await db.select().from(usersTable).where(eq(usersTable.role as any, "COLLABORATOR"))
    : await db.select().from(usersTable).where(eq(usersTable.id, actor.id));

  const mm = String(monthNum).padStart(2, "0");
  const periodStart = `${yearNum}-${mm}-01`;
  // last day of month
  const lastDay = new Date(yearNum, monthNum, 0).getDate();
  const periodEnd = `${yearNum}-${mm}-${String(lastDay).padStart(2, "0")}`;

  const allTasks = await db.select().from(teamTasksTable);
  const allGoals = await db.select().from(teamGoalsTable)
    .where(and(eq(teamGoalsTable.year, yearNum), eq(teamGoalsTable.month, monthNum)));

  const summary = collaborators.map((u) => {
    const myTasks = allTasks.filter((t) => t.assignedToId === u.id);
    const monthTasks = myTasks.filter((t) => t.dueDate && t.dueDate >= periodStart && t.dueDate <= periodEnd);
    const completedOnTime = monthTasks.filter((t) => t.status === "done" && t.completedAt && t.dueDate && t.completedAt.toISOString().slice(0, 10) <= t.dueDate).length;
    const completedTotal = monthTasks.filter((t) => t.status === "done").length;
    const overdue = myTasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10)).length;
    const goal = allGoals.find((g) => g.userId === u.id);
    const goalHit = goal ? completedTotal >= goal.targetTasks : null;

    return {
      userId: u.id,
      name: u.name,
      totalTasks: myTasks.length,
      monthTasksDue: monthTasks.length,
      completedOnTime,
      completedTotal,
      overdueCount: overdue,
      goalTargetTasks: goal?.targetTasks ?? null,
      goalHit,
    };
  });

  res.json({ year: yearNum, month: monthNum, collaborators: summary });
});

// ─── CAPACITY SETTINGS ─────────────────────────────────────────────────────────

router.get("/team/capacity", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const actor = req.user as { id: number };
  const [settings] = await db.select().from(capacitySettingsTable).where(eq(capacitySettingsTable.userId, actor.id)).limit(1);
  res.json(settings ?? { userId: actor.id, weeklySessionCapacity: 20 });
});

router.put("/team/capacity", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const actor = req.user as { id: number };
  const parsed = CapacityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(capacitySettingsTable).where(eq(capacitySettingsTable.userId, actor.id)).limit(1);
  let settings;
  if (existing) {
    const [upd] = await db.update(capacitySettingsTable).set({ weeklySessionCapacity: parsed.data.weeklySessionCapacity, updatedAt: new Date() }).where(eq(capacitySettingsTable.id, existing.id)).returning();
    settings = upd;
  } else {
    const [created] = await db.insert(capacitySettingsTable).values({ userId: actor.id, weeklySessionCapacity: parsed.data.weeklySessionCapacity }).returning();
    settings = created;
  }
  res.json(settings);
});

// ─── DASHBOARD 360 ─────────────────────────────────────────────────────────────

router.get("/dashboard/360", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const actor = req.user as { id: number };
  const today = new Date().toISOString().slice(0, 10);
  const [todayY, todayM] = today.split("-").map(Number);
  const mm = String(todayM).padStart(2, "0");
  const monthStart = `${todayY}-${mm}-01`;
  const lastDay = new Date(todayY, todayM, 0).getDate();
  const monthEnd = `${todayY}-${mm}-${String(lastDay).padStart(2, "0")}`;
  const in30Days = new Date(todayY, todayM - 1, new Date().getDate() + 30).toISOString().slice(0, 10);

  // Run all queries in parallel
  const [
    allTx,
    allReceivables,
    revenueGoals,
    allStudents,
    allStages,
    allLeads,
    commercialGoal,
    capacityRow,
    allTeamTasks,
    collaborators,
  ] = await Promise.all([
    db.select().from(financialTransactionsTable).where(and(
      eq(financialTransactionsTable.status, "reconciled"),
      gte(financialTransactionsTable.transactionDate, monthStart),
      lte(financialTransactionsTable.transactionDate, monthEnd),
    )),
    db.select().from(receivablesTable).where(isNull(receivablesTable.paidAt)),
    db.select().from(revenueGoalsTable).where(eq(revenueGoalsTable.year, todayY)).limit(1),
    db.select().from(studentsTable).where(eq(studentsTable.isActive, true)),
    db.select().from(trailStagesTable),
    db.select().from(leadsTable).where(eq(leadsTable.isActive, true)),
    db.select().from(commercialGoalsTable).where(and(
      eq(commercialGoalsTable.year, todayY),
      eq(commercialGoalsTable.month, todayM),
    )).limit(1),
    db.select().from(capacitySettingsTable).where(eq(capacitySettingsTable.userId, actor.id)).limit(1),
    db.select().from(teamTasksTable),
    db.select().from(usersTable).where(eq(usersTable.role as any, "COLLABORATOR")),
  ]);

  // ─── Caixa ──────────────────────────────────────────────────────────────────
  const monthRevenue = allTx.filter((t) => t.type === "revenue").reduce((s, t) => s + t.amount, 0);
  const monthExpense = allTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const monthBalance = monthRevenue - monthExpense;

  // 30-day projection: unpaid receivables due within 30 days
  const projectedInflow = allReceivables
    .filter((r) => r.dueDate >= today && r.dueDate <= in30Days)
    .reduce((s, r) => s + r.amount, 0);

  // ─── Receita ────────────────────────────────────────────────────────────────
  const goalRow = revenueGoals[0];
  const annualGoal = goalRow?.annualTarget ?? 0;
  const monthGoal = goalRow
    ? (Array.isArray(goalRow.monthlyTargets) ? (goalRow.monthlyTargets as number[])[todayM - 1] ?? 0 : 0)
    : 0;
  const revenueGoalPct = monthGoal > 0 ? Math.round((monthRevenue / monthGoal) * 100) : null;

  // YTD revenue
  const ytdTx = await db.select({ amount: financialTransactionsTable.amount }).from(financialTransactionsTable)
    .where(and(
      eq(financialTransactionsTable.status, "reconciled"),
      eq(financialTransactionsTable.type, "revenue"),
      gte(financialTransactionsTable.transactionDate, `${todayY}-01-01`),
      lte(financialTransactionsTable.transactionDate, monthEnd),
    ));
  const ytdRevenue = ytdTx.reduce((s, t) => s + t.amount, 0);
  const annualGoalPct = annualGoal > 0 ? Math.round((ytdRevenue / annualGoal) * 100) : null;

  // ─── Alunos ─────────────────────────────────────────────────────────────────
  const activeCount = allStudents.length;
  const atRisk = allStudents.filter((s) => {
    const myStages = allStages.filter((st) => st.studentId === s.id);
    const hasDelayed = myStages.some((st) => st.status === "delayed");
    return hasDelayed;
  }).length;
  // Count students whose plan ends within the next 30 days
  const planEndingSoon = allStudents.filter((s) => {
    if (!s.planEndsAt) return false;
    return s.planEndsAt >= today && s.planEndsAt <= in30Days;
  }).length;

  // ─── Comercial ──────────────────────────────────────────────────────────────
  const stageOrder = ["lead", "call_agendada", "call_realizada", "proposta", "fechado", "perdido"];
  const leadsPerStage = stageOrder.map((stage) => ({
    stage,
    count: allLeads.filter((l) => l.stage === stage).length,
  }));
  const monthClosings = allLeads.filter((l) => l.stage === "fechado" && l.closedAt &&
    l.closedAt.toISOString().slice(0, 7) === `${todayY}-${mm}`).length;
  const closingGoal = commercialGoal[0]?.targetDeals ?? null;

  // ─── Capacidade ─────────────────────────────────────────────────────────────
  // Count unique sessions scheduled or conducted this week (Mon–Sun).
  // Back-filled sessions may have conductedAt without scheduledAt.
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const monday = new Date(now); monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);

  const weekSessions = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(or(
      and(
        gte(sessionsTable.scheduledAt, monday),
        lte(sessionsTable.scheduledAt, sunday),
      ),
      and(
        gte(sessionsTable.conductedAt, monday),
        lte(sessionsTable.conductedAt, sunday),
      ),
    ));

  const sessionsThisWeek = new Set(weekSessions.map((session) => session.id)).size;
  const maxCapacity = capacityRow[0]?.weeklySessionCapacity ?? 20;

  // ─── Equipe ─────────────────────────────────────────────────────────────────
  const pendingTasks = allTeamTasks.filter((t) => t.status !== "done").length;
  const overdueTasks = allTeamTasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).length;

  const teamSummary = collaborators.map((u) => ({
    userId: u.id,
    name: u.name,
    pendingTasks: allTeamTasks.filter((t) => t.assignedToId === u.id && t.status !== "done").length,
    overdueTasks: allTeamTasks.filter((t) => t.assignedToId === u.id && t.status !== "done" && t.dueDate && t.dueDate < today).length,
  }));

  res.json({
    generatedAt: new Date().toISOString(),
    caixa: {
      monthRevenue,
      monthExpense,
      monthBalance,
      projectedInflow30d: projectedInflow,
    },
    receita: {
      monthRevenue,
      monthGoal,
      revenueGoalPct,
      ytdRevenue,
      annualGoal,
      annualGoalPct,
    },
    alunos: {
      activeCount,
      atRisk,
      planEndingSoon,
    },
    comercial: {
      leadsPerStage,
      monthClosings,
      closingGoal,
    },
    capacidade: {
      sessionsThisWeek,
      maxCapacity,
      utilizationPct: maxCapacity > 0 ? Math.round((sessionsThisWeek / maxCapacity) * 100) : 0,
    },
    equipe: {
      pendingTasks,
      overdueTasks,
      collaborators: teamSummary,
    },
  });
});

export default router;
