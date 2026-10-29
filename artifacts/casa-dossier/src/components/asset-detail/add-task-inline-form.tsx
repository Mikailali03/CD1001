import { useState, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { createMaintenanceTask, getListMaintenanceTasksQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Calendar, DollarSign, Hammer, Loader2, Plus, UserCheck, Wrench, X } from "lucide-react";
import { FieldError } from "@/components/field-error";
import { INTERVAL_OPTIONS } from "@/lib/asset-scoring";

// ── Add Task Inline Form ───────────────────────────────────────────────────────
export function AddTaskInlineForm({ assetId, onSuccess }: { assetId: string; onSuccess: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toLocaleDateString("en-CA");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [intervalDays, setIntervalDays] = useState("90");
  const [nextDueDate, setNextDueDate] = useState(today);
  const [estimatedCost, setEstimatedCost] = useState("");
  const [isDiy, setIsDiy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const uid = useId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  function reset() {
    setTitle(""); setDescription(""); setIntervalDays("90");
    setNextDueDate(today); setEstimatedCost(""); setIsDiy(true);
    setTitleError(null);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setTitleError(t("assetDetail.task.titleRequired"));
      return;
    }
    setTitleError(null);
    setBusy(true);
    try {
      await createMaintenanceTask(assetId, {
        title: title.trim(),
        description: description.trim() || undefined,
        intervalDays: parseInt(intervalDays),
        nextDueDate,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        isDiy,
      });
      toast({ title: t("assetDetail.toast.taskAdded") });
      queryClient.invalidateQueries({ queryKey: getListMaintenanceTasksQueryKey(assetId) });
      reset();
      setOpen(false);
      onSuccess();
    } catch {
      toast({ title: t("assetDetail.toast.taskCreateFailed"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="pt-3 border-t mt-3">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors w-full group"
        >
          <div className="h-6 w-6 rounded-full border-2 border-dashed border-primary/40 group-hover:border-primary flex items-center justify-center transition-colors">
            <Plus className="h-3.5 w-3.5" />
          </div>
          {t("assetDetail.task.addCta")}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border-2 border-primary/20 bg-primary/3 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 bg-primary/5">
        <p className="text-sm font-bold flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-primary" />
          {t("assetDetail.task.newTitle")}
        </p>
        <button onClick={() => { setOpen(false); reset(); }} aria-label={t("assetDetail.task.closeNewForm")} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-title`} className="text-xs font-semibold">{t("assetDetail.task.title")} <span className="text-destructive" aria-hidden="true">*</span></Label>
          <Input
            id={`${uid}-title`}
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(null); }}
            placeholder={t("assetDetail.task.titlePlaceholder")}
            className="text-sm h-8 bg-background"
            autoFocus
            required
            aria-invalid={!!titleError}
            aria-describedby={titleError ? `${uid}-title-error` : undefined}
          />
          <FieldError id={`${uid}-title-error`} message={titleError} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-desc`} className="text-xs font-semibold">{t("assetDetail.task.descriptionOptional")}</Label>
          <Textarea id={`${uid}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("assetDetail.task.stepsPlaceholder")} className="resize-none h-14 text-sm bg-background" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-interval`} className="text-xs font-semibold">{t("assetDetail.task.recurrence")}</Label>
            <Select value={intervalDays} onValueChange={setIntervalDays}>
              <SelectTrigger id={`${uid}-interval`} className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{t(o.labelKey)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-due`} className="text-xs font-semibold flex items-center gap-1"><Calendar className="h-3 w-3" />{t("assetDetail.task.dueDate")}</Label>
            <Input id={`${uid}-due`} type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="text-sm h-8 bg-background" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-cost`} className="text-xs font-semibold flex items-center gap-1"><DollarSign className="h-3 w-3" />{t("assetDetail.task.estCost")}</Label>
            <Input id={`${uid}-cost`} type="number" min={0} step="0.01" placeholder="0.00" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} className="text-sm h-8 bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label id={`${uid}-type`} className="text-xs font-semibold">{t("assetDetail.task.type")}</Label>
            <div className="flex gap-1.5 h-8" role="group" aria-labelledby={`${uid}-type`}>
              <button type="button" aria-pressed={isDiy} onClick={() => setIsDiy(true)} className={`flex items-center gap-1 text-xs px-2 rounded-md border font-medium flex-1 justify-center transition-colors ${isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                <Hammer className="h-3 w-3" />{t("assetDetail.task.diy")}
              </button>
              <button type="button" aria-pressed={!isDiy} onClick={() => setIsDiy(false)} className={`flex items-center gap-1 text-xs px-2 rounded-md border font-medium flex-1 justify-center transition-colors ${!isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                <UserCheck className="h-3 w-3" />{t("assetDetail.task.pro")}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-0.5">
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setOpen(false); reset(); }} disabled={busy}>{t("common.cancel")}</Button>
          <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={handleSubmit} disabled={busy}>
            {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("common.saving")}</> : <><Plus className="h-3.5 w-3.5" />{t("assetDetail.task.addTask")}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
