import { useTranslation } from "react-i18next";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Scan, Loader2, ChevronLeft, X, AlertCircle, ZapIcon } from "lucide-react";
import { FileDropZone } from "./file-drop-zone";

export function LensStep({
  imagePreview,
  scanBusy,
  scanError,
  onFile,
  onRemovePhoto,
  onRetake,
  onScan,
  onManual,
  onBack,
}: {
  imagePreview: string | null;
  scanBusy: boolean;
  scanError: string | null;
  onFile: (f: File) => void;
  onRemovePhoto: () => void;
  onRetake: () => void;
  onScan: () => void;
  onManual: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <Scan className="h-5 w-5 text-primary" />
          </div>
          <div>
            <DialogTitle className="text-lg">{t("addAsset.aiLens")}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{t("addAsset.lensSubtitle")}</p>
          </div>
        </div>
      </DialogHeader>

      <div className="px-6 py-5 space-y-4">
        {!imagePreview ? (
          <FileDropZone onFile={onFile} isScanning={scanBusy} />
        ) : (
          <div className="space-y-3">
            {/* Image preview */}
            <div className="relative rounded-xl overflow-hidden border bg-muted/30 aspect-video flex items-center justify-center">
              <img src={imagePreview} alt={t("addAsset.previewAlt")} className="max-h-48 w-auto object-contain" />
              {!scanBusy && (
                <button
                  onClick={onRemovePhoto}
                  aria-label={t("addAsset.removePhoto")}
                  className="absolute top-2 right-2 bg-background/90 rounded-full p-1 hover:bg-background border shadow-sm"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {scanBusy && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm font-medium text-primary">{t("addAsset.readingPlate")}</p>
                </div>
              )}
            </div>

            {/* Scan error */}
            {scanError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {scanError}
              </div>
            )}

            {/* Scan trigger */}
            {!scanBusy && !scanError && (
              <Button onClick={onScan} className="w-full gap-2" disabled={scanBusy}>
                <ZapIcon className="h-4 w-4" />
                {t("addAsset.scanWithAi")}
              </Button>
            )}

            {scanError && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={onRetake}>
                  {t("addAsset.retakePhoto")}
                </Button>
                <Button onClick={onManual}>{t("addAsset.enterManually")}</Button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          {t("addAsset.bestResults")}
        </p>
      </div>

      <div className="border-t px-6 py-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("common.back")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onManual}>
          {t("addAsset.skipEnterManually")}
        </Button>
      </div>
    </>
  );
}
