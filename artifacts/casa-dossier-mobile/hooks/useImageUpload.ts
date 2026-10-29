import { useCallback, useState } from "react";
import { requestUploadUrl } from "@workspace/api-client-react";
import i18n from "@/i18n";

/** The server only accepts images and PDFs, up to 25 MB. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function isAllowedUploadType(contentType: string): boolean {
  return contentType.startsWith("image/") || contentType === "application/pdf";
}

/** Thrown before any network call when the file can't be accepted. */
export class UploadRejectedError extends Error {
  readonly reason: "type" | "size";
  constructor(reason: "type" | "size") {
    super(reason === "type" ? "Unsupported file type" : "File is larger than 25 MB");
    this.name = "UploadRejectedError";
    this.reason = reason;
  }
}

/** The subset of an expo-image-picker / document-picker asset we need. */
export interface PickedFile {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}

export interface UploadedFile {
  /** e.g. `/objects/uploads/<uuid>` — save with `storageUrlForObjectPath` for photos */
  objectPath: string;
  name: string;
  contentType: string;
  size: number;
}

/**
 * Uploads a local file to object storage: asks the API for a presigned URL,
 * PUTs the bytes straight to storage, and returns the stored object's path.
 */
export async function uploadPickedFile(file: PickedFile): Promise<UploadedFile> {
  const contentType = file.mimeType || "image/jpeg";
  if (!isAllowedUploadType(contentType)) throw new UploadRejectedError("type");

  // Read the bytes first: the picker doesn't always report fileSize, and the server needs size ≥ 1
  const blob = await (await fetch(file.uri)).blob();
  const size = file.fileSize || blob.size;
  if (size > MAX_UPLOAD_BYTES) throw new UploadRejectedError("size");

  const name = file.fileName || file.uri.split("/").pop() || `photo_${Date.now()}.jpg`;
  const { uploadURL, objectPath } = await requestUploadUrl({ name, size, contentType });

  // Presigned storage URL, not our API — plain fetch on purpose
  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);

  return { objectPath, name, contentType, size };
}

/** `uploadPickedFile` plus an `isUploading` flag for the UI. */
export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(async (file: PickedFile): Promise<UploadedFile> => {
    setIsUploading(true);
    try {
      return await uploadPickedFile(file);
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { upload, isUploading };
}

/** User-facing reason an upload failed. */
export function uploadFailureMessage(err: unknown): string {
  if (err instanceof UploadRejectedError) {
    return err.reason === "size" ? i18n.t("upload.tooLarge") : i18n.t("upload.wrongType");
  }
  return i18n.t("upload.failed");
}
