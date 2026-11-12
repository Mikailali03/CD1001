import { createHash, randomUUID } from "crypto";
import { Readable } from "stream";
import {
  LOCAL_DEFAULT_PRIVATE_DIR,
  LOCAL_DEFAULT_PUBLIC_PATH,
  getStorageDriver,
  type StoredObject,
} from "./storageDrivers.js";
import { SNIFF_BYTES, UploadRejectedError, judgeUpload } from "./uploadValidation.js";

export { UploadRejectedError } from "./uploadValidation.js";
export type { StoredObject } from "./storageDrivers.js";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// Custom metadata flag set once an upload's real size and type have been checked.
const VERIFIED_KEY = "verified";

const UPLOAD_URL_TTL_SEC = 900;

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr =
      process.env.PUBLIC_OBJECT_SEARCH_PATHS ||
      (getStorageDriver().kind === "local" ? LOCAL_DEFAULT_PUBLIC_PATH : "");
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0),
      ),
    );
    if (paths.length === 0) {
      throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set (comma-separated /<bucket>/<dir> paths).");
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir =
      process.env.PRIVATE_OBJECT_DIR || (getStorageDriver().kind === "local" ? LOCAL_DEFAULT_PRIVATE_DIR : "");
    if (!dir) {
      throw new Error("PRIVATE_OBJECT_DIR not set (a /<bucket>/<dir> path for private uploads).");
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<StoredObject | null> {
    const driver = getStorageDriver();
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const { bucketName, objectName } = parseObjectPath(`${searchPath}/${filePath}`);
      let object: StoredObject;
      try {
        object = driver.object(bucketName, objectName);
      } catch {
        return null; // path rejected by the driver (e.g. traversal)
      }
      if (await object.exists()) return object;
    }
    return null;
  }

  async downloadObject(
    object: StoredObject,
    cacheTtlSec: number = 3600,
    visibility: "public" | "private" = "private",
  ): Promise<Response> {
    const info = await object.stat();
    const webStream = Readable.toWeb(object.createReadStream()) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": info.contentType || "application/octet-stream",
      "Cache-Control": `${visibility}, max-age=${cacheTtlSec}`,
      // Never let a browser second-guess the type we checked.
      "X-Content-Type-Options": "nosniff",
    };
    if (info.size) headers["Content-Length"] = String(info.size);

    return new Response(webStream, { headers });
  }

  /**
   * A short-lived URL the client PUTs the file to, plus the object path to
   * save. Uploads are namespaced by a hash of the uploader's user id, so the
   * server can later tell whether an objectPath submitted by a client was
   * actually uploaded by that client (see isUploadedBy).
   */
  async getObjectEntityUploadURL(
    ownerUserId: string,
    upload: { contentType: string; size: number; apiOrigin: string },
  ): Promise<{ uploadURL: string; objectPath: string }> {
    const entityId = `uploads/${uploadOwnerKey(ownerUserId)}/${randomUUID()}`;
    const { bucketName, objectName } = parseObjectPath(`${trimSlash(this.getPrivateObjectDir())}/${entityId}`);
    const uploadURL = await getStorageDriver().signUpload({
      bucketName,
      objectName,
      contentType: upload.contentType,
      size: upload.size,
      ttlSec: UPLOAD_URL_TTL_SEC,
      apiOrigin: upload.apiOrigin,
    });
    return { uploadURL, objectPath: `/objects/${entityId}` };
  }

  async getObjectEntityFile(objectPath: string): Promise<StoredObject> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const entityId = objectPath.slice("/objects/".length);
    if (!entityId) {
      throw new ObjectNotFoundError();
    }
    const { bucketName, objectName } = parseObjectPath(`${trimSlash(this.getPrivateObjectDir())}/${entityId}`);
    let object: StoredObject;
    try {
      object = getStorageDriver().object(bucketName, objectName);
    } catch {
      throw new ObjectNotFoundError();
    }
    if (!(await object.exists())) {
      throw new ObjectNotFoundError();
    }
    return object;
  }

  /**
   * Check an upload's real size and type (not what the client declared) and
   * record the result, so it's done once per file. A file that fails throws
   * UploadRejectedError and, unless deleteOnReject is false, is deleted. Returns the verified type and size.
   */
  async verifyUpload(
    objectPath: string,
    { deleteOnReject = true }: { deleteOnReject?: boolean } = {},
  ): Promise<{ contentType: string; size: number }> {
    const object = await this.getObjectEntityFile(objectPath);
    const info = await object.stat();
    if (info.custom[VERIFIED_KEY] === "1") return { contentType: info.contentType, size: info.size };

    const head = info.size > 0 ? await readHead(object, SNIFF_BYTES) : new Uint8Array();
    const verdict = judgeUpload(info.size, head);
    if (!verdict.ok) {
      if (deleteOnReject) await object.delete().catch(() => {});
      throw new UploadRejectedError(verdict.reason);
    }
    await object.update({ contentType: verdict.contentType, custom: { [VERIFIED_KEY]: "1" } });
    return { contentType: verdict.contentType, size: info.size };
  }

  /**
   * verifyUpload for routes that attach an upload to a record: the HTTP status
   * and message to send on failure instead of throwing.
   */
  async checkUpload(
    objectPath: string,
  ): Promise<{ ok: true; contentType: string; size: number } | { ok: false; status: number; error: string }> {
    try {
      return { ok: true, ...(await this.verifyUpload(objectPath)) };
    } catch (err) {
      if (err instanceof UploadRejectedError) return { ok: false, status: err.status, error: err.message };
      if (err instanceof ObjectNotFoundError) return { ok: false, status: 400, error: "Upload the file first." };
      throw err;
    }
  }

  /** Maps a legacy `https://storage.googleapis.com/...` URL to `/objects/...`; other values pass through. */
  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
    const rawObjectPath = new URL(rawPath).pathname;
    const objectEntityDir = `${trimSlash(this.getPrivateObjectDir())}/`;
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
    return `/objects/${rawObjectPath.slice(objectEntityDir.length)}`;
  }
}

async function readHead(object: StoredObject, bytes: number): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of object.createReadStream({ start: 0, end: bytes - 1 })) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new Uint8Array(Buffer.concat(chunks).subarray(0, bytes));
}

function trimSlash(dir: string): string {
  return dir.endsWith("/") ? dir.slice(0, -1) : dir;
}

function uploadOwnerKey(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 32);
}

const UPLOAD_PATH_RE = /^\/objects\/uploads\/([0-9a-f]{32})\/[0-9a-f-]{36}$/;

/** True if `objectPath` is an upload issued to `userId` by getObjectEntityUploadURL. */
export function isUploadedBy(objectPath: string, userId: string): boolean {
  const match = UPLOAD_PATH_RE.exec(objectPath);
  return match !== null && match[1] === uploadOwnerKey(userId);
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  return {
    bucketName: pathParts[1],
    objectName: pathParts.slice(2).join("/"),
  };
}
