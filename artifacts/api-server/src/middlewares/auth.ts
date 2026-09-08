import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireMaster(req: Request, res: Response, next: NextFunction): void {
  const user = req.user as { role?: string } | undefined;
  if (!user || user.role !== "MASTER") {
    res.status(403).json({ error: "Forbidden: Master access required" });
    return;
  }
  next();
}
