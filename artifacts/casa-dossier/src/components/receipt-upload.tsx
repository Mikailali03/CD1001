import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { compressImage, isDataUrl, uploadToStorage } from "@/lib/upload";
import { cn } from "@/lib/utils";

/**
 * Compact receipt picker used by the task-completion forms. The file is
 * compressed (images only) and uploaded to object storage as soon as it's
 * picked; `onChange` receives the stored URL, or null once removed.
 * `onUploadingChange` lets the parent hold its submit button until the
 * upload has finished.
 */
export function ReceiptUpload({
  id,
  value,
  onChange,
  onUploadingChange,
  className,
}: {
  id?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; isPdf: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();

  // Free the local preview blob when it's replaced or the form unmounts.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  // Parent reset the form (e.g. after submit), so drop the local preview too.
  useEffect(() => { if (!value && !uploading) setPreview(null); }, [value, uploading]);

  function setBusy(v: boolean) {
    setUploading(v);
    onUploadingChange?.(v);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      setPreview({ url: URL.createObjectURL(compressed), isPdf: compressed.type === "application/pdf" });
      onChange(await uploadToStorage(compressed));
    } catch (err) {
      setPreview(null);
      onChange(null);
      toast({
        title: t("receipt.uploadFailedTitle"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setPreview(null);
    onChange(null);
  }

  return (
    <div className={className}>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} tabIndex={-1} aria-hidden="true" />
      {preview ? (
        <div className="relative h-8">
          {preview.isPdf ? (
            <div className="h-8 w-full rounded-md border flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> {t("receipt.pdf")}
            </div>
          ) : (
            <img src={preview.url} alt={t("receipt.previewAlt")} className="h-8 w-full object-cover rounded-md border" />
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label={t("receipt.uploading")} />
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              aria-label={t("receipt.remove")}
              className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors"
              onClick={clear}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          id={id}
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="h-8 w-full rounded-md border border-dashed hover:bg-muted flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} {t("common.upload")}
        </button>
      )}
    </div>
  );
}

/**
 * Small receipt preview for history lists. Receipts can be PDFs now, which
 * an <img> can't render, so fall back to a file chip when the image fails.
 */
export function ReceiptThumbnail({ url, className }: { url: string; className?: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground", className)}>
        <FileText className="h-3.5 w-3.5" /> {t("receipt.view")}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={t("receipt.alt")}
      onError={() => setFailed(true)}
      className={cn("h-16 rounded-md object-cover border border-border hover:opacity-90 transition-opacity", className)}
    />
  );
}

/**
 * Link to a stored receipt. Older receipts were saved inline as base64 data
 * URLs, which browsers refuse to open in a new tab, so those are shown in a
 * lightbox instead.
 */
export function ReceiptLink({
  url,
  className,
  children,
}: {
  url: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!isDataUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className} aria-label={t("receipt.openInNewTab")}>
        {children}
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("text-left", className)} aria-label={t("receipt.view")}>
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-2 sm:p-3">
          <DialogTitle className="sr-only">{t("receipt.alt")}</DialogTitle>
          <DialogDescription className="sr-only">{t("receipt.fullSize")}</DialogDescription>
          <img src={url} alt={t("receipt.alt")} className="max-h-[80vh] w-full object-contain rounded-md" />
        </DialogContent>
      </Dialog>
    </>
  );
}
