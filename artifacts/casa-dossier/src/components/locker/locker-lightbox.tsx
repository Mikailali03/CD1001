import { useTranslation } from "react-i18next";
import type { LockerFile } from "@workspace/api-client-react";
import { Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { LockerImage } from "./locker-image";

export function LockerLightbox({
  files,
  index,
  onIndexChange,
  onClose,
  onDelete,
}: {
  files: LockerFile[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onDelete: (file: LockerFile) => void;
}) {
  const { t } = useTranslation();
  const current = files[index]!;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        onClick={onClose}
        aria-label={t("common.close")}
      >
        <X className="h-5 w-5" />
      </button>

      {index > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); onIndexChange(index - 1); }}
          aria-label={t("locker.previousPhoto")}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {index < files.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); onIndexChange(index + 1); }}
          aria-label={t("locker.nextPhoto")}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      <div className="max-w-5xl max-h-[90vh] w-full mx-8" onClick={(e) => e.stopPropagation()}>
        <LockerImage
          key={current.objectPath}
          objectPath={current.objectPath}
          alt={current.name}
          className="max-w-full max-h-[80vh] object-contain mx-auto rounded-lg"
        />
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-white/80 text-sm">{current.name}</p>
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-xs">
              {t("locker.position", { current: index + 1, total: files.length })}
            </span>
            <button
              className="text-red-400 hover:text-red-300 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              onClick={() => onDelete(current)}
              aria-label={t("locker.deletePhoto")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
