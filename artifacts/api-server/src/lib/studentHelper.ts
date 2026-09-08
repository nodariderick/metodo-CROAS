import { eq, isNull } from "drizzle-orm";
import {
  db,
  studentsTable,
  plansTable,
  trailStagesTable,
  sessionsTable,
  studentTasksTable,
} from "@workspace/db";

export type TrailStatus = "on_track" | "delayed" | "ahead";

export function computeTrailStatus(
  stages: { status: string; dueDate: string | null }[],
): TrailStatus {
  if (stages.length === 0) return "on_track";
  const now = new Date();
  let hasDelayed = false;
  let hasInProgress = false;

  for (const stage of stages) {
    if (stage.status === "delayed") return "delayed";
    if (stage.status === "pending" && stage.dueDate && new Date(stage.dueDate) < now) {
      hasDelayed = true;
    }
    if (stage.status === "in_progress") hasInProgress = true;
  }

  if (hasDelayed) return "delayed";

  const allComplete = stages.every((s) => s.status === "complete");
  if (allComplete) return "ahead";

  return "on_track";
}

export async function enrichStudent(student: typeof studentsTable.$inferSelect) {
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, student.planId)).limit(1);
  const stages = await db
    .select()
    .from(trailStagesTable)
    .where(eq(trailStagesTable.studentId, student.id));

  const openTasks = await db
    .select()
    .from(studentTasksTable)
    .where(eq(studentTasksTable.studentId, student.id));
  const openTaskCount = openTasks.filter((t) => !t.completedAt).length;

  const sessions = await db
    .select({
      scheduledAt: sessionsTable.scheduledAt,
      conductedAt: sessionsTable.conductedAt,
    })
    .from(sessionsTable)
    .where(eq(sessionsTable.studentId, student.id));
  const lastSessionAt = sessions.reduce<Date | null>((latest, session) => {
    if (!session.conductedAt || (latest && session.conductedAt <= latest)) return latest;
    return session.conductedAt;
  }, null);

  const completedStages = stages.filter((s) => s.status === "complete").length;
  const currentStageIndex = Math.min(completedStages, (plan?.stageCount ?? 1) - 1);
  const trailStatus = computeTrailStatus(stages);

  return {
    id: student.id,
    userId: student.userId,
    fullName: student.fullName,
    email: student.email,
    phone: student.phone,
    planId: student.planId,
    planName: plan?.name ?? "—",
    currentStageIndex,
    totalStages: plan?.stageCount ?? 0,
    nextSessionAt: student.nextSessionAt?.toISOString() ?? null,
    sessionCount: sessions.length,
    lastSessionAt: lastSessionAt?.toISOString() ?? null,
    openTaskCount,
    trailStatus,
    startDate: student.startDate,
    notes: student.notes,
    isActive: student.isActive,
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt?.toISOString() ?? student.createdAt.toISOString(),
  };
}
