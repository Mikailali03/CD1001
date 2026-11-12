// Object storage drivers. The app stores files under paths like
// `/<bucket>/<object>` (PRIVATE_OBJECT_DIR, PUBLIC_OBJECT_SEARCH_PATHS); the
// driver decides where those live:
//  - gcs:    Google Cloud Storage directly, with standard Google credentials
//            (GOOGLE_APPLICATION_CREDENTIALS, GCS_CREDENTIALS_JSON, or ADC).
//  - replit: GCS through the Replit sidecar (the original setup).
//  - local:  files on disk under LOCAL_STORAGE_DIR, for local development.
//            Uploads go through the API itself (PUT /api/storage/local-uploads).
import { Storage, type File } from "@google-cloud/storage";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { MAX_UPLOAD_BYTES } from "./uploadValidation.js";

export type StorageDriverKind = "gcs" | "replit" | "local";

export interface ObjectStat {
  size: number;
  contentType: string;
  /** App-defined metadata, e.g. { verified: "1" }. */
  custom: Record<string, string>;
}

export interface StoredObject {
  readonly name: string;
  exists(): Promise<boolean>;
  stat(): Promise<ObjectStat>;
  update(patch: { contentType?: string; custom?: Record<string, string> }): Promise<void>;
  createReadStream(range?: { start: number; end: number }): Readable;
  delete(): Promise<void>;
}

export interface SignUploadParams {
  bucketName: string;
  objectName: string;
  /** Declared by the client; drivers that can, bind the upload to it. */
  contentType: string;
  size: number;
  ttlSec: number;
  /** Public origin of this API (e.g. https://host), for drivers that upload through it. */
  apiOrigin: string;
}

export interface StorageDriver {
  readonly kind: StorageDriverKind;
  object(bucketName: string, objectName: string): StoredObject;
  signUpload(params: SignUploadParams): Promise<string>;
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

const KINDS: readonly StorageDriverKind[] = ["gcs", "replit", "local"];

/**
 * Which driver to use. STORAGE_DRIVER wins; otherwise Replit uses its sidecar,
 * a host with Google credentials uses GCS, and development falls back to the
 * local disk. Production with nothing configured is an error.
 */
export function selectStorageDriverKind(env: NodeJS.ProcessEnv = process.env): StorageDriverKind {
  const explicit = env.STORAGE_DRIVER?.trim().toLowerCase();
  if (explicit) {
    if ((KINDS as readonly string[]).includes(explicit)) return explicit as StorageDriverKind;
    throw new Error(`Unknown STORAGE_DRIVER "${env.STORAGE_DRIVER}" (expected ${KINDS.join(", ")})`);
  }
  if (env.REPL_ID) return "replit";
  if (env.GOOGLE_APPLICATION_CREDENTIALS || env.GCS_CREDENTIALS_JSON) return "gcs";
  if (env.NODE_ENV !== "production") return "local";
  throw new Error(
    "No object storage configured. Set STORAGE_DRIVER (gcs or local), or GOOGLE_APPLICATION_CREDENTIALS for GCS.",
  );
}

let driver: StorageDriver | null = null;

/** The process-wide driver, created on first use (so the server boots without storage). */
export function getStorageDriver(): StorageDriver {
  if (driver) return driver;
  const kind = selectStorageDriverKind();
  driver = kind === "local" ? new LocalDriver(localStorageRoot()) : new GcsDriver(kind);
  return driver;
}

/** Default bucket paths when running on the local disk without explicit config. */
export const LOCAL_DEFAULT_PRIVATE_DIR = "/local/private";
export const LOCAL_DEFAULT_PUBLIC_PATH = "/local/public";

// ---------------------------------------------------------------------------
// GCS (direct or via the Replit sidecar)
// ---------------------------------------------------------------------------

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function createGcsClient(kind: "gcs" | "replit"): Storage {
  if (kind === "replit") {
    return new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: { type: "json", subject_token_field_name: "access_token" },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
  }
  const inline = process.env.GCS_CREDENTIALS_JSON;
  return new Storage({
    projectId: process.env.GCS_PROJECT_ID || undefined,
    ...(inline ? { credentials: JSON.parse(inline) } : {}),
  });
}

class GcsObject implements StoredObject {
  constructor(private readonly file: File) {}

  get name(): string {
    return this.file.name;
  }

  async exists(): Promise<boolean> {
    const [exists] = await this.file.exists();
    return exists;
  }

  async stat(): Promise<ObjectStat> {
    const [metadata] = await this.file.getMetadata();
    const custom: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadata.metadata ?? {})) {
      if (v != null) custom[k] = String(v);
    }
    return {
      size: Number(metadata.size ?? 0),
      contentType: (metadata.contentType as string) || "application/octet-stream",
      custom,
    };
  }

  async update(patch: { contentType?: string; custom?: Record<string, string> }): Promise<void> {
    await this.file.setMetadata({
      ...(patch.contentType ? { contentType: patch.contentType } : {}),
      ...(patch.custom ? { metadata: patch.custom } : {}),
    });
  }

  createReadStream(range?: { start: number; end: number }): Readable {
    return this.file.createReadStream(range ? { start: range.start, end: range.end } : undefined);
  }

  async delete(): Promise<void> {
    await this.file.delete();
  }
}

class GcsDriver implements StorageDriver {
  private readonly client: Storage;

  constructor(readonly kind: "gcs" | "replit") {
    this.client = createGcsClient(kind);
  }

  object(bucketName: string, objectName: string): StoredObject {
    return new GcsObject(this.client.bucket(bucketName).file(objectName));
  }

  async signUpload(p: SignUploadParams): Promise<string> {
    if (this.kind === "gcs") {
      // V4 signed URL bound to the declared Content-Type: a PUT with any other
      // type fails at GCS. Size and real type are checked after upload.
      const [url] = await this.client
        .bucket(p.bucketName)
        .file(p.objectName)
        .getSignedUrl({
          version: "v4",
          action: "write",
          expires: Date.now() + p.ttlSec * 1000,
          contentType: p.contentType,
        });
      return url;
    }
    return signViaReplitSidecar(p.bucketName, p.objectName, "PUT", p.ttlSec);
  }
}

async function signViaReplitSidecar(
  bucketName: string,
  objectName: string,
  method: "GET" | "PUT" | "DELETE" | "HEAD",
  ttlSec: number,
): Promise<string> {
  const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}. ` +
        `The Replit storage driver only works on Replit; set STORAGE_DRIVER to gcs or local elsewhere.`,
    );
  }
  const { signed_url: signedURL } = (await response.json()) as { signed_url: string };
  return signedURL;
}

// ---------------------------------------------------------------------------
// Local disk
// ---------------------------------------------------------------------------

function localStorageRoot(): string {
  return path.resolve(process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), ".local-storage"));
}

/** Resolve bucket/object under root, refusing anything that escapes it (e.g. `..`). */
export function resolveLocalPath(root: string, bucketName: string, objectName: string): string {
  const resolved = path.resolve(root, bucketName, objectName);
  const base = path.resolve(root, bucketName) + path.sep;
  if (!resolved.startsWith(base) || !bucketName || bucketName.includes("/") || bucketName.startsWith(".")) {
    throw new Error("Invalid object path");
  }
  return resolved;
}

interface LocalMeta {
  contentType: string;
  custom: Record<string, string>;
}

class LocalObject implements StoredObject {
  constructor(
    readonly name: string,
    private readonly filePath: string,
  ) {}

  private get metaPath(): string {
    return `${this.filePath}.meta.json`;
  }

  private async readMeta(): Promise<LocalMeta> {
    try {
      return JSON.parse(await readFile(this.metaPath, "utf8")) as LocalMeta;
    } catch {
      return { contentType: "application/octet-stream", custom: {} };
    }
  }

  async exists(): Promise<boolean> {
    try {
      return (await stat(this.filePath)).isFile();
    } catch {
      return false;
    }
  }

  async stat(): Promise<ObjectStat> {
    const [info, meta] = await Promise.all([stat(this.filePath), this.readMeta()]);
    return { size: info.size, contentType: meta.contentType, custom: meta.custom };
  }

  async update(patch: { contentType?: string; custom?: Record<string, string> }): Promise<void> {
    const meta = await this.readMeta();
    await writeFile(
      this.metaPath,
      JSON.stringify({
        contentType: patch.contentType ?? meta.contentType,
        custom: { ...meta.custom, ...patch.custom },
      }),
    );
  }

  createReadStream(range?: { start: number; end: number }): Readable {
    return createReadStream(this.filePath, range);
  }

  async delete(): Promise<void> {
    await rm(this.filePath);
    await rm(this.metaPath, { force: true });
  }

  /** Write the upload body, refusing more than `maxBytes`. */
  async write(body: Readable, contentType: string, maxBytes: number): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    let received = 0;
    const cap = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        received += chunk.length;
        if (received > maxBytes) cb(new LocalUploadError(413, "File is larger than declared"));
        else cb(null, chunk);
      },
    });
    try {
      await pipeline(body, cap, createWriteStream(this.filePath));
    } catch (err) {
      await rm(this.filePath, { force: true });
      throw err;
    }
    await writeFile(this.metaPath, JSON.stringify({ contentType, custom: {} } satisfies LocalMeta));
  }
}

export class LocalUploadError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "LocalUploadError";
  }
}

// Upload tokens are HMAC-signed so only URLs this server issued are accepted.
// Without LOCAL_STORAGE_SECRET a per-process key is used, so pending upload
// URLs stop working when the dev server restarts.
const localSecret = process.env.LOCAL_STORAGE_SECRET || randomBytes(32).toString("hex");

interface UploadClaims {
  b: string; // bucket
  o: string; // object name
  t: string; // content type
  s: number; // declared size
  e: number; // expiry (ms since epoch)
}

export function signLocalUploadToken(claims: UploadClaims, secret = localSecret): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyLocalUploadToken(token: string, nowMs = Date.now(), secret = localSecret): UploadClaims | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as UploadClaims;
    return claims.e > nowMs ? claims : null;
  } catch {
    return null;
  }
}

class LocalDriver implements StorageDriver {
  readonly kind = "local" as const;

  constructor(private readonly root: string) {}

  object(bucketName: string, objectName: string): LocalObject {
    return new LocalObject(objectName, resolveLocalPath(this.root, bucketName, objectName));
  }

  async signUpload(p: SignUploadParams): Promise<string> {
    const token = signLocalUploadToken({
      b: p.bucketName,
      o: p.objectName,
      t: p.contentType,
      s: p.size,
      e: Date.now() + p.ttlSec * 1000,
    });
    return `${p.apiOrigin}/api/storage/local-uploads/${token}`;
  }

  /** Accept a PUT for a token this server issued. */
  async acceptUpload(token: string, contentType: string | undefined, body: Readable): Promise<void> {
    const claims = verifyLocalUploadToken(token);
    if (!claims) throw new LocalUploadError(403, "Upload URL is invalid or has expired");
    if ((contentType ?? "").split(";")[0].trim().toLowerCase() !== claims.t.toLowerCase()) {
      throw new LocalUploadError(400, "Content-Type doesn't match the upload request");
    }
    const target = this.object(claims.b, claims.o);
    if (await target.exists()) throw new LocalUploadError(409, "Already uploaded");
    await target.write(body, claims.t, Math.min(claims.s, MAX_UPLOAD_BYTES));
  }
}

/** Handles PUT /api/storage/local-uploads/:token. Only valid with the local driver. */
export async function acceptLocalUpload(token: string, contentType: string | undefined, body: Readable): Promise<void> {
  const d = getStorageDriver();
  if (!(d instanceof LocalDriver)) throw new LocalUploadError(404, "Not found");
  await d.acceptUpload(token, contentType, body);
}
