import { db } from "@workspace/db";
import { activityLogTable } from "@workspace/db";
import { logger } from "./logger";

export async function logActivity(opts: {
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  entityLabel?: string | null;
  metadata?: string | null;
}) {
  try {
    await db.insert(activityLogTable).values({
      userId: opts.userId ?? null,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      entityLabel: opts.entityLabel ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write activity log");
  }
}
