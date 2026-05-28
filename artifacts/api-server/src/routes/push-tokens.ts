import { Router } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

const RegisterBody = z.object({
  token: z.string().min(1),
  platform: z.string().optional(),
});

router.post("/push-tokens", requireAuth(), async (req, res) => {
  const { token, platform } = RegisterBody.parse(req.body);

  await db
    .insert(pushTokensTable)
    .values({ userId: req.userId, token, platform: platform ?? null })
    .onConflictDoUpdate({
      target: pushTokensTable.token,
      set: { userId: req.userId },
    });

  res.json({ ok: true });
});

router.delete("/push-tokens", requireAuth(), async (req, res) => {
  const { token } = RegisterBody.parse(req.body);

  await db
    .delete(pushTokensTable)
    .where(and(eq(pushTokensTable.userId, req.userId), eq(pushTokensTable.token, token)));

  res.json({ ok: true });
});

export default router;
