import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { DEMO_USER_ID, ensureDemoSeeded } from "../lib/demo.js";
import { ensureProfile } from "../lib/ensureProfile.js";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

// The demo token ships in the public web bundle, so it is not a secret — the
// demo user must therefore be strictly read-only, enforced here. Demo mode is
// off unless DEMO_TOKEN is set.
const DEMO_TOKEN = process.env.DEMO_TOKEN || null;
const DEMO_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireAuth(): RequestHandler {
  return (req, res, next) => {
    const demoHeader = req.headers["x-demo-token"];
    if (DEMO_TOKEN && demoHeader === DEMO_TOKEN) {
      if (!DEMO_SAFE_METHODS.has(req.method)) {
        res.status(403).json({ error: "This is a read-only demo. Sign up to make changes." });
        return;
      }
      req.userId = DEMO_USER_ID;
      // The first demo request seeds the demo home; later ones resolve at once.
      ensureDemoSeeded().then(() => next(), next);
      return;
    }

    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.userId = userId;
    // Make sure the user has a profile row (needed for reminders and
    // notification preferences). Never fails the request.
    ensureProfile(userId).then(() => next(), () => next());
  };
}
