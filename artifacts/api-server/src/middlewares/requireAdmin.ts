import type { RequestHandler } from "express";
import { db, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function requireAdmin(): RequestHandler {
  return async (req, res, next) => {
    const profile = await db
      .select({ role: userProfilesTable.role })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, req.userId))
      .then((r) => r[0]);

    if (!profile || profile.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admin access required" });
      return;
    }
    next();
  };
}
