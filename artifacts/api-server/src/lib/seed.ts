import {
  db,
  usersTable,
  permissionsTable,
  activityLogTable,
  plansTable,
  studentsTable,
  trailStagesTable,
  leadsTable,
  commercialGoalsTable,
  teamTasksTable,
  teamGoalsTable,
  capacitySettingsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const PADRAO_STAGES = [
  "Onboarding & Alinhamento",
  "Anamnese Completa",
  "Definição de Objetivos",
  "Metas SMART",
  "Revisão Mês 1",
  "Revisão Mês 2",
  "Revisão Mês 3",
  "Encerramento",
];

const PREMIUM_STAGES = [
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
];

const _now = new Date();
const daysAgo = (n: number) => new Date(_now.getTime() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n: number) => new Date(_now.getTime() + n * 24 * 60 * 60 * 1000);

export async function seedInitialData() {
  // ─── 1. MASTER user ───────────────────────────────────────────────────────
  const [masterRow] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "derick@croas.com.br"))
    .limit(1);

  let masterId: number;
  if (!masterRow) {
    logger.info("Seeding MASTER user");
    const [master] = await db
      .insert(usersTable)
      .values({ name: "Derick Nodari", email: "derick@croas.com.br", role: "MASTER", isActive: true })
      .returning();
    masterId = master.id;
    await db.insert(activityLogTable).values({
      userId: masterId,
      action: "system_seed",
      entityType: "system",
      entityLabel: "CROAS OS initialized",
    });
    logger.info({ userId: masterId }, "MASTER seeded");
  } else {
    masterId = masterRow.id;
  }

  // ─── 2. COLLABORATOR — Ana ────────────────────────────────────────────────
  const [anaRow] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "ana@croas.com.br"))
    .limit(1);

  let anaId: number;
  if (!anaRow) {
    const [ana] = await db
      .insert(usersTable)
      .values({ name: "Ana Suporte", email: "ana@croas.com.br", role: "COLLABORATOR", isActive: true })
      .returning();
    anaId = ana.id;
    logger.info({ userId: anaId }, "COLLABORATOR Ana seeded");
  } else {
    anaId = anaRow.id;
  }

  for (const [module, level] of [
    ["students", "READ"],
    ["files", "READ"],
    ["calendar", "READ"],
    ["team", "WRITE"],
  ] as const) {
    await db
      .insert(permissionsTable)
      .values({ userId: anaId, module, level })
      .onConflictDoNothing();
  }

  // ─── 3. COLLABORATOR — Carlos ─────────────────────────────────────────────
  const [carlosRow] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "carlos@croas.com.br"))
    .limit(1);

  let carlosId: number;
  if (!carlosRow) {
    const [carlos] = await db
      .insert(usersTable)
      .values({ name: "Carlos Comercial", email: "carlos@croas.com.br", role: "COLLABORATOR", isActive: true })
      .returning();
    carlosId = carlos.id;
    logger.info({ userId: carlosId }, "COLLABORATOR Carlos seeded");
  } else {
    carlosId = carlosRow.id;
  }

  for (const [module, level] of [
    ["commercial", "WRITE"],
    ["students", "READ"],
    ["team", "WRITE"],
  ] as const) {
    await db
      .insert(permissionsTable)
      .values({ userId: carlosId, module, level })
      .onConflictDoNothing();
  }

  // ─── 4. CLIENT — Maria ────────────────────────────────────────────────────
  const [mariaRow] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "maria@croas.com.br"))
    .limit(1);

  let mariaId: number;
  if (!mariaRow) {
    const [maria] = await db
      .insert(usersTable)
      .values({ name: "Maria Silva", email: "maria@croas.com.br", role: "CLIENT", isActive: true })
      .returning();
    mariaId = maria.id;
    logger.info({ userId: mariaId }, "CLIENT Maria seeded");
  } else {
    mariaId = mariaRow.id;
  }

  // ─── 5. Plans ─────────────────────────────────────────────────────────────
  let padraoId: number;
  let premiumId: number;

  const [padraoRow] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.name, "Padrão"))
    .limit(1);

  if (!padraoRow) {
    const [p] = await db
      .insert(plansTable)
      .values({ name: "Padrão", description: "Mentoria individual com 8 etapas estruturadas de 4 meses", stageCount: 8 })
      .returning();
    padraoId = p.id;
  } else {
    padraoId = padraoRow.id;
  }

  const [premiumRow] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.name, "Premium"))
    .limit(1);

  if (!premiumRow) {
    const [p] = await db
      .insert(plansTable)
      .values({ name: "Premium", description: "Mentoria intensiva com 12 etapas estruturadas de 6 meses", stageCount: 12 })
      .returning();
    premiumId = p.id;
  } else {
    premiumId = premiumRow.id;
  }

  // ─── 6. Sample students ───────────────────────────────────────────────────
  const [mariaStudentRow] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.email, "maria@croas.com.br"))
    .limit(1);

  if (!mariaStudentRow) {
    const [student] = await db
      .insert(studentsTable)
      .values({
        userId: mariaId,
        planId: padraoId,
        fullName: "Maria Silva",
        email: "maria@croas.com.br",
        phone: "+55 11 99999-0001",
        startDate: "2026-05-01",
        notes: "Aluna comprometida, foco em transição de carreira.",
        isActive: true,
      })
      .returning();

    // Trail stages for Maria (2 complete, 1 in_progress, rest pending)
    await db.insert(trailStagesTable).values(
      PADRAO_STAGES.map((title, idx) => ({
        studentId: student.id,
        stageIndex: idx,
        title,
        status: (idx < 2 ? "complete" : idx === 2 ? "in_progress" : "pending") as any,
        completedAt: idx < 2 ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null,
      })),
    );
    logger.info({ studentId: student.id }, "Maria student seeded");
  }

  const [rafaelRow] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.email, "rafael@empresa.com.br"))
    .limit(1);

  if (!rafaelRow) {
    const [student] = await db
      .insert(studentsTable)
      .values({
        planId: premiumId,
        fullName: "Rafael Moreira",
        email: "rafael@empresa.com.br",
        phone: "+55 11 98888-0002",
        startDate: "2026-04-01",
        notes: "Empresário, objetivo de escalar a empresa para 7 dígitos.",
        isActive: true,
      })
      .returning();

    // Trail stages for Rafael (5 complete, 1 in_progress, rest pending)
    await db.insert(trailStagesTable).values(
      PREMIUM_STAGES.map((title, idx) => ({
        studentId: student.id,
        stageIndex: idx,
        title,
        status: (idx < 5 ? "complete" : idx === 5 ? "in_progress" : "pending") as any,
        completedAt: idx < 5 ? new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) : null,
      })),
    );
    logger.info({ studentId: student.id }, "Rafael student seeded");
  }

  // ─── 7. Sample leads ──────────────────────────────────────────────────────
  const leadCount = await db.select().from(leadsTable);
  if (leadCount.length === 0) {
    const leadsData: (typeof leadsTable.$inferInsert)[] = [
      { fullName: "Fernanda Costa",   email: "fernanda@gmail.com",           phone: "+55 11 91234-5678", origin: "instagram", stage: "lead",           assignedToId: masterId,  notes: "Comentou no post sobre transformação de carreira", nextFollowUpAt: daysFromNow(1), createdAt: daysAgo(3) },
      { fullName: "Bruno Almeida",    email: "bruno.almeida@hotmail.com",    phone: "+55 21 98765-4321", origin: "instagram", stage: "lead",           assignedToId: masterId,  notes: "DM sobre o programa Premium",                      nextFollowUpAt: daysFromNow(0), createdAt: daysAgo(1) },
      { fullName: "Juliana Martins",  email: "jmartins@empresa.com.br",      phone: "+55 11 97654-3210", origin: "indicacao", stage: "lead",           assignedToId: carlosId,  notes: "Indicada pela Maria Silva",                        nextFollowUpAt: daysFromNow(2), createdAt: daysAgo(2) },
      { fullName: "Ricardo Ferreira", email: "ricardo@consultoria.com",      phone: "+55 11 99876-5432", origin: "palestra",  stage: "call_agendada",  assignedToId: masterId,  notes: "Participou da palestra em São Paulo",              nextFollowUpAt: daysFromNow(0), createdAt: daysAgo(7),  proposalValue: 1200000 },
      { fullName: "Camila Torres",    email: "camila.torres@gmail.com",      phone: "+55 31 98765-1234", origin: "indicacao", stage: "call_agendada",  assignedToId: masterId,  notes: "Empresária no setor de beleza",                    nextFollowUpAt: daysFromNow(1), createdAt: daysAgo(10), proposalValue: 800000 },
      { fullName: "Thiago Santos",    email: "thiago.santos@empresa.com",    phone: "+55 11 95555-4444", origin: "parceria",  stage: "call_realizada", assignedToId: masterId,  notes: "Call de 1h30. Precisa de proposta Premium",        nextFollowUpAt: daysFromNow(3), createdAt: daysAgo(14), proposalValue: 1500000, lastContactAt: daysAgo(2) },
      { fullName: "Patricia Rocha",   email: "patricia@rocha.com.br",        phone: "+55 21 97777-8888", origin: "instagram", stage: "call_realizada", assignedToId: carlosId,  notes: "Aguardando proposta formal",                       nextFollowUpAt: daysFromNow(2), createdAt: daysAgo(18), proposalValue: 800000,  lastContactAt: daysAgo(4) },
      { fullName: "Alexandre Lima",   email: "alex@limainvestimentos.com",   phone: "+55 11 93333-2222", origin: "indicacao", stage: "proposta",       assignedToId: masterId,  notes: "Proposta enviada. Aguardando retorno",             nextFollowUpAt: daysFromNow(0), createdAt: daysAgo(21), proposalValue: 1500000, lastContactAt: daysAgo(1) },
      { fullName: "Vanessa Cardoso",  email: "vanessa.cardoso@gmail.com",    phone: "+55 11 94444-3333", origin: "palestra",  stage: "proposta",       assignedToId: masterId,  notes: "Quer parcelar em 4x",                              nextFollowUpAt: daysFromNow(1), createdAt: daysAgo(25), proposalValue: 800000,  lastContactAt: daysAgo(3) },
      { fullName: "Eduardo Souza",    email: "eduardo@souza.com",            phone: "+55 11 92222-1111", origin: "parceria",  stage: "fechado",        assignedToId: masterId,  notes: "Fechou Premium. Pagamento à vista.",               createdAt: daysAgo(30),         proposalValue: 1500000, lastContactAt: daysAgo(7) },
      { fullName: "Marcos Vieira",    email: "marcos@vieira.com",            phone: "+55 21 96666-5555", origin: "instagram", stage: "perdido",        assignedToId: carlosId,  notes: "Preço acima do orçamento disponível",              createdAt: daysAgo(35),         proposalValue: 800000,  lastContactAt: daysAgo(15) },
    ];

    await db.insert(leadsTable).values(leadsData);
    logger.info({ count: leadsData.length }, "Sample leads seeded");
  }

  // ─── 8. Commercial goal for current month ─────────────────────────────────
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [goalRow] = await db
    .select()
    .from(commercialGoalsTable)
    .where(eq(commercialGoalsTable.year, year))
    .limit(1);

  if (!goalRow) {
    await db.insert(commercialGoalsTable).values({
      year,
      month,
      targetDeals: 4,
      targetRevenue: 4800000,
      notes: `Meta de ${month}/${year}`,
    });
    logger.info({ year, month }, "Commercial goal seeded");
  }

  // ─── 9. Capacity settings for MASTER ─────────────────────────────────────
  const [capRow] = await db
    .select()
    .from(capacitySettingsTable)
    .where(eq(capacitySettingsTable.userId, masterId))
    .limit(1);

  if (!capRow) {
    await db.insert(capacitySettingsTable).values({ userId: masterId, weeklySessionCapacity: 20 });
    logger.info("Capacity settings seeded");
  }

  // ─── 10. Sample team tasks ────────────────────────────────────────────────
  const [taskRow] = await db.select().from(teamTasksTable).limit(1);
  if (!taskRow) {
    const teamTasksData = [
      { title: "Preparar relatório mensal de alunos",    assignedToId: anaId,    assignedById: masterId, dueDate: daysFromNow(3).toISOString().slice(0, 10),  status: "pending" as const,     notes: "Incluir progresso de trilha e recebíveis em aberto" },
      { title: "Atualizar materiais de onboarding",      assignedToId: carlosId, assignedById: masterId, dueDate: daysFromNow(7).toISOString().slice(0, 10),  status: "in_progress" as const, notes: "Revisar slides e PDFs do mês anterior" },
      { title: "Contatar leads sem follow-up há 7 dias", assignedToId: anaId,    assignedById: masterId, dueDate: daysFromNow(1).toISOString().slice(0, 10),  status: "pending" as const,     notes: null },
      { title: "Organizar agenda de chamadas de Mayo",   assignedToId: carlosId, assignedById: masterId, dueDate: daysFromNow(0).toISOString().slice(0, 10),  status: "done" as const,        completedAt: daysAgo(1), notes: null },
      { title: "Responder dúvidas no grupo de WhatsApp", assignedToId: anaId,    assignedById: masterId, dueDate: daysAgo(2).toISOString().slice(0, 10),      status: "pending" as const,     notes: "ATRASADA — prioridade alta" },
    ];
    await db.insert(teamTasksTable).values(teamTasksData);
    logger.info({ count: teamTasksData.length }, "Team tasks seeded");
  }

  // ─── 11. Sample team goals ────────────────────────────────────────────────
  const [goalTeamRow] = await db.select().from(teamGoalsTable).limit(1);
  if (!goalTeamRow) {
    const nowGoal = new Date();
    const goalYear = nowGoal.getFullYear();
    const goalMonth = nowGoal.getMonth() + 1;
    await db.insert(teamGoalsTable).values([
      { userId: anaId,    year: goalYear, month: goalMonth, targetTasks: 8,  notes: "Meta mensal de tarefas — Ana" },
      { userId: carlosId, year: goalYear, month: goalMonth, targetTasks: 6,  notes: "Meta mensal de tarefas — Carlos" },
    ]);
    logger.info("Team goals seeded");
  }

  logger.info("Seed complete");
}
