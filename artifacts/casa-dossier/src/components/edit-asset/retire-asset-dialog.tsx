import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, ArchiveRestore } from "lucide-react";

// ── Retire / restore confirmation ─────────────────────────────────────────────
export function RetireAssetDialog({ mode, name, open, onOpenChange, onConfirm }: {
  mode: "retire" | "restore";
  name?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const isRetire = mode === "retire";
  const ns = isRetire ? "editAsset.retireDialog" : "editAsset.restoreDialog";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`${ns}.title`, { name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(`${ns}.body`)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          {isRetire ? (
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={onConfirm}
            >
              <Archive className="h-4 w-4 mr-2" />
              {t(`${ns}.confirm`)}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction onClick={onConfirm}>
              <ArchiveRestore className="h-4 w-4 mr-2" />
              {t(`${ns}.confirm`)}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
