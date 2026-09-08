import { Router, type IRouter } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, permissionsTable, usersTable } from "@workspace/db";
import { SetPermissionParams, SetPermissionBody } from "@workspace/api-zod";
import { requireAuth, requireMaster } from "../middlewares/auth";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

const ALL_MODULES = [
  "dashboard",
  "finance",
  "students",
  "files",
  "commercial",
  "team",
  "calendar",
] as const;

// Get full permissions matrix — returns ALL users × ALL modules (synthesizes NONE for missing rows)
router.get("/permissions/matrix", requireAuth, requireMaster, async (_req, res): Promise<void> => {
  // Get all non-MASTER users
  const nonMasterUsers = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(ne(usersTable.role, "MASTER"));

  // Get all existing permission rows
  const existingRows = await db
    .select({
      id: permissionsTable.id,
      userId: permissionsTable.userId,
      module: permissionsTable.module,
      level: permissionsTable.level,
    })
    .from(permissionsTable);

  // Build a lookup map: userId:module → {id, level}
  const lookup = new Map<string, { id: number; level: string }>();
  for (const row of existingRows) {
    lookup.set(`${row.userId}:${row.module}`, { id: row.id, level: row.level });
  }

  // Synthesize the full matrix
  const matrix = [];
  let syntheticId = -1;
  for (const user of nonMasterUsers) {
    for (const module of ALL_MODULES) {
      const key = `${user.id}:${module}`;
      const existing = lookup.get(key);
      matrix.push({
        id: existing?.id ?? syntheticId--,
        userId: user.id,
        userName: user.name,
        module,
        level: existing?.level ?? "NONE",
      });
    }
  }

  res.json(matrix);
});

// Set permission for userId + module
router.put(
  "/permissions/:userId/:module",
  requireAuth,
  requireMaster,
  async (req, res): Promise<void> => {
    const params = SetPermissionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SetPermissionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const actor = req.user as { id: number; name: string };
    const { userId, module } = params.data;
    const { level } = parsed.data;

    // Upsert permission
    const existing = await db
      .select()
      .from(permissionsTable)
      .where(
        and(
          eq(permissionsTable.userId, userId),
          eq(permissionsTable.module, module as any),
        ),
      )
      .limit(1);

    let permission;
    if (existing.length > 0) {
      [permission] = await db
        .update(permissionsTable)
        .set({ level: level as any })
        .where(eq(permissionsTable.id, existing[0].id))
        .returning();
    } else {
      [permission] = await db
        .insert(permissionsTable)
        .values({ userId, module: module as any, level: level as any })
        .returning();
    }

    // Get user name for enriched response
    const [user] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    await logActivity({
      userId: actor.id,
      action: "set_permission",
      entityType: "permission",
      entityId: userId,
      entityLabel: user?.name ?? String(userId),
      metadata: JSON.stringify({ module, level }),
    });

    res.json({ ...permission, userName: user?.name ?? null });
  },
);

export default router;
