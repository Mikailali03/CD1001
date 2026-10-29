import { useState, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  updateMaintenanceTask,
  getListMaintenanceTasksQueryKey,
  type MaintenanceTask,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, DollarSign, Hammer, Loader2, Pencil, UserCheck, X } from "lucide-react";
import { FieldError } from "@/components/field-error";
import { INTERVAL_OPTIONS } from "@/lib/asset-scoring";

// ── Edit Task Modal ───────────────────────────────────────────────────────────
export function EditTaskModal({
  task,
  assetId,
  open,
  onClose,
}: {
  task: MaintenanceTask;
  assetId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState<string>(task.title ?? "");
  const [description, setDescription] = useState<string>(task.description ?? "");
  const [intervalDays, setIntervalDays] = useState<string>(String(task.intervalDays ?? 90));
  const [nextDueDate, setNextDueDate] = useState<string>(task.nextDueDate ?? "");
  const [estimatedCost, setEstimatedCost] = useState<string>(task.estimatedCost ? String(Number(task.estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState<boolean>(task.isDiy ?? true);
  const [busy, setBusy] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const uid = useId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function handleSave() {
    if (!title.trim()) {
      setTitleError(t("assetDetail.task.titleRequired"));
      return;
    }
    setTitleError(null);
    setBusy(true);
    try {
      await updateMaintenanceTask(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        intervalDays: parseInt(intervalDays),
        nextDueDate,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        isDiy,
      });
      toast({ title: t("assetDetail.toast.taskUpdated") });
      queryClient.invalidateQueries({ queryKey: getListMaintenanceTasksQueryKey(assetId) });
      onClose();
    } catch {
      toast({ title: t("assetDetail.toast.taskUpdateFailed"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogTitle className="sr-only">{t("assetDetail.task.editTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("assetDetail.task.editDescription")}</DialogDescription>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b shrink-0">
          <p className="text-base font-bold flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            {t("assetDetail.task.editTitle")}
          </p>
          <button onClick={onClose} aria-label={t("common.close")} className="rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-title`} className="text-xs font-semibold">{t("assetDetail.task.title")} <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input
              id={`${uid}-title`}
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(null); }}
              className="text-sm h-8"
              autoFocus
              required
              aria-invalid={!!titleError}
              aria-describedby={titleError ? `${uid}-title-error` : undefined}
            />
            <FieldError id={`${uid}-title-error`} message={titleError} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-desc`} className="text-xs font-semibold">{t("assetDetail.task.descriptionOptional")}</Label>
            <Textarea id={`${uid}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none h-16 text-sm" placeholder={t("assetDetail.task.howToPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-interval`} className="text-xs font-semibold">{t("assetDetail.task.recurrence")}</Label>
              <Select value={intervalDays} onValueChange={setIntervalDays}>
                <SelectTrigger id={`${uid}-interval`} className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{t(o.labelKey)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-due`} className="text-xs font-semibold">{t("assetDetail.task.nextDueDate")}</Label>
              <Input id={`${uid}-due`} type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="text-sm h-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-cost`} className="text-xs font-semibold flex items-center gap-1"><DollarSign className="h-3 w-3" />{t("assetDetail.task.estCostOptional")}</Label>
            <Input id={`${uid}-cost`} type="number" min={0} step="0.01" placeholder="0.00" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} className="text-sm h-8" />
          </div>
          <div className="space-y-1.5">
            <Label id={`${uid}-type`} className="text-xs font-semibold">{t("assetDetail.task.type")}</Label>
            <div className="flex gap-2" role="group" aria-labelledby={`${uid}-type`}>
              <button type="button" aria-pressed={isDiy} onClick={() => setIsDiy(true)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                <Hammer className="h-3.5 w-3.5" />{t("assetDetail.task.diy")}
              </button>
              <button type="button" aria-pressed={!isDiy} onClick={() => setIsDiy(false)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${!isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                <UserCheck className="h-3.5 w-3.5" />{t("assetDetail.task.hirePro")}
              </button>
            </div>
          </div>
        </div>
        <div className="border-t px-5 py-3.5 flex gap-2 shrink-0 bg-background">
          <Button variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
          <Button size="sm" className="flex-1 h-9 text-sm gap-1.5" onClick={handleSave} disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />{t("common.saving")}</> : <><CheckCircle2 className="h-4 w-4" />{t("assetDetail.task.saveChanges")}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
