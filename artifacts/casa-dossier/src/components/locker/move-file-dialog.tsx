import { useTranslation } from "react-i18next";
import type { LockerFolder } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FolderOpen, FolderIcon } from "lucide-react";

export function MoveFileDialog({
  open,
  onClose,
  folders,
  onMove,
}: {
  open: boolean;
  onClose: () => void;
  folders: LockerFolder[];
  onMove: (folderId: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("locker.moveTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 pt-2">
          <button
            onClick={() => onMove(null)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors text-left"
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            {t("locker.unorganizedNoFolder")}
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onMove(folder.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors text-left"
            >
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              {folder.name}
            </button>
          ))}
          {folders.length === 0 && (
            <p className="text-sm text-muted-foreground py-3 text-center">
              {t("locker.noFoldersYet")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
