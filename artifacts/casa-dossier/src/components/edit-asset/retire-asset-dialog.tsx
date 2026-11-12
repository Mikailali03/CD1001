import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Archive, ArchiveRestore } from "lucide-react";

export const RETIRE_REASONS = ["replaced", "removed", "failed", "other"] as const;
export type RetireReason = (typeof RETIRE_REASONS)[number];
export type RetireDetails = { reason: RetireReason; date: string };

const today = () => new Date().toISOString().slice(0, 10);

// ── Retire / restore confirmation ─────────────────────────────────────────────
export function RetireAssetDialog({ mode, name, open, onOpenChange, onConfirm }: {
  mode: "retire" | "restore";
  name?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (details?: RetireDetails) => void;
}) {
  const { t } = useTranslation();
  const isRetire = mode === "retire";
  const ns = isRetire ? "editAsset.retireDialog" : "editAsset.restoreDialog";
  const [reason, setReason] = useState<RetireReason | "">("");
  const [date, setDate] = useState(today());

  useEffect(() => {
    if (open) {
      setReason("");
      setDate(today());
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`${ns}.title`, { name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(`${ns}.body`)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isRetire && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("retire.reasonLabel")}</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as RetireReason)}>
                <SelectTrigger><SelectValue placeholder={t("retire.reasonPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {RETIRE_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{t(`retire.reason.${r}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retire-date" className="text-xs font-semibold">{t("retire.dateLabel")}</Label>
              <Input id="retire-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          {isRetire ? (
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!reason || !date}
              onClick={() => reason && onConfirm({ reason, date })}
            >
              <Archive className="h-4 w-4 mr-2" />
              {t(`${ns}.confirm`)}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction onClick={() => onConfirm()}>
              <ArchiveRestore className="h-4 w-4 mr-2" />
              {t(`${ns}.confirm`)}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
