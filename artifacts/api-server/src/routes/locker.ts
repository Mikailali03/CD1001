import { Router } from "express";
import { db } from "@workspace/db";
import { lockerFoldersTable, lockerFilesTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { ObjectStorageService, isUploadedBy } from "../lib/objectStorage.js";
import { requireTier } from "../lib/subscription.js";
import { z } from "zod";

const router = Router();
const objectStorageService = new ObjectStorageService();

const CreateFolderBody = z.object({ name: z.string().min(1).max(200) });
const UpdateFolderBody = z.object({ name: z.string().min(1).max(200).optional() });
const CreateFileBody = z.object({
  name: z.string().min(1).max(500),
  objectPath: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().optional(),
  folderId: z.string().optional(),
});
const FolderParams = z.object({ folderId: z.string() });
const FileParams = z.object({ fileId: z.string() });
const UpdateFileBody = z.object({
  name: z.string().min(1).max(500).optional(),
  folderId: z.string().nullable().optional(),
});

// ── Folders ───────────────────────────────────────────────────────────────────

router.get("/locker/folders", requireAuth(), async (req, res) => {
  const folders = await db
    .select()
    .from(lockerFoldersTable)
    .where(eq(lockerFoldersTable.userId, req.userId))
    .orderBy(lockerFoldersTable.createdAt);
  res.json(folders);
});

router.post("/locker/folders", requireAuth(), requireTier("basic"), async (req, res) => {
  const parsed = CreateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [folder] = await db
    .insert(lockerFoldersTable)
    .values({ userId: req.userId, name: parsed.data.name })
    .returning();
  res.status(201).json(folder);
});

router.patch("/locker/folders/:folderId", requireAuth(), async (req, res) => {
  const parsed = UpdateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { folderId } = FolderParams.parse(req.params);
  const [existing] = await db
    .select()
    .from(lockerFoldersTable)
    .where(and(eq(lockerFoldersTable.id, folderId), eq(lockerFoldersTable.userId, req.userId)));
  if (!existing) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }
  const [folder] = await db
    .update(lockerFoldersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(lockerFoldersTable.id, folderId))
    .returning();
  res.json(folder);
});

router.delete("/locker/folders/:folderId", requireAuth(), async (req, res) => {
  const { folderId } = FolderParams.parse(req.params);
  const [existing] = await db
    .select()
    .from(lockerFoldersTable)
    .where(and(eq(lockerFoldersTable.id, folderId), eq(lockerFoldersTable.userId, req.userId)));
  if (!existing) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }
  await db.delete(lockerFoldersTable).where(eq(lockerFoldersTable.id, folderId));
  res.status(204).end();
});

// ── Files ─────────────────────────────────────────────────────────────────────

router.get("/locker/files", requireAuth(), async (req, res) => {
  const folderId = req.query.folderId as string | undefined;
  const conditions = [eq(lockerFilesTable.userId, req.userId)];
  if (folderId === "null" || folderId === "") {
    conditions.push(isNull(lockerFilesTable.folderId));
  } else if (folderId) {
    conditions.push(eq(lockerFilesTable.folderId, folderId));
  }
  const files = await db
    .select()
    .from(lockerFilesTable)
    .where(and(...conditions))
    .orderBy(lockerFilesTable.createdAt);
  res.json(files);
});

// Adding documents needs Basic+. Viewing, organising and deleting stay open so
// a user who downgrades can still get their documents back out.
router.post("/locker/files", requireAuth(), requireTier("basic"), async (req, res) => {
  const parsed = CreateFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { folderId, ...rest } = parsed.data;
  // Only objects this user uploaded may be filed, and each only once —
  // otherwise a user could claim someone else's upload and lock them out of it.
  if (!isUploadedBy(rest.objectPath, req.userId)) {
    res.status(400).json({ error: "Invalid objectPath" });
    return;
  }
  const [alreadyFiled] = await db
    .select({ id: lockerFilesTable.id })
    .from(lockerFilesTable)
    .where(eq(lockerFilesTable.objectPath, rest.objectPath))
    .limit(1);
  if (alreadyFiled) {
    res.status(409).json({ error: "File already exists" });
    return;
  }
  if (folderId) {
    const [folder] = await db
      .select()
      .from(lockerFoldersTable)
      .where(and(eq(lockerFoldersTable.id, folderId), eq(lockerFoldersTable.userId, req.userId)));
    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
  }
  const [file] = await db
    .insert(lockerFilesTable)
    .values({ ...rest, folderId: folderId ?? null, userId: req.userId })
    .returning();
  res.status(201).json(file);
});

router.patch("/locker/files/:fileId", requireAuth(), async (req, res) => {
  const parsed = UpdateFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { fileId } = FileParams.parse(req.params);
  const [existing] = await db
    .select()
    .from(lockerFilesTable)
    .where(and(eq(lockerFilesTable.id, fileId), eq(lockerFilesTable.userId, req.userId)));
  if (!existing) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const [file] = await db
    .update(lockerFilesTable)
    .set(parsed.data)
    .where(eq(lockerFilesTable.id, fileId))
    .returning();
  res.json(file);
});

router.delete("/locker/files/:fileId", requireAuth(), async (req, res) => {
  const { fileId } = FileParams.parse(req.params);
  const [existing] = await db
    .select()
    .from(lockerFilesTable)
    .where(and(eq(lockerFilesTable.id, fileId), eq(lockerFilesTable.userId, req.userId)));
  if (!existing) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  await db.delete(lockerFilesTable).where(eq(lockerFilesTable.id, fileId));
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(existing.objectPath);
    await objectFile.delete();
  } catch (err) {
    req.log.warn({ err, objectPath: existing.objectPath }, "Could not delete locker blob");
  }
  res.status(204).end();
});

export default router;
