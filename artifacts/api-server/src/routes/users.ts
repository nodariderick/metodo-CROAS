import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { toPublicUser } from "../lib/public-user";
import {
  ListUsersQueryParams,
  CreateUserBody,
  GetUserParams,
  UpdateUserParams,
  UpdateUserBody,
  DeleteUserParams,
} from "@workspace/api-zod";
import { requireAuth, requireMaster } from "../middlewares/auth";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

// List users
router.get("/users", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(usersTable);
  if (params.data.role) {
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, params.data.role as "MASTER" | "COLLABORATOR" | "CLIENT"));
    res.json(users.map(toPublicUser));
    return;
  }

  const users = await query;
  res.json(users.map(toPublicUser));
});

// Users summary
router.get("/users/summary", requireAuth, requireMaster, async (_req, res): Promise<void> => {
  const allUsers = await db.select().from(usersTable);
  const summary = {
    total: allUsers.length,
    masters: allUsers.filter((u) => u.role === "MASTER").length,
    collaborators: allUsers.filter((u) => u.role === "COLLABORATOR").length,
    clients: allUsers.filter((u) => u.role === "CLIENT").length,
  };
  res.json(summary);
});

// Get single user
router.get("/users/:id", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(toPublicUser(user));
});

// Create user
router.post("/users", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const actor = req.user as { id: number; name: string };
  const [user] = await db.insert(usersTable).values(parsed.data).returning();
  await logActivity({
    userId: actor.id,
    action: "create_user",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.name,
  });
  res.status(201).json(toPublicUser(user));
});

// Update user
router.patch("/users/:id", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const actor = req.user as { id: number; name: string };
  const [user] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, params.data.id))
    .returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await logActivity({
    userId: actor.id,
    action: "update_user",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.name,
    metadata: JSON.stringify(parsed.data),
  });
  res.json(toPublicUser(user));
});

// Delete user
router.delete("/users/:id", requireAuth, requireMaster, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const actor = req.user as { id: number; name: string };
  const [user] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, params.data.id))
    .returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await logActivity({
    userId: actor.id,
    action: "delete_user",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.name,
  });
  res.sendStatus(204);
});

export default router;
