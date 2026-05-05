import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

const DEMO_TOKEN = process.env.DEMO_TOKEN || "casa-demo-preview-2025";

export function requireAuth(): RequestHandler {
  return (req, res, next) => {
    // Demo mode: read-only access with demo token header
    const demoHeader = req.headers["x-demo-token"];
    if (demoHeader === DEMO_TOKEN) {
      if (req.method !== "GET") {
        return res.status(403).json({ error: "Demo mode is read-only" });
      }
      req.userId = "demo-user";
      return next();
    }

    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.userId = userId;
    next();
  };
}
