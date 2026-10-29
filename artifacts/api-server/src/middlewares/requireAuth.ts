import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

// The demo token ships in the public web bundle, so it is not a secret — the
// demo user must therefore be strictly read-only, enforced here.
const DEMO_TOKEN = process.env.DEMO_TOKEN || "casa-demo-preview-2025";
const DEMO_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireAuth(): RequestHandler {
  return (req, res, next) => {
    const demoHeader = req.headers["x-demo-token"];
    if (demoHeader === DEMO_TOKEN) {
      if (!DEMO_SAFE_METHODS.has(req.method)) {
        res.status(403).json({ error: "This is a read-only demo. Sign up to make changes." });
        return;
      }
      req.userId = "demo-user";
      return next();
    }

    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.userId = userId;
    next();
  };
}
