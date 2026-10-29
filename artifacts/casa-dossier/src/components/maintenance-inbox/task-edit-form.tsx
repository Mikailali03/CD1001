import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Hammer, Loader2, Pencil, UserCheck } from "lucide-react";
import { FieldError } from "@/components/field-error";
import { INBOX_INTERVAL_VALUES, type InboxTask, type TaskFormPayload } from "./types";

export function TaskEditForm({
  task,
  onSubmit,
}: {
  task: InboxTask;
  onSubmit: (updates: TaskFormPayload) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description ?? "");
  const [editIntervalDays, setEditIntervalDays] = useState(String(task.intervalDays));
  const [editNextDueDate, setEditNextDueDate] = useState(task.nextDueDate);
  const [editCost, setEditCost] = useState(task.estimatedCost ? String(Number(task.estimatedCost)) : "");
  const [editIsDiy, setEditIsDiy] = useState(task.isDiy ?? true);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const uid = useId();

  async function handleConfirmEdit() {
    if (!editTitle.trim()) {
      setTitleError(t("maintenance.titleRequired"));
      return;
    }
    setTitleError(null);
    setBusy(true);
    try {
      await onSubmit({
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        intervalDays: parseInt(editIntervalDays),
        nextDueDate: editNextDueDate,
        estimatedCost: editCost ? parseFloat(editCost) : undefined,
        isDiy: editIsDiy,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t bg-muted/30 px-3 sm:px-4 py-3.5 space-y-3 rounded-b-xl">
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-edit-title`} className="text-xs font-semibold">{t("maintenance.taskTitle")} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id={`${uid}-edit-title`}
          value={editTitle}
          onChange={(e) => { setEditTitle(e.target.value); if (titleError) setTitleError(null); }}
          className="text-sm h-8 bg-background"
          autoFocus
          required
          aria-invalid={!!titleError}
          aria-describedby={titleError ? `${uid}-edit-title-error` : undefined}
        />
        <FieldError id={`${uid}-edit-title-error`} message={titleError} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-edit-desc`} className="text-xs font-semibold">{t("maintenance.descriptionOptional")}</Label>
        <Textarea
          id={`${uid}-edit-desc`}
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          className="text-sm resize-none h-14 bg-background"
          placeholder={t("maintenance.instructionsPlaceholder")}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-edit-interval`} className="text-xs font-semibold">{t("maintenance.recurrence")}</Label>
          <Select value={editIntervalDays} onValueChange={setEditIntervalDays}>
            <SelectTrigger id={`${uid}-edit-interval`} className="h-8 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INBOX_INTERVAL_VALUES.map((v) => (
                <SelectItem key={v} value={v} className="text-xs">{t(`maintenance.interval.${v}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-edit-due`} className="text-xs font-semibold">{t("maintenance.nextDueDate")}</Label>
          <Input
            id={`${uid}-edit-due`}
            type="date"
            value={editNextDueDate}
            onChange={(e) => setEditNextDueDate(e.target.value)}
            className="text-sm h-8 bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-edit-cost`} className="text-xs font-semibold flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> {t("maintenance.estCost")}
          </Label>
          <Input
            id={`${uid}-edit-cost`}
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={editCost}
            onChange={(e) => setEditCost(e.target.value)}
            className="text-sm h-8 bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label id={`${uid}-edit-type`} className="text-xs font-semibold">{t("maintenance.type")}</Label>
          <div className="flex gap-1.5 h-8" role="group" aria-labelledby={`${uid}-edit-type`}>
            <button
              type="button"
              aria-pressed={editIsDiy}
              onClick={() => setEditIsDiy(true)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border font-medium flex-1 justify-center ${editIsDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              <Hammer className="h-3 w-3" />{t("maintenance.diy")}
            </button>
            <button
              type="button"
              aria-pressed={!editIsDiy}
              onClick={() => setEditIsDiy(false)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border font-medium flex-1 justify-center ${!editIsDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              <UserCheck className="h-3 w-3" />{t("maintenance.pro")}
            </button>
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-0.5">
        <Button size="sm" onClick={handleConfirmEdit} disabled={busy} className="gap-1.5 h-8 text-xs">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
          {busy ? t("common.saving") : t("common.saveChanges")}
        </Button>
      </div>
    </div>
  );
}
