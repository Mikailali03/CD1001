import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Camera, ImagePlus, Loader2, X as XIcon } from "lucide-react";

// ── Photo picker with preview, change and remove ─────────────────────────────
export function AssetPhotoField({ photoPreview, uploading, onFileChange, onRemove }: {
  photoPreview: string | null;
  uploading: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="edit-asset-photo" className="text-xs font-semibold">{t("editAsset.photo")}</Label>
      <div className="relative group">
        {photoPreview ? (
          <div className="relative h-44 w-full rounded-xl overflow-hidden border border-border">
            <img src={photoPreview} alt={t("editAsset.photoAlt")} className="h-full w-full object-cover" />
            {uploading && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {!uploading && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:bg-transparent [@media(hover:none)]:items-end [@media(hover:none)]:pb-3 transition-opacity flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white/90 hover:bg-white text-foreground rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {t("editAsset.changePhoto")}
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="bg-white/90 hover:bg-white text-destructive rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                >
                  <XIcon className="h-3.5 w-3.5" />
                  {t("common.remove")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full h-32 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/40 hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs font-medium">{t("editAsset.uploadPhoto")}</span>
              </>
            )}
          </button>
        )}
        <input
          id="edit-asset-photo"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
    </div>
  );
}
