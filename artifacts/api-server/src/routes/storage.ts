import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { db, lockerFilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = /^(image\/[a-z0-9.+-]+|application\/pdf)$/i;

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", requireAuth(), async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { name, size, contentType } = parsed.data;
  // Declared by the client, so this is a guard against honest mistakes and
  // casual abuse rather than a hard limit on what lands in the bucket.
  if (size > MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: "File is too large (max 25 MB)" });
    return;
  }
  if (!ALLOWED_UPLOAD_TYPES.test(contentType)) {
    res.status(415).json({ error: "Only images and PDFs can be uploaded" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL(req.userId);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 *
 * Property/asset photos and receipts are served to anyone holding the link
 * (paths are unguessable UUIDs, and they're shown in plain <img> tags and
 * shared with collaborators and technicians). Digital Locker documents are
 * private: only the user who filed them can read them, and the request must
 * carry that user's session (Bearer token or Clerk session cookie).
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const [lockerFile] = await db
      .select({ userId: lockerFilesTable.userId })
      .from(lockerFilesTable)
      .where(eq(lockerFilesTable.objectPath, objectPath))
      .limit(1);
    if (lockerFile) {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (userId !== lockerFile.userId) {
        // 404 rather than 403 so the response doesn't confirm the file exists.
        res.status(404).json({ error: "Object not found" });
        return;
      }
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
