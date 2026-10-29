import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Image as ImageIcon } from "lucide-react";

export function FileDropZone({
  onFile,
  isScanning,
}: {
  onFile: (f: File) => void;
  isScanning: boolean;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) onFile(file);
    },
    [onFile]
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
        }`}
        onClick={() => fileRef.current?.click()}
      >
        <div className="bg-primary/10 p-4 rounded-full">
          <ImageIcon className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-sm">{t("addAsset.dropPhoto")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("addAsset.dropPhotoHint")}</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="gap-2 h-11"
          disabled={isScanning}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
          {t("addAsset.takePhoto")}
        </Button>
        <Button
          variant="outline"
          className="gap-2 h-11"
          disabled={isScanning}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {t("addAsset.browseFiles")}
        </Button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}
