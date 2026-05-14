import { Router } from "express";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

const UpsertBody = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().optional(),
  role: z.enum(["homeowner", "technician"]),
  phone: z.string().optional(),
});

router.get("/user/profile", requireAuth(), async (req, res) => {
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.userId));

  if (!profile) return res.status(404).json({ error: "Profile not found" });
  res.json(profile);
});

router.put("/user/profile", requireAuth(), async (req, res) => {
  const body = UpsertBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.userId));

  let technicianNumber: string | undefined;
  if (body.role === "technician" && (!existing || !existing.technicianNumber)) {
    const digits = Math.floor(100000 + Math.random() * 900000).toString();
    technicianNumber = `TECH-${digits}`;
  } else if (existing?.technicianNumber) {
    technicianNumber = existing.technicianNumber;
  }

  const values = {
    userId: req.userId,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    role: body.role,
    phone: body.phone,
    technicianNumber: technicianNumber ?? null,
    updatedAt: new Date(),
  };

  const [profile] = await db
    .insert(userProfilesTable)
    .values({ ...values, createdAt: new Date() })
    .onConflictDoUpdate({
      target: userProfilesTable.userId,
      set: values,
    })
    .returning();

  res.json(profile);
});

export default router;
