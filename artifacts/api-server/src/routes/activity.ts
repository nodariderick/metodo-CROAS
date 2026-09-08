import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, activityLogTable, usersTable } from "@workspace/db";
import { ListActivityLogQueryParams } from "@workspace/api-zod";
import { requireAuth, requireMaster } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/activity", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = ListActivityLogQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = params.data.limit ?? 50;
  const filterUserId = params.data.userId ?? null;

  let rows;
  if (filterUserId) {
    rows = await db
      .select({
        id: activityLogTable.id,
        userId: activityLogTable.userId,
        userName: usersTable.name,
        userAvatarUrl: usersTable.avatarUrl,
        action: activityLogTable.action,
        entityType: activityLogTable.entityType,
        entityId: activityLogTable.entityId,
        entityLabel: activityLogTable.entityLabel,
        metadata: activityLogTable.metadata,
        createdAt: activityLogTable.createdAt,
      })
      .from(activityLogTable)
      .leftJoin(usersTable, eq(activityLogTable.userId, usersTable.id))
      .where(eq(activityLogTable.userId, filterUserId))
      .orderBy(desc(activityLogTable.createdAt))
      .limit(limit);
  } else {
    rows = await db
      .select({
        id: activityLogTable.id,
        userId: activityLogTable.userId,
        userName: usersTable.name,
        userAvatarUrl: usersTable.avatarUrl,
        action: activityLogTable.action,
        entityType: activityLogTable.entityType,
        entityId: activityLogTable.entityId,
        entityLabel: activityLogTable.entityLabel,
        metadata: activityLogTable.metadata,
        createdAt: activityLogTable.createdAt,
      })
      .from(activityLogTable)
      .leftJoin(usersTable, eq(activityLogTable.userId, usersTable.id))
      .orderBy(desc(activityLogTable.createdAt))
      .limit(limit);
  }

  res.json(rows);
});

export default router;
