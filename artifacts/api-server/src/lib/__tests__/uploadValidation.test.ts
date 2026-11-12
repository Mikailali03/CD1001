import { describe, it, expect } from "vitest";
import { judgeUpload, sniffContentType, MAX_UPLOAD_BYTES, UploadRejectedError } from "../uploadValidation";

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);

describe("sniffContentType", () => {
  it("recognises the image and PDF formats the app accepts", () => {
    expect(sniffContentType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffContentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffContentType(text("GIF89a...."))).toBe("image/gif");
    expect(sniffContentType(text("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffContentType(text("%PDF-1.7\n"))).toBe("application/pdf");
    expect(sniffContentType(text("\0\0\0\x18ftypheic"))).toBe("image/heic");
    expect(sniffContentType(text("\0\0\0\x1cftypavif"))).toBe("image/avif");
  });

  it("rejects content that could run in a browser, whatever the client called it", () => {
    expect(sniffContentType(text("<!DOCTYPE html><script>"))).toBeNull();
    expect(sniffContentType(text('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffContentType(text("MZ\x90\0"))).toBeNull();
    expect(sniffContentType(new Uint8Array())).toBeNull();
  });

  it("doesn't accept other ISO-BMFF files such as MP4 video", () => {
    expect(sniffContentType(text("\0\0\0\x18ftypisom"))).toBeNull();
  });
});

describe("judgeUpload", () => {
  const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0);

  it("accepts a real image within the limit and reports its real type", () => {
    expect(judgeUpload(1234, jpeg)).toEqual({ ok: true, contentType: "image/jpeg" });
    expect(judgeUpload(MAX_UPLOAD_BYTES, jpeg).ok).toBe(true);
  });

  it("rejects files over the limit, empty files and disallowed types", () => {
    expect(judgeUpload(MAX_UPLOAD_BYTES + 1, jpeg)).toEqual({ ok: false, reason: "too_large" });
    expect(judgeUpload(0, jpeg)).toEqual({ ok: false, reason: "empty" });
    expect(judgeUpload(100, text("<html>"))).toEqual({ ok: false, reason: "type" });
  });

  it("maps rejections to HTTP statuses", () => {
    expect(new UploadRejectedError("too_large").status).toBe(413);
    expect(new UploadRejectedError("type").status).toBe(415);
    expect(new UploadRejectedError("empty").status).toBe(400);
  });
});
