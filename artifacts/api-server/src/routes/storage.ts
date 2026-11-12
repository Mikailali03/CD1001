import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { db, lockerFilesTable, ownershipClaimsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError, UploadRejectedError } from "../lib/objectStorage";
import { acceptLocalUpload, LocalUploadError } from "../lib/storageDrivers.js";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "../lib/uploadValidation.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { canReadObject } from "../lib/objectAccess.js";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/** Public origin of this API as the client reached it, for upload URLs served by the API itself. */
function apiOrigin(req: Request): string {
  const host = req.get("x-forwarded-host")?.split(",")[0].trim() || req.get("host");
  const proto = req.get("x-forwarded-proto")?.split(",")[0].trim() || req.protocol;
  return `${proto}://${host}`;
}

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
  // Declared by the client, so this only catches honest mistakes early. The
  // real size and type are checked from the stored bytes (verifyUpload) before
  // a file is attached or served, and anything that fails is deleted.
  if (size > MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: "File is too large (max 25 MB)" });
    return;
  }
  if (!ALLOWED_UPLOAD_TYPES.test(contentType)) {
    res.status(415).json({ error: "Only images and PDFs can be uploaded" });
    return;
  }

  try {
    const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL(req.userId, {
      contentType,
      size,
      apiOrigin: apiOrigin(req),
    });

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
 * PUT /storage/local-uploads/:token
 *
 * Upload target when files are stored on the local disk (STORAGE_DRIVER=local),
 * standing in for a presigned cloud-storage URL. The token was signed by
 * /storage/uploads/request-url and binds the object path, Content-Type, size
 * and expiry. 404 with any other storage driver.
 */
router.put("/storage/local-uploads/:token", async (req: Request, res: Response) => {
  try {
    await acceptLocalUpload(String(req.params.token), req.get("content-type"), req);
    res.status(200).end();
  } catch (error) {
    if (error instanceof LocalUploadError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Local upload failed");
    res.status(500).json({ error: "Upload failed" });
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

    const response = await objectStorageService.downloadObject(file, 3600, "public");

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
 * Serve object entities from PRIVATE_OBJECT_DIR. Every request must carry a
 * session (Bearer token, or the Clerk session cookie that <img> tags send):
 *  - Digital Locker documents: only the user who filed them.
 *  - Property/asset photos and receipts: anyone with access to that home, or an admin.
 *  - Uploads not yet attached to anything: only the uploader (for previews).
 *  - Ownership documents: never served here.
 * Denials are 404 so a response doesn't confirm a file exists.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    // Proof-of-ownership documents are never served here; admins view them
    // through /admin/ownership-claims/:id/document, which logs each view.
    const [claimDocument] = await db
      .select({ id: ownershipClaimsTable.id })
      .from(ownershipClaimsTable)
      .where(eq(ownershipClaimsTable.documentPath, objectPath))
      .limit(1);
    if (claimDocument) {
      res.status(404).json({ error: "Object not found" });
      return;
    }

    const [lockerFile] = await db
      .select({ userId: lockerFilesTable.userId })
      .from(lockerFilesTable)
      .where(eq(lockerFilesTable.objectPath, objectPath))
      .limit(1);
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const allowed = lockerFile ? userId === lockerFile.userId : await canReadObject(objectPath, userId);
    if (!allowed) {
      res.status(404).json({ error: "Object not found" });
      return;
    }

    // Only files whose real bytes are an image or PDF under the size limit are
    // served; this also covers photos and receipts saved without a check.
    // Files that fail are refused, not deleted, so older uploads aren't lost.
    await objectStorageService.verifyUpload(objectPath, { deleteOnReject: false });
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
    if (error instanceof UploadRejectedError) {
      req.log.warn({ reason: error.reason }, "Rejected stored object that failed upload checks");
      res.status(404).json({ error: "Object not found" });
      return;
    }
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
