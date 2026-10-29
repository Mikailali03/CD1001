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
import { DollarSign, Hammer, Loader2, Plus, UserCheck } from "lucide-react";
import { FieldError } from "@/components/field-error";
import { INBOX_INTERVAL_VALUES, type AssetOption, type TaskFormPayload } from "./types";

type NewTaskFormProps = {
  propertyId: string;
  assets: AssetOption[];
  onSave: (assetId: string, data: TaskFormPayload) => Promise<void>;
  onCancel: () => void;
};

export function NewTaskForm({ assets, onSave, onCancel }: NewTaskFormProps) {
  const { t } = useTranslation();
  const today = new Date().toLocaleDateString("en-CA");
  const [title, setTitle] = useState("");
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [intervalDays, setIntervalDays] = useState("90");
  const [nextDueDate, setNextDueDate] = useState(today);
  const [estimatedCost, setEstimatedCost] = useState("");
  const [isDiy, setIsDiy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; assetId?: string }>({});
  const uid = useId();

  async function handleSubmit() {
    const next: typeof errors = {};
    if (!title.trim()) next.title = t("maintenance.titleRequired");
    if (!assetId) next.assetId = t("maintenance.selectAssetError");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      await onSave(assetId, {
        title: title.trim(),
        description: description.trim() || undefined,
        intervalDays: parseInt(intervalDays),
        nextDueDate,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        isDiy,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t bg-muted/30 px-4 py-4 space-y-3 rounded-b-xl">
      <p className="text-xs font-bold text-foreground uppercase tracking-wide">{t("maintenance.newManualTask")}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-title`} className="text-xs font-semibold">{t("maintenance.taskTitle")} <span className="text-destructive" aria-hidden="true">*</span></Label>
          <Input
            id={`${uid}-title`}
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors((p) => ({ ...p, title: undefined })); }}
            placeholder={t("maintenance.titlePlaceholder")}
            className="text-sm h-8 bg-background"
            autoFocus
            required
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? `${uid}-title-error` : undefined}
          />
          <FieldError id={`${uid}-title-error`} message={errors.title} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-asset`} className="text-xs font-semibold">{t("maintenance.asset")} <span className="text-destructive" aria-hidden="true">*</span></Label>
          <Select value={assetId} onValueChange={(v) => { setAssetId(v); setErrors((p) => ({ ...p, assetId: undefined })); }}>
            <SelectTrigger
              id={`${uid}-asset`}
              className="h-8 text-xs bg-background"
              aria-invalid={!!errors.assetId}
              aria-describedby={errors.assetId ? `${uid}-asset-error` : undefined}
            >
              <SelectValue placeholder={t("maintenance.selectAsset")} />
            </SelectTrigger>
            <SelectContent>
              {assets.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id={`${uid}-asset-error`} message={errors.assetId} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-desc`} className="text-xs font-semibold">{t("maintenance.descriptionOptional")}</Label>
        <Textarea
          id={`${uid}-desc`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("maintenance.whatAndWhyPlaceholder")}
          className="text-sm resize-none h-14 bg-background"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-interval`} className="text-xs font-semibold">{t("maintenance.recurrence")}</Label>
          <Select value={intervalDays} onValueChange={setIntervalDays}>
            <SelectTrigger id={`${uid}-interval`} className="h-8 text-xs bg-background">
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
          <Label htmlFor={`${uid}-due`} className="text-xs font-semibold">{t("maintenance.dueDate")}</Label>
          <Input
            id={`${uid}-due`}
            type="date"
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            className="text-sm h-8 bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-cost`} className="text-xs font-semibold flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> {t("maintenance.estCost")}
          </Label>
          <Input
            id={`${uid}-cost`}
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            className="text-sm h-8 bg-background"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label id={`${uid}-type`} className="text-xs font-semibold">{t("maintenance.type")}</Label>
        <div className="flex gap-2" role="group" aria-labelledby={`${uid}-type`}>
          <button
            type="button"
            aria-pressed={isDiy}
            onClick={() => setIsDiy(true)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium flex-1 justify-center ${isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            <Hammer className="h-3.5 w-3.5" />{t("maintenance.diy")}
          </button>
          <button
            type="button"
            aria-pressed={!isDiy}
            onClick={() => setIsDiy(false)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium flex-1 justify-center ${!isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            <UserCheck className="h-3.5 w-3.5" />{t("maintenance.hireAPro")}
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-0.5">
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 text-xs">
          {t("common.cancel")}
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={busy} className="gap-1.5 h-8 text-xs">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {busy ? t("common.saving") : t("maintenance.addTask")}
        </Button>
      </div>
    </div>
  );
}
