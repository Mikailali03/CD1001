// What may be uploaded, judged from the file's actual bytes rather than the
// size and Content-Type the client declares. Pure functions, no I/O.

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Declared types the client may ask to upload. */
export const ALLOWED_UPLOAD_TYPES = /^(image\/[a-z0-9.+-]+|application\/pdf)$/i;

/** Bytes needed by sniffContentType. */
export const SNIFF_BYTES = 32;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

const HEIF_BRANDS: Record<string, string> = {
  heic: "image/heic",
  heix: "image/heic",
  hevc: "image/heic",
  heim: "image/heic",
  heis: "image/heic",
  mif1: "image/heif",
  msf1: "image/heif",
  avif: "image/avif",
  avis: "image/avif",
};

/**
 * The real type of a file from its first bytes, limited to the images and
 * PDFs the app accepts. Returns null for anything else (HTML, SVG, scripts,
 * executables), since those could be served back from our domain.
 */
export function sniffContentType(head: Uint8Array): string | null {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(head, 0, 6) === "GIF87a" || ascii(head, 0, 6) === "GIF89a") return "image/gif";
  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12) === "WEBP") return "image/webp";
  if (ascii(head, 0, 5) === "%PDF-") return "application/pdf";
  if (ascii(head, 4, 8) === "ftyp") {
    const brand = HEIF_BRANDS[ascii(head, 8, 12)];
    if (brand) return brand;
  }
  if (startsWith(head, [0x49, 0x49, 0x2a, 0x00]) || startsWith(head, [0x4d, 0x4d, 0x00, 0x2a])) return "image/tiff";
  if (startsWith(head, [0x42, 0x4d])) return "image/bmp";
  return null;
}

export type UploadRejection = "empty" | "too_large" | "type";

export type UploadVerdict = { ok: true; contentType: string } | { ok: false; reason: UploadRejection };

/** Decide whether a stored upload is acceptable, from its real size and first bytes. */
export function judgeUpload(size: number, head: Uint8Array): UploadVerdict {
  if (size <= 0) return { ok: false, reason: "empty" };
  if (size > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  const contentType = sniffContentType(head);
  if (!contentType) return { ok: false, reason: "type" };
  return { ok: true, contentType };
}

export class UploadRejectedError extends Error {
  constructor(readonly reason: UploadRejection) {
    super(
      reason === "too_large"
        ? "File is too large (max 25 MB)"
        : reason === "empty"
          ? "File is empty"
          : "Only images and PDFs can be uploaded",
    );
    this.name = "UploadRejectedError";
  }

  get status(): number {
    return this.reason === "too_large" ? 413 : this.reason === "type" ? 415 : 400;
  }
}
