import { Router, type IRouter } from "express";
import { eq, and, ilike, or } from "drizzle-orm";
import {
  db,
  studentsTable,
  plansTable,
  trailStagesTable,
  sessionsTable,
  studentTasksTable,
  formResponsesTable,
  studentFilesTable,
  usersTable,
} from "@workspace/db";
import {
  ListStudentsQueryParams,
  CreateStudentBody,
  UpdateStudentBody,
  GetStudentParams,
  UpdateStudentParams,
  DeleteStudentParams,
  ListStudentStagesParams,
  UpdateStudentStageParams,
  UpdateStudentStageBody,
  ListStudentSessionsParams,
  CreateStudentSessionParams,
  CreateStudentSessionBody,
  UpdateStudentSessionParams,
  UpdateStudentSessionBody,
  DeleteStudentSessionParams,
  ListStudentTasksParams,
  CreateStudentTaskParams,
  CreateStudentTaskBody,
  UpdateStudentTaskParams,
  UpdateStudentTaskBody,
  DeleteStudentTaskParams,
  ListStudentFormsParams,
  CreateStudentFormParams,
  CreateStudentFormBody,
  ListStudentFilesParams,
  RegisterStudentFileParams,
  RegisterStudentFileBody,
  DeleteStudentFileParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { logActivity } from "../lib/activity";
import { enrichStudent } from "../lib/studentHelper";

const router: IRouter = Router();

// ─── PLAN TEMPLATES ──────────────────────────────────────────────────────────
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

// ─── MIDDLEWARE: check student permission ─────────────────────────────────────
function requireStudentsAccess(req: any, res: any, next: any): void {
  const user = req.user as { role?: string } | undefined;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (user.role === "MASTER") { next(); return; }
  if (user.role === "COLLABORATOR") {
    // TODO: check permissions table for 'students' module
    // For now, allow all collaborators (will be tightened in M5)
    next(); return;
  }
  res.status(403).json({ error: "Forbidden" });
}

// ─── PLANS ───────────────────────────────────────────────────────────────────
router.get("/plans", requireAuth, async (_req, res): Promise<void> => {
  const plans = await db.select().from(plansTable);
  res.json(plans);
});

// ─── STUDENT LIST ────────────────────────────────────────────────────────────
router.get("/students", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = ListStudentsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let rows = await db.select().from(studentsTable);

  if (params.data.isActive !== undefined) {
    rows = rows.filter((s) => s.isActive === params.data.isActive);
  }
  if (params.data.planId) {
    rows = rows.filter((s) => s.planId === params.data.planId);
  }
  if (params.data.search) {
    const q = params.data.search.toLowerCase();
    rows = rows.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q),
    );
  }

  const enriched = await Promise.all(rows.map(enrichStudent));

  if (params.data.trailStatus) {
    res.json(enriched.filter((s) => s.trailStatus === params.data.trailStatus));
  } else {
    res.json(enriched);
  }
});

// ─── CREATE STUDENT ───────────────────────────────────────────────────────────
router.post("/students", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const actor = req.user as { id: number; name: string };

  // Resolve plan
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, parsed.data.planId)).limit(1);
  if (!plan) { res.status(400).json({ error: "Plan not found" }); return; }

  const [student] = await db
    .insert(studentsTable)
    .values({
      ...parsed.data,
      userId: parsed.data.userId ?? null,
      nextSessionAt: parsed.data.nextSessionAt ? new Date(parsed.data.nextSessionAt) : null,
    })
    .returning();

  // Auto-generate trail stages based on plan
  const stageTemplates = PLAN_STAGES[plan.name] ?? [];
  if (stageTemplates.length > 0) {
    await db.insert(trailStagesTable).values(
      stageTemplates.map((title, idx) => ({
        studentId: student.id,
        stageIndex: idx,
        title,
        status: idx === 0 ? "in_progress" as const : "pending" as const,
      })),
    );
  }

  await logActivity({ userId: actor.id, action: "create_student", entityType: "student", entityId: student.id, entityLabel: student.fullName });

  const enriched = await enrichStudent(student);
  res.status(201).json(enriched);
});

// ─── GET STUDENT ──────────────────────────────────────────────────────────────
router.get("/students/:id", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = GetStudentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, params.data.id)).limit(1);
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const enriched = await enrichStudent(student);
  res.json(enriched);
});

// ─── UPDATE STUDENT ───────────────────────────────────────────────────────────
router.patch("/students/:id", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = UpdateStudentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateStudentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const actor = req.user as { id: number; name: string };
  const updateData: any = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.nextSessionAt !== undefined) {
    updateData.nextSessionAt = parsed.data.nextSessionAt ? new Date(parsed.data.nextSessionAt) : null;
  }

  const [student] = await db
    .update(studentsTable)
    .set(updateData)
    .where(eq(studentsTable.id, params.data.id))
    .returning();
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  await logActivity({ userId: actor.id, action: "update_student", entityType: "student", entityId: student.id, entityLabel: student.fullName });

  const enriched = await enrichStudent(student);
  res.json(enriched);
});

// ─── DELETE STUDENT ───────────────────────────────────────────────────────────
router.delete("/students/:id", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = DeleteStudentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const actor = req.user as { id: number; name: string };
  const [student] = await db.delete(studentsTable).where(eq(studentsTable.id, params.data.id)).returning();
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  await logActivity({ userId: actor.id, action: "delete_student", entityType: "student", entityId: student.id, entityLabel: student.fullName });
  res.sendStatus(204);
});

// ─── TRAIL STAGES ────────────────────────────────────────────────────────────
router.get("/students/:studentId/stages", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = ListStudentStagesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const stages = await db
    .select()
    .from(trailStagesTable)
    .where(eq(trailStagesTable.studentId, params.data.studentId));

  res.json(stages.sort((a, b) => a.stageIndex - b.stageIndex).map((s) => ({
    ...s,
    completedAt: s.completedAt?.toISOString() ?? null,
  })));
});

router.patch("/students/:studentId/stages/:stageIndex", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = UpdateStudentStageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateStudentStageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const actor = req.user as { id: number; name: string };
  const updateData: any = { ...parsed.data };
  if (parsed.data.completedAt !== undefined) {
    updateData.completedAt = parsed.data.completedAt ? new Date(parsed.data.completedAt) : null;
  }

  const [stage] = await db
    .update(trailStagesTable)
    .set(updateData)
    .where(
      and(
        eq(trailStagesTable.studentId, params.data.studentId),
        eq(trailStagesTable.stageIndex, params.data.stageIndex),
      ),
    )
    .returning();

  if (!stage) { res.status(404).json({ error: "Stage not found" }); return; }

  await logActivity({ userId: actor.id, action: "update_stage", entityType: "trail_stage", entityId: stage.id, entityLabel: `${params.data.studentId}/${params.data.stageIndex}`, metadata: JSON.stringify(parsed.data) });

  res.json({ ...stage, completedAt: stage.completedAt?.toISOString() ?? null });
});

// ─── SESSIONS ────────────────────────────────────────────────────────────────
router.get("/students/:studentId/sessions", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = ListStudentSessionsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.studentId, params.data.studentId));

  res.json(
    sessions
      .sort((a, b) => b.sessionNumber - a.sessionNumber)
      .map((s) => ({
        ...s,
        scheduledAt: s.scheduledAt?.toISOString() ?? null,
        conductedAt: s.conductedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
  );
});

router.post("/students/:studentId/sessions", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = CreateStudentSessionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateStudentSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const actor = req.user as { id: number; name: string };

  // Auto-assign session number
  const existing = await db.select().from(sessionsTable).where(eq(sessionsTable.studentId, params.data.studentId));
  const sessionNumber = existing.length + 1;

  const [session] = await db
    .insert(sessionsTable)
    .values({
      studentId: params.data.studentId,
      sessionNumber,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      conductedAt: parsed.data.conductedAt ? new Date(parsed.data.conductedAt) : null,
      summary: parsed.data.summary ?? null,
      actionPlan: parsed.data.actionPlan ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  // Update student's nextSessionAt if scheduledAt was provided
  if (parsed.data.scheduledAt) {
    await db.update(studentsTable).set({ nextSessionAt: new Date(parsed.data.scheduledAt) }).where(eq(studentsTable.id, params.data.studentId));
  }

  await logActivity({ userId: actor.id, action: "create_session", entityType: "session", entityId: session.id, entityLabel: `Sessão ${sessionNumber}` });

  res.status(201).json({ ...session, scheduledAt: session.scheduledAt?.toISOString() ?? null, conductedAt: session.conductedAt?.toISOString() ?? null, createdAt: session.createdAt.toISOString() });
});

router.patch("/students/:studentId/sessions/:sessionId", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = UpdateStudentSessionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateStudentSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: any = {};
  if (parsed.data.scheduledAt !== undefined) updateData.scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  if (parsed.data.conductedAt !== undefined) updateData.conductedAt = parsed.data.conductedAt ? new Date(parsed.data.conductedAt) : null;
  if (parsed.data.summary !== undefined) updateData.summary = parsed.data.summary;
  if (parsed.data.actionPlan !== undefined) updateData.actionPlan = parsed.data.actionPlan;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  const [session] = await db
    .update(sessionsTable)
    .set(updateData)
    .where(and(eq(sessionsTable.id, params.data.sessionId), eq(sessionsTable.studentId, params.data.studentId)))
    .returning();

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  res.json({ ...session, scheduledAt: session.scheduledAt?.toISOString() ?? null, conductedAt: session.conductedAt?.toISOString() ?? null, createdAt: session.createdAt.toISOString() });
});

router.delete("/students/:studentId/sessions/:sessionId", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = DeleteStudentSessionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(sessionsTable).where(and(eq(sessionsTable.id, params.data.sessionId), eq(sessionsTable.studentId, params.data.studentId)));
  res.sendStatus(204);
});

// ─── TASKS ────────────────────────────────────────────────────────────────────
router.get("/students/:studentId/tasks", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = ListStudentTasksParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let tasks = await db.select({
    id: studentTasksTable.id,
    studentId: studentTasksTable.studentId,
    title: studentTasksTable.title,
    description: studentTasksTable.description,
    dueDate: studentTasksTable.dueDate,
    completedAt: studentTasksTable.completedAt,
    createdAt: studentTasksTable.createdAt,
    assignedByName: usersTable.name,
  }).from(studentTasksTable)
    .leftJoin(usersTable, eq(studentTasksTable.assignedBy, usersTable.id))
    .where(eq(studentTasksTable.studentId, params.data.studentId));

  const query = req.query as any;
  if (query.completed === "true") tasks = tasks.filter((t) => !!t.completedAt);
  if (query.completed === "false") tasks = tasks.filter((t) => !t.completedAt);

  res.json(tasks.map((t) => ({
    ...t,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  })));
});

router.post("/students/:studentId/tasks", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = CreateStudentTaskParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateStudentTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const actor = req.user as { id: number; name: string };
  const [task] = await db
    .insert(studentTasksTable)
    .values({ studentId: params.data.studentId, title: parsed.data.title, description: parsed.data.description ?? null, dueDate: parsed.data.dueDate ?? null, assignedBy: actor.id })
    .returning();

  res.status(201).json({ ...task, completedAt: null, createdAt: task.createdAt.toISOString(), assignedByName: actor.name });
});

router.patch("/students/:studentId/tasks/:taskId", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = UpdateStudentTaskParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateStudentTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: any = { ...parsed.data };
  if (parsed.data.completedAt !== undefined) {
    updateData.completedAt = parsed.data.completedAt ? new Date(parsed.data.completedAt) : null;
  }

  const [task] = await db
    .update(studentTasksTable)
    .set(updateData)
    .where(and(eq(studentTasksTable.id, params.data.taskId), eq(studentTasksTable.studentId, params.data.studentId)))
    .returning();

  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const [assigner] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, task.assignedBy ?? -1)).limit(1);
  res.json({ ...task, completedAt: task.completedAt?.toISOString() ?? null, createdAt: task.createdAt.toISOString(), assignedByName: assigner?.name ?? null });
});

router.delete("/students/:studentId/tasks/:taskId", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = DeleteStudentTaskParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(studentTasksTable).where(and(eq(studentTasksTable.id, params.data.taskId), eq(studentTasksTable.studentId, params.data.studentId)));
  res.sendStatus(204);
});

// ─── FORM RESPONSES ──────────────────────────────────────────────────────────
router.get("/students/:studentId/forms", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = ListStudentFormsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let forms = await db.select().from(formResponsesTable).where(eq(formResponsesTable.studentId, params.data.studentId));
  const query = req.query as any;
  if (query.formType) forms = forms.filter((f) => f.formType === query.formType);

  res.json(forms.sort((a, b) => b.respondedAt.getTime() - a.respondedAt.getTime()).map((f) => ({
    ...f,
    respondedAt: f.respondedAt.toISOString(),
  })));
});

router.post("/students/:studentId/forms", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = CreateStudentFormParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateStudentFormBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const actor = req.user as { id: number; name: string };
  const [form] = await db
    .insert(formResponsesTable)
    .values({
      studentId: params.data.studentId,
      formType: parsed.data.formType as any,
      responseData: parsed.data.responseData ?? null,
      areaScores: parsed.data.areaScores ?? null,
      respondedAt: parsed.data.respondedAt ? new Date(parsed.data.respondedAt) : new Date(),
    })
    .returning();

  await logActivity({ userId: actor.id, action: "add_form_response", entityType: "form_response", entityId: form.id, entityLabel: parsed.data.formType });

  res.status(201).json({ ...form, respondedAt: form.respondedAt.toISOString() });
});

// ─── FILES ────────────────────────────────────────────────────────────────────
router.get("/students/:studentId/files", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = ListStudentFilesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let files = await db.select({
    id: studentFilesTable.id,
    studentId: studentFilesTable.studentId,
    fileName: studentFilesTable.fileName,
    fileType: studentFilesTable.fileType,
    storageKey: studentFilesTable.storageKey,
    fileSize: studentFilesTable.fileSize,
    uploadedAt: studentFilesTable.uploadedAt,
    uploadedByName: usersTable.name,
  }).from(studentFilesTable)
    .leftJoin(usersTable, eq(studentFilesTable.uploadedBy, usersTable.id))
    .where(eq(studentFilesTable.studentId, params.data.studentId));

  const query = req.query as any;
  if (query.fileType) files = files.filter((f) => f.fileType === query.fileType);

  const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR ?? "/objects";
  res.json(files.map((f) => ({
    ...f,
    downloadUrl: `${PRIVATE_DIR}/${f.storageKey}`,
    uploadedAt: f.uploadedAt.toISOString(),
  })));
});

router.post("/students/:studentId/files", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = RegisterStudentFileParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = RegisterStudentFileBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const actor = req.user as { id: number; name: string };
  const [file] = await db
    .insert(studentFilesTable)
    .values({
      studentId: params.data.studentId,
      fileName: parsed.data.fileName,
      fileType: parsed.data.fileType as any,
      storageKey: parsed.data.storageKey,
      fileSize: parsed.data.fileSize ?? null,
      uploadedBy: actor.id,
    })
    .returning();

  await logActivity({ userId: actor.id, action: "upload_file", entityType: "student_file", entityId: file.id, entityLabel: parsed.data.fileName });

  const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR ?? "/objects";
  res.status(201).json({ ...file, downloadUrl: `${PRIVATE_DIR}/${file.storageKey}`, uploadedAt: file.uploadedAt.toISOString(), uploadedByName: actor.name });
});

router.delete("/students/:studentId/files/:fileId", requireAuth, requireStudentsAccess, async (req, res): Promise<void> => {
  const params = DeleteStudentFileParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const actor = req.user as { id: number; name: string };
  const [file] = await db.delete(studentFilesTable).where(and(eq(studentFilesTable.id, params.data.fileId), eq(studentFilesTable.studentId, params.data.studentId))).returning();
  if (!file) { res.status(404).json({ error: "File not found" }); return; }

  await logActivity({ userId: actor.id, action: "delete_file", entityType: "student_file", entityId: file.id, entityLabel: file.fileName });
  res.sendStatus(204);
});

// ─── CLIENT PORTAL ────────────────────────────────────────────────────────────
router.get("/me/portal", requireAuth, async (req, res): Promise<void> => {
  const user = req.user as { id: number; role: string };
  if (user.role !== "CLIENT") { res.status(403).json({ error: "Portal only available for CLIENT users" }); return; }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.userId, user.id)).limit(1);
  if (!student) { res.status(404).json({ error: "No student record linked to your account" }); return; }

  const [enriched, stages, sessions, tasks, forms, files] = await Promise.all([
    enrichStudent(student),
    db.select().from(trailStagesTable).where(eq(trailStagesTable.studentId, student.id)),
    db.select().from(sessionsTable).where(eq(sessionsTable.studentId, student.id)),
    db.select({
      id: studentTasksTable.id,
      studentId: studentTasksTable.studentId,
      title: studentTasksTable.title,
      description: studentTasksTable.description,
      dueDate: studentTasksTable.dueDate,
      completedAt: studentTasksTable.completedAt,
      createdAt: studentTasksTable.createdAt,
      assignedByName: usersTable.name,
    }).from(studentTasksTable).leftJoin(usersTable, eq(studentTasksTable.assignedBy, usersTable.id)).where(eq(studentTasksTable.studentId, student.id)),
    db.select().from(formResponsesTable).where(eq(formResponsesTable.studentId, student.id)),
    db.select({
      id: studentFilesTable.id,
      studentId: studentFilesTable.studentId,
      fileName: studentFilesTable.fileName,
      fileType: studentFilesTable.fileType,
      storageKey: studentFilesTable.storageKey,
      fileSize: studentFilesTable.fileSize,
      uploadedAt: studentFilesTable.uploadedAt,
      uploadedByName: usersTable.name,
    }).from(studentFilesTable).leftJoin(usersTable, eq(studentFilesTable.uploadedBy, usersTable.id)).where(eq(studentFilesTable.studentId, student.id)),
  ]);

  const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR ?? "/objects";

  res.json({
    student: enriched,
    stages: stages.sort((a, b) => a.stageIndex - b.stageIndex).map((s) => ({ ...s, completedAt: s.completedAt?.toISOString() ?? null })),
    sessions: sessions.sort((a, b) => b.sessionNumber - a.sessionNumber).map((s) => ({ ...s, scheduledAt: s.scheduledAt?.toISOString() ?? null, conductedAt: s.conductedAt?.toISOString() ?? null, createdAt: s.createdAt.toISOString() })),
    tasks: tasks.map((t) => ({ ...t, completedAt: t.completedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() })),
    forms: forms.sort((a, b) => b.respondedAt.getTime() - a.respondedAt.getTime()).map((f) => ({ ...f, respondedAt: f.respondedAt.toISOString() })),
    files: files.map((f) => ({ ...f, downloadUrl: `${PRIVATE_DIR}/${f.storageKey}`, uploadedAt: f.uploadedAt.toISOString() })),
  });
});

export default router;
