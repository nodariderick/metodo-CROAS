import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  db,
  leadsTable,
  commercialGoalsTable,
  studentsTable,
  plansTable,
  trailStagesTable,
  usersTable,
} from "@workspace/db";
import {
  ListLeadsQueryParams,
  CreateLeadBody,
  GetLeadParams,
  UpdateLeadParams,
  UpdateLeadBody,
  DeleteLeadParams,
  MoveLeadStageParams,
  MoveLeadStageBody,
  GetCommercialGoalParams,
  SetCommercialGoalParams,
  SetCommercialGoalBody,
  GetConversionFunnelQueryParams,
  GetConversionByOriginQueryParams,
} from "@workspace/api-zod";
import { requireAuth, requireMaster } from "../middlewares/auth";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

// ─── STAGE ORDER ─────────────────────────────────────────────────────────────
const STAGE_ORDER = [
  "lead",
  "call_agendada",
  "call_realizada",
  "proposta",
  "fechado",
  "perdido",
] as const;

type LeadStage = (typeof STAGE_ORDER)[number];

const PLAN_STAGES: Record<string, string[]> = {
  Padrão: [
    "Onboarding & Alinhamento",
    "Anamnese Completa",
    "Definição de Objetivos",
    "Metas SMART",
    "Revisão Mês 1",
    "Revisão Mês 2",
    "Revisão Mês 3",
    "Encerramento",
  ],
  Premium: [
    "Onboarding & Alinhamento",
    "Anamnese Completa",
    "Análise de Cenário Atual",
    "Definição de Objetivos",
    "Metas SMART",
    "Estratégia de Ação",
    "Revisão Mês 1",
    "Ajuste de Rota",
    "Revisão Mês 2",
    "Aprofundamento Estratégico",
    "Revisão Mês 3",
    "Encerramento e Próximos Passos",
  ],
};

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
function requireCommercialAccess(req: any, res: any, next: any): void {
  const user = req.user as { role?: string } | undefined;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (user.role === "MASTER" || user.role === "COLLABORATOR") {
    next();
    return;
  }
  res.status(403).json({ error: "Forbidden" });
}

// ─── HELPER: serialize lead ───────────────────────────────────────────────────
async function enrichLead(lead: typeof leadsTable.$inferSelect) {
  let assignedToName: string | null = null;
  if (lead.assignedToId) {
    const [user] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, lead.assignedToId))
      .limit(1);
    assignedToName = user?.name ?? null;
  }
  return {
    ...lead,
    assignedToName,
    lastContactAt: lead.lastContactAt?.toISOString() ?? null,
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

// ─── LIST LEADS ───────────────────────────────────────────────────────────────
router.get(
  "/leads",
  requireAuth,
  requireCommercialAccess,
  async (req, res): Promise<void> => {
    const parsed = ListLeadsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { search, stage, origin, assignedToId, followUpToday } = parsed.data;

    let rows = await db
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.isActive, true));

    if (stage) rows = rows.filter((l) => l.stage === stage);
    if (origin) rows = rows.filter((l) => l.origin === origin);
    if (assignedToId) rows = rows.filter((l) => l.assignedToId === assignedToId);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (l) =>
          l.fullName.toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q) ||
          (l.phone ?? "").toLowerCase().includes(q),
      );
    }
    if (followUpToday) {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      rows = rows.filter(
        (l) =>
          l.nextFollowUpAt &&
          l.nextFollowUpAt >= todayStart &&
          l.nextFollowUpAt <= todayEnd,
      );
    }

    const enriched = await Promise.all(rows.map(enrichLead));
    res.json(enriched);
  },
);

// ─── CREATE LEAD ──────────────────────────────────────────────────────────────
router.post(
  "/leads",
  requireAuth,
  requireCommercialAccess,
  async (req, res): Promise<void> => {
    const parsed = CreateLeadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const actor = req.user as { id: number; name: string };
    const d = parsed.data;

    // Block terminal stages — closed/lost leads must go through move-stage
    // so student enrollment and closedAt attribution are always transactional.
    if (d.stage === "fechado" || d.stage === "perdido") {
      res.status(400).json({
        error: `Cannot create a lead directly in stage '${d.stage}'. Create it in an earlier stage and use move-stage to advance it.`,
      });
      return;
    }

    const [lead] = await db
      .insert(leadsTable)
      .values({
        fullName: d.fullName,
        email: d.email ?? null,
        phone: d.phone ?? null,
        origin: (d.origin ?? "outro") as any,
        stage: (d.stage ?? "lead") as any,
        assignedToId: d.assignedToId ?? null,
        nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null,
        notes: d.notes ?? null,
        proposalValue: d.proposalValue ?? null,
      })
      .returning();

    await logActivity({
      userId: actor.id,
      action: "create_lead",
      entityType: "lead",
      entityId: lead.id,
      entityLabel: lead.fullName,
    });
    res.status(201).json(await enrichLead(lead));
  },
);

// ─── GET LEAD ─────────────────────────────────────────────────────────────────
router.get(
  "/leads/:id",
  requireAuth,
  requireCommercialAccess,
  async (req, res): Promise<void> => {
    const params = GetLeadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [lead] = await db
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.id, params.data.id))
      .limit(1);
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    res.json(await enrichLead(lead));
  },
);

// ─── UPDATE LEAD ──────────────────────────────────────────────────────────────
router.patch(
  "/leads/:id",
  requireAuth,
  requireCommercialAccess,
  async (req, res): Promise<void> => {
    const params = UpdateLeadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateLeadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const actor = req.user as { id: number; name: string };
    const d = parsed.data;

    const updateData: Partial<typeof leadsTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (d.fullName !== undefined) updateData.fullName = d.fullName;
    if (d.email !== undefined) updateData.email = d.email ?? null;
    if (d.phone !== undefined) updateData.phone = d.phone ?? null;
    if (d.origin !== undefined) updateData.origin = d.origin as any;
    if (d.assignedToId !== undefined) updateData.assignedToId = d.assignedToId ?? null;
    if (d.notes !== undefined) updateData.notes = d.notes ?? null;
    if (d.proposalValue !== undefined) updateData.proposalValue = d.proposalValue ?? null;
    if (d.isActive !== undefined) updateData.isActive = d.isActive;
    if (d.lastContactAt !== undefined)
      updateData.lastContactAt = d.lastContactAt ? new Date(d.lastContactAt) : null;
    if (d.nextFollowUpAt !== undefined)
      updateData.nextFollowUpAt = d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null;

    const [lead] = await db
      .update(leadsTable)
      .set(updateData)
      .where(eq(leadsTable.id, params.data.id))
      .returning();
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    await logActivity({
      userId: actor.id,
      action: "update_lead",
      entityType: "lead",
      entityId: lead.id,
      entityLabel: lead.fullName,
    });
    res.json(await enrichLead(lead));
  },
);

// ─── DELETE LEAD ──────────────────────────────────────────────────────────────
router.delete(
  "/leads/:id",
  requireAuth,
  requireMaster,
  async (req, res): Promise<void> => {
    const params = DeleteLeadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const actor = req.user as { id: number; name: string };
    const [lead] = await db
      .delete(leadsTable)
      .where(eq(leadsTable.id, params.data.id))
      .returning();
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    await logActivity({
      userId: actor.id,
      action: "delete_lead",
      entityType: "lead",
      entityId: lead.id,
      entityLabel: lead.fullName,
    });
    res.sendStatus(204);
  },
);

// ─── MOVE STAGE ───────────────────────────────────────────────────────────────
router.post(
  "/leads/:id/move-stage",
  requireAuth,
  requireCommercialAccess,
  async (req, res): Promise<void> => {
    const params = MoveLeadStageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = MoveLeadStageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const actor = req.user as { id: number; name: string };
    const { stage: newStage, notes, planId } = parsed.data;

    // Fetch existing lead
    const [existingLead] = await db
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.id, params.data.id))
      .limit(1);
    if (!existingLead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    // When converting to "fechado", validate plan exists BEFORE any writes
    if (newStage === "fechado" && !existingLead.convertedStudentId) {
      const targetPlanId = planId ?? 1;
      const [plan] = await db
        .select()
        .from(plansTable)
        .where(eq(plansTable.id, targetPlanId))
        .limit(1);
      if (!plan) {
        res.status(400).json({ error: `Plan ${targetPlanId} not found` });
        return;
      }

      // Wrap student creation + trail stages + lead update in a single transaction
      const lead = await db.transaction(async (tx) => {
        // Create student
        const [newStudent] = await tx
          .insert(studentsTable)
          .values({
            fullName: existingLead.fullName,
            email: existingLead.email ?? null,
            phone: existingLead.phone ?? null,
            planId: plan.id,
            notes: `Convertido do CRM. ${existingLead.notes ?? ""}`.trim(),
            isActive: true,
          })
          .returning();

        // Generate trail stages from plan template
        const stageTemplates =
          PLAN_STAGES[plan.name] ??
          Array.from({ length: plan.stageCount }, (_, i) => `Etapa ${i + 1}`);

        await tx.insert(trailStagesTable).values(
          stageTemplates.map((title, idx) => ({
            studentId: newStudent.id,
            stageIndex: idx,
            title,
            status: idx === 0 ? ("in_progress" as const) : ("pending" as const),
          })),
        );

        // Update lead atomically — set closedAt once, never touched again
        const [updatedLead] = await tx
          .update(leadsTable)
          .set({
            stage: "fechado" as any,
            lastContactAt: new Date(),
            closedAt: new Date(),
            convertedStudentId: newStudent.id,
            notes: notes ?? existingLead.notes,
            updatedAt: new Date(),
          })
          .where(eq(leadsTable.id, params.data.id))
          .returning();

        return updatedLead;
      });

      await logActivity({
        userId: actor.id,
        action: "lead_converted_to_student",
        entityType: "student",
        entityId: lead.convertedStudentId!,
        entityLabel: lead.fullName,
        metadata: JSON.stringify({ leadId: lead.id, planId: plan.id }),
      });
      await logActivity({
        userId: actor.id,
        action: "move_lead_stage",
        entityType: "lead",
        entityId: lead.id,
        entityLabel: lead.fullName,
        metadata: JSON.stringify({ from: existingLead.stage, to: newStage }),
      });

      res.json(await enrichLead(lead));
      return;
    }

    // Non-fechado stage move (no transaction needed — single write)
    const updateData: Partial<typeof leadsTable.$inferInsert> & { updatedAt: Date } = {
      stage: newStage as any,
      lastContactAt: new Date(),
      updatedAt: new Date(),
    };
    if (notes) updateData.notes = notes;

    const [lead] = await db
      .update(leadsTable)
      .set(updateData)
      .where(eq(leadsTable.id, params.data.id))
      .returning();

    await logActivity({
      userId: actor.id,
      action: "move_lead_stage",
      entityType: "lead",
      entityId: lead.id,
      entityLabel: lead.fullName,
      metadata: JSON.stringify({ from: existingLead.stage, to: newStage }),
    });

    res.json(await enrichLead(lead));
  },
);

// ─── COMMERCIAL GOALS ─────────────────────────────────────────────────────────
router.get(
  "/commercial/goals/:year/:month",
  requireAuth,
  requireCommercialAccess,
  async (req, res): Promise<void> => {
    const params = GetCommercialGoalParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const { year, month } = params.data;
    if (month < 1 || month > 12) {
      res.status(400).json({ error: "month must be between 1 and 12" });
      return;
    }

    const [goal] = await db
      .select()
      .from(commercialGoalsTable)
      .where(
        and(
          eq(commercialGoalsTable.year, year),
          eq(commercialGoalsTable.month, month),
        ),
      )
      .limit(1);

    if (!goal) {
      res.status(404).json({ error: "Goal not set for this month" });
      return;
    }

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const closedLeads = await db
      .select()
      .from(leadsTable)
      .where(
        and(
          eq(leadsTable.stage, "fechado"),
          gte(leadsTable.closedAt, monthStart),
          lte(leadsTable.closedAt, monthEnd),
        ),
      );

    res.json({
      ...goal,
      closedDeals: closedLeads.length,
      closedRevenue: closedLeads.reduce((s, l) => s + (l.proposalValue ?? 0), 0),
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    });
  },
);

router.put(
  "/commercial/goals/:year/:month",
  requireAuth,
  requireMaster,
  async (req, res): Promise<void> => {
    const params = SetCommercialGoalParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SetCommercialGoalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { year, month } = params.data;
    if (month < 1 || month > 12) {
      res.status(400).json({ error: "month must be between 1 and 12" });
      return;
    }
    const { targetDeals, targetRevenue, notes } = parsed.data;

    const [existing] = await db
      .select()
      .from(commercialGoalsTable)
      .where(
        and(
          eq(commercialGoalsTable.year, year),
          eq(commercialGoalsTable.month, month),
        ),
      )
      .limit(1);

    let goal: typeof commercialGoalsTable.$inferSelect;
    if (existing) {
      const [updated] = await db
        .update(commercialGoalsTable)
        .set({ targetDeals, targetRevenue, notes: notes ?? null, updatedAt: new Date() })
        .where(eq(commercialGoalsTable.id, existing.id))
        .returning();
      goal = updated;
    } else {
      const [created] = await db
        .insert(commercialGoalsTable)
        .values({ year, month, targetDeals, targetRevenue, notes: notes ?? null })
        .returning();
      goal = created;
    }

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const closedLeads = await db
      .select()
      .from(leadsTable)
      .where(
        and(
          eq(leadsTable.stage, "fechado"),
          gte(leadsTable.closedAt, monthStart),
          lte(leadsTable.closedAt, monthEnd),
        ),
      );

    res.json({
      ...goal,
      closedDeals: closedLeads.length,
      closedRevenue: closedLeads.reduce((s, l) => s + (l.proposalValue ?? 0), 0),
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    });
  },
);

// ─── ANALYTICS — FUNNEL ───────────────────────────────────────────────────────
router.get(
  "/commercial/analytics/funnel",
  requireAuth,
  requireCommercialAccess,
  async (req, res): Promise<void> => {
    const parsed = GetConversionFunnelQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { year, month } = parsed.data;

    let leads = await db.select().from(leadsTable);

    if (year && month) {
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59);
      leads = leads.filter((l) => l.createdAt >= monthStart && l.createdAt <= monthEnd);
    }

    const total = leads.length;
    const funnel = STAGE_ORDER.map((stage) => {
      const count = leads.filter((l) => l.stage === stage).length;
      return {
        stage,
        count,
        conversionRate: total > 0 ? Math.round((count / total) * 10000) / 10000 : 0,
      };
    });

    res.json(funnel);
  },
);

// ─── ANALYTICS — BY ORIGIN ────────────────────────────────────────────────────
router.get(
  "/commercial/analytics/by-origin",
  requireAuth,
  requireCommercialAccess,
  async (req, res): Promise<void> => {
    const parsed = GetConversionByOriginQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { year, month } = parsed.data;

    let leads = await db.select().from(leadsTable);

    if (year && month) {
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59);
      leads = leads.filter((l) => l.createdAt >= monthStart && l.createdAt <= monthEnd);
    }

    const origins = ["instagram", "indicacao", "parceria", "palestra", "outro"] as const;

    const byOrigin = origins.map((origin) => {
      const group = leads.filter((l) => l.origin === origin);
      const closed = group.filter((l) => l.stage === "fechado").length;
      return {
        origin,
        total: group.length,
        closed,
        conversionRate:
          group.length > 0 ? Math.round((closed / group.length) * 10000) / 10000 : 0,
      };
    });

    res.json(byOrigin);
  },
);

export default router;
