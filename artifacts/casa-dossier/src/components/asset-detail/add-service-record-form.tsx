import { useState, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useCreateServiceRecord,
  getListServiceRecordsQueryKey,
  getGetPropertySummaryQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle2, DollarSign, FileText, Hammer, Loader2, Plus, UserCheck, UserRound, X } from "lucide-react";

// ── Inline Add Service Record Form ────────────────────────────────────────────
const TODAY = new Date().toISOString().split("T")[0]!;

// Stored sentinel the server also writes for DIY records; not a display string.
const DIY_TECHNICIAN_NAME = "Homeowner (DIY)";

type ServiceFormState = {
  description: string;
  date: string;
  isDiy: boolean;
  technicianName: string;
  companyName: string;
  cost: string;
};

const BLANK: ServiceFormState = { description: "", date: TODAY, isDiy: true, technicianName: DIY_TECHNICIAN_NAME, companyName: "", cost: "" };

export function AddServiceRecordForm({ assetId, propertyId, onSuccess }: {
  assetId: string;
  propertyId: string;
  gradeColor: string;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ServiceFormState>(BLANK);
  const uid = useId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useCreateServiceRecord({
    mutation: {
      onSuccess: () => {
        toast({ title: t("assetDetail.toast.recordSaved"), description: t("assetDetail.toast.recordSavedDesc") });
        queryClient.invalidateQueries({ queryKey: getListServiceRecordsQueryKey(assetId) });
        queryClient.invalidateQueries({ queryKey: getGetPropertySummaryQueryKey(propertyId) });
        setForm(BLANK);
        setOpen(false);
        onSuccess();
      },
      onError: () => {
        toast({ title: t("assetDetail.toast.recordSaveFailed"), variant: "destructive" });
      },
    },
  });

  function set<K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleDiy(diy: boolean) {
    setForm((f) => ({
      ...f,
      isDiy: diy,
      technicianName: diy ? DIY_TECHNICIAN_NAME : "",
    }));
  }

  function handleSubmit() {
    if (!form.description.trim()) return;
    mutation.mutate({
      assetId,
      data: {
        description: form.description.trim(),
        date: form.date,
        technicianName: form.technicianName.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
        cost: form.cost ? parseFloat(form.cost) : undefined,
      },
    });
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
          {t("assetDetail.record.logCta")}
        </button>
      </div>
    );
  }

  const toggleClass = (active: boolean) =>
    `flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${
      active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
    }`;

  return (
    <div className="mt-3 rounded-xl border-2 border-primary/20 bg-primary/3 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 bg-primary/5">
        <p className="text-sm font-bold flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" />
          {t("assetDetail.record.newTitle")}
        </p>
        <button onClick={() => { setOpen(false); setForm(BLANK); }} aria-label={t("assetDetail.record.closeNewForm")} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-desc`} className="text-xs font-semibold">{t("assetDetail.record.whatWasDone")} <span className="text-destructive" aria-hidden="true">*</span></Label>
          <Textarea
            id={`${uid}-desc`}
            required
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={t("assetDetail.record.descPlaceholder")}
            className="resize-none h-16 text-sm bg-background"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-date`} className="text-xs font-semibold flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {t("assetDetail.record.date")}
            </Label>
            <Input
              id={`${uid}-date`}
              type="date"
              value={form.date}
              max={TODAY}
              onChange={(e) => set("date", e.target.value)}
              className="text-sm h-8 bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-cost`} className="text-xs font-semibold flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> {t("assetDetail.record.costOptional")}
            </Label>
            <Input
              id={`${uid}-cost`}
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={form.cost}
              onChange={(e) => set("cost", e.target.value)}
              className="text-sm h-8 bg-background"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label id={`${uid}-who`} className="text-xs font-semibold">{t("assetDetail.who.label")}</Label>
          <div className="flex gap-2" role="group" aria-labelledby={`${uid}-who`}>
            <button type="button" aria-pressed={form.isDiy} onClick={() => toggleDiy(true)} className={toggleClass(form.isDiy)}>
              <Hammer className="h-3.5 w-3.5" />
              {t("assetDetail.who.myself")}
            </button>
            <button type="button" aria-pressed={!form.isDiy} onClick={() => toggleDiy(false)} className={toggleClass(!form.isDiy)}>
              <UserCheck className="h-3.5 w-3.5" />
              {t("assetDetail.who.pro")}
            </button>
          </div>
        </div>
        {!form.isDiy && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-tech`} className="text-xs font-semibold flex items-center gap-1">
                <UserRound className="h-3 w-3" /> {t("assetDetail.who.technician")}
              </Label>
              <Input
                id={`${uid}-tech`}
                placeholder={t("assetDetail.who.namePlaceholder")}
                value={form.technicianName}
                onChange={(e) => set("technicianName", e.target.value)}
                className="text-sm h-8 bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-company`} className="text-xs font-semibold">{t("assetDetail.who.company")}</Label>
              <Input
                id={`${uid}-company`}
                placeholder={t("assetDetail.who.companyPlaceholder")}
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                className="text-sm h-8 bg-background"
              />
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-0.5">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => { setOpen(false); setForm(BLANK); }}
            disabled={mutation.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5"
            onClick={handleSubmit}
            disabled={!form.description.trim() || mutation.isPending}
          >
            {mutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("common.saving")}</>
            ) : (
              <><CheckCircle2 className="h-3.5 w-3.5" /> {t("assetDetail.record.save")}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
