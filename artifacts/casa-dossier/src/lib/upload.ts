import { requestUploadUrl } from "@workspace/api-client-react";
import i18n from "@/i18n";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Pull the server's `{ error }` message out of a failed generated-client call
 * (an ApiError carries the parsed body on `.data`).
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: unknown } | null)?.data;
  if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
    return (data as { error: string }).error;
  }
  return fallback;
}

// Mirrors the server's guard on POST /storage/uploads/request-url, so the
// user gets a clear message instead of a bare 413/415.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Long-edge size for property/asset photos (receipts use the 1024px default).
export const PHOTO_MAX_PX = 2048;
const ALLOWED_UPLOAD_TYPES = /^(image\/[a-z0-9.+-]+|application\/pdf)$/i;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function drawScaled(img: HTMLImageElement, maxPx: number): HTMLCanvasElement {
  const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Downscale an image to at most `maxPx` on its long edge and re-encode it as
 * JPEG. Non-images (PDFs) and images the browser can't decode (e.g. HEIC
 * outside Safari) are returned unchanged.
 */
export async function compressImage(file: File, maxPx = 1024, quality = 0.78): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const canvas = drawScaled(await loadImage(file), maxPx);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Same as compressImage, but returns a JPEG data URL (for the scan endpoint, which takes base64). */
export async function compressImageToDataUrl(file: File, maxPx = 1024, quality = 0.78): Promise<string> {
  const canvas = drawScaled(await loadImage(file), maxPx);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Upload a file to object storage via a presigned URL and return its object
 * path (`/objects/...`). Throws an Error with a user-facing message on failure.
 */
export async function uploadObject(file: File): Promise<string> {
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_UPLOAD_TYPES.test(contentType)) {
    throw new Error(i18n.t("receipt.onlyImagesAndPdfs"));
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(i18n.t("receipt.fileTooLarge", { maxMb: 25 }));
  }

  let uploadURL: string;
  let objectPath: string;
  try {
    ({ uploadURL, objectPath } = await requestUploadUrl({ name: file.name, size: file.size, contentType }));
  } catch (err) {
    throw new Error(apiErrorMessage(err, i18n.t("receipt.uploadUrlFailed")));
  }

  // Presigned PUT straight to object storage: not an API route, so raw fetch.
  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!uploadRes.ok) throw new Error(i18n.t("receipt.uploadFailed"));

  return objectPath;
}

/**
 * Upload a file and return the app URL to store on the record
 * (`${BASE}/api/storage/objects/...`), as used for photos and receipts.
 */
export async function uploadToStorage(file: File): Promise<string> {
  return `${BASE}/api/storage${await uploadObject(file)}`;
}

/** Older receipts were stored inline as base64 data URLs. */
export function isDataUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith("data:");
}
