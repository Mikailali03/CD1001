import type { RequestHandler } from "express";
import { db, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function isTechnician(userId: string): Promise<boolean> {
  const [profile] = await db
    .select({ role: userProfilesTable.role })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  return profile?.role === "technician" || profile?.role === "admin";
}

export function requireTechnician(): RequestHandler {
  return async (req, res, next) => {
    if (!(await isTechnician(req.userId))) {
      res.status(403).json({ error: "Forbidden: technician access required" });
      return;
    }
    next();
  };
}
