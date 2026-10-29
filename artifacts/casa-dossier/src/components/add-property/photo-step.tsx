import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ChevronLeft, ImagePlus, Camera, X } from "lucide-react";

export function PhotoStep({
  photoPreview,
  photoUploading,
  saveBusy,
  onFileChange,
  onRemove,
  onBack,
  onSkip,
  onSave,
}: {
  photoPreview: string | null;
  photoUploading: boolean;
  saveBusy: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  onBack: () => void;
  onSkip: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2.5 rounded-xl">
            <Camera className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <DialogTitle className="text-lg">{t("addProperty.photoTitle")}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{t("addProperty.photoSubtitle")}</p>
          </div>
        </div>
      </DialogHeader>

      <div className="px-6 py-6 space-y-4">
        <div className="relative group">
          {photoPreview ? (
            <div className="relative h-52 w-full rounded-xl overflow-hidden border border-border">
              <img src={photoPreview} alt={t("addProperty.photoAlt")} className="h-full w-full object-cover" />
              {photoUploading && (
                <div className="absolute inset-0 bg-background/70 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">{t("common.uploading")}</span>
                </div>
              )}
              {!photoUploading && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:bg-transparent [@media(hover:none)]:items-end [@media(hover:none)]:pb-3 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white/90 hover:bg-white text-foreground rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {t("addProperty.changePhoto")}
                  </button>
                  <button
                    type="button"
                    onClick={onRemove}
                    className="bg-white/90 hover:bg-white text-destructive rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t("common.remove")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-40 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/40 hover:bg-primary/5 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary transition-all cursor-pointer"
            >
              <ImagePlus className="h-8 w-8" />
              <div className="text-center">
                <p className="text-sm font-medium">{t("addProperty.uploadHomePhoto")}</p>
                <p className="text-xs opacity-70 mt-0.5">{t("addProperty.acceptedFormats")}</p>
              </div>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {t("addProperty.photoHint")}
        </p>
      </div>

      <div className="border-t px-6 py-4 flex items-center justify-between gap-3 bg-muted/20">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("common.back")}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip} disabled={saveBusy || photoUploading}>
            {t("common.skip")}
          </Button>
          <Button
            onClick={onSave}
            disabled={saveBusy || photoUploading}
            className="gap-1.5"
          >
            {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t("onboarding.saveAndGenerate")}
          </Button>
        </div>
      </div>
    </>
  );
}
