import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { Readable } from "stream";
import {
  acceptLocalUpload,
  getStorageDriver,
  LocalUploadError,
  resolveLocalPath,
  selectStorageDriverKind,
  signLocalUploadToken,
  verifyLocalUploadToken,
} from "../storageDrivers";

describe("selectStorageDriverKind", () => {
  it("uses STORAGE_DRIVER when set", () => {
    expect(selectStorageDriverKind({ STORAGE_DRIVER: "GCS", REPL_ID: "x" })).toBe("gcs");
    expect(selectStorageDriverKind({ STORAGE_DRIVER: "local", NODE_ENV: "production" })).toBe("local");
  });

  it("rejects an unknown STORAGE_DRIVER", () => {
    expect(() => selectStorageDriverKind({ STORAGE_DRIVER: "ftp" })).toThrow(/Unknown STORAGE_DRIVER/);
  });

  it("uses the Replit sidecar on Replit, GCS with Google credentials, and local disk in development", () => {
    expect(selectStorageDriverKind({ REPL_ID: "abc", NODE_ENV: "production" })).toBe("replit");
    expect(selectStorageDriverKind({ GOOGLE_APPLICATION_CREDENTIALS: "/k.json", NODE_ENV: "production" })).toBe("gcs");
    expect(selectStorageDriverKind({ GCS_CREDENTIALS_JSON: "{}" })).toBe("gcs");
    expect(selectStorageDriverKind({ NODE_ENV: "development" })).toBe("local");
  });

  it("refuses to guess in production", () => {
    expect(() => selectStorageDriverKind({ NODE_ENV: "production" })).toThrow(/No object storage configured/);
  });
});

describe("resolveLocalPath", () => {
  const root = "/data/storage";

  it("keeps objects inside their bucket directory", () => {
    expect(resolveLocalPath(root, "local", "private/uploads/a")).toBe("/data/storage/local/private/uploads/a");
  });

  it("refuses paths that escape the bucket", () => {
    expect(() => resolveLocalPath(root, "local", "../other/secret")).toThrow();
    expect(() => resolveLocalPath(root, "local", "private/../../../etc/passwd")).toThrow();
    expect(() => resolveLocalPath(root, "..", "x")).toThrow();
  });
});

describe("local upload tokens", () => {
  const claims = { b: "local", o: "private/uploads/x", t: "image/png", s: 10, e: 2_000 };

  it("round-trips a token this server signed", () => {
    expect(verifyLocalUploadToken(signLocalUploadToken(claims, "k"), 1_000, "k")).toEqual(claims);
  });

  it("rejects expired, tampered and foreign tokens", () => {
    const token = signLocalUploadToken(claims, "k");
    expect(verifyLocalUploadToken(token, 3_000, "k")).toBeNull();
    expect(verifyLocalUploadToken(token, 1_000, "other")).toBeNull();
    const forged = Buffer.from(JSON.stringify({ ...claims, s: 10_000_000 })).toString("base64url");
    expect(verifyLocalUploadToken(`${forged}.${token.split(".")[1]}`, 1_000, "k")).toBeNull();
    expect(verifyLocalUploadToken("garbage", 1_000, "k")).toBeNull();
  });
});

describe("local driver", () => {
  let dir: string;
  const saved = { ...process.env };

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "casa-storage-"));
    process.env.STORAGE_DRIVER = "local";
    process.env.LOCAL_STORAGE_DIR = dir;
  });

  afterAll(async () => {
    process.env = saved;
    await rm(dir, { recursive: true, force: true });
  });

  async function uploadUrl(objectName: string, contentType: string, size: number): Promise<string> {
    const url = await getStorageDriver().signUpload({
      bucketName: "local",
      objectName,
      contentType,
      size,
      ttlSec: 60,
      apiOrigin: "http://api.test",
    });
    expect(url.startsWith("http://api.test/api/storage/local-uploads/")).toBe(true);
    return url.split("/").pop()!;
  }

  it("stores an upload and reads it back with its metadata", async () => {
    const body = Buffer.from("%PDF-1.7 hello");
    const token = await uploadUrl("private/uploads/a", "application/pdf", body.length);
    await acceptLocalUpload(token, "application/pdf", Readable.from([body]));

    const object = getStorageDriver().object("local", "private/uploads/a");
    expect(await object.exists()).toBe(true);
    expect(await object.stat()).toMatchObject({ size: body.length, contentType: "application/pdf" });

    await object.update({ custom: { verified: "1" } });
    expect((await object.stat()).custom).toEqual({ verified: "1" });

    const chunks: Buffer[] = [];
    for await (const c of object.createReadStream({ start: 0, end: 3 })) chunks.push(c as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe("%PDF");

    await object.delete();
    expect(await object.exists()).toBe(false);
  });

  it("refuses a body larger than the size the client declared", async () => {
    const token = await uploadUrl("private/uploads/b", "image/png", 4);
    await expect(acceptLocalUpload(token, "image/png", Readable.from([Buffer.alloc(10)]))).rejects.toMatchObject({
      status: 413,
    });
    expect(await getStorageDriver().object("local", "private/uploads/b").exists()).toBe(false);
  });

  it("refuses a Content-Type other than the one requested", async () => {
    const token = await uploadUrl("private/uploads/c", "image/png", 4);
    await expect(acceptLocalUpload(token, "text/html", Readable.from([Buffer.alloc(4)]))).rejects.toBeInstanceOf(
      LocalUploadError,
    );
  });

  it("won't overwrite an existing upload with a replayed token", async () => {
    const token = await uploadUrl("private/uploads/d", "image/png", 4);
    await acceptLocalUpload(token, "image/png", Readable.from([Buffer.alloc(4)]));
    await expect(acceptLocalUpload(token, "image/png", Readable.from([Buffer.alloc(4)]))).rejects.toMatchObject({
      status: 409,
    });
  });
});
