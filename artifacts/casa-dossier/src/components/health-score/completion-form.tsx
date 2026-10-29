import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, DollarSign, Hammer, Loader2, Receipt, UserCheck, UserRound } from "lucide-react";
import { ReceiptUpload } from "@/components/receipt-upload";
import { DIY_TECHNICIAN_NAME } from "@/components/maintenance-inbox/types";
import type { CompletePayload } from "./types";

export function CompletionForm({
  isDiyDefault,
  estimatedCost,
  titleHint,
  onDone,
  onCancel,
}: {
  isDiyDefault: boolean;
  estimatedCost?: string | number | null;
  titleHint: string;
  onDone: (payload: CompletePayload) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(estimatedCost ? String(Number(estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState<boolean>(isDiyDefault);
  const [technicianName, setTechnicianName] = useState(isDiyDefault ? DIY_TECHNICIAN_NAME : "");
  const [companyName, setCompanyName] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const uid = useId();

  function toggleDiy(diy: boolean) {
    setIsDiy(diy);
    setTechnicianName(diy ? DIY_TECHNICIAN_NAME : "");
  }

  async function submit() {
    setBusy(true);
    try {
      await onDone({
        notes: notes.trim() || undefined,
        isDiy,
        cost: cost ? parseFloat(cost) : undefined,
        technicianName: technicianName.trim() || undefined,
        companyName: companyName.trim() || undefined,
        receiptUrl: receiptUrl || undefined,
        completedDate: new Date().toLocaleDateString("en-CA"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg bg-muted/50 border p-3 animate-in slide-in-from-top-2 duration-200">
      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-notes`} className="text-xs font-semibold">{t("maintenance.notesOptional")}</Label>
        <Textarea
          id={`${uid}-notes`}
          placeholder={t("maintenance.notesPlaceholder", { task: titleHint.toLowerCase() })}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-sm min-h-[56px] resize-none bg-background"
          autoFocus
        />
      </div>

      {/* Cost + Receipt */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-cost`} className="text-xs font-semibold flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> {t("maintenance.actualCost")}
          </Label>
          <Input
            id={`${uid}-cost`}
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="text-sm h-8 bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-receipt`} className="text-xs font-semibold flex items-center gap-1">
            <Receipt className="h-3 w-3" /> {t("receipt.alt")}
          </Label>
          <ReceiptUpload
            id={`${uid}-receipt`}
            value={receiptUrl}
            onChange={setReceiptUrl}
            onUploadingChange={setReceiptUploading}
            className="bg-background rounded-md"
          />
        </div>
      </div>

      {/* DIY / Pro toggle */}
      <div className="space-y-1.5">
        <Label id={`${uid}-who`} className="text-xs font-semibold">{t("maintenance.whoDidTheWork")}</Label>
        <div className="flex gap-2" role="group" aria-labelledby={`${uid}-who`}>
          <button
            type="button"
            aria-pressed={isDiy}
            onClick={() => toggleDiy(true)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            <Hammer className="h-3.5 w-3.5" /> {t("maintenance.didItMyself")}
          </button>
          <button
            type="button"
            aria-pressed={!isDiy}
            onClick={() => toggleDiy(false)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${!isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            <UserCheck className="h-3.5 w-3.5" /> {t("maintenance.hiredAPro")}
          </button>
        </div>
      </div>

      {/* Pro fields */}
      {!isDiy && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-tech`} className="text-xs font-semibold flex items-center gap-1">
              <UserRound className="h-3 w-3" /> {t("maintenance.technician")}
            </Label>
            <Input id={`${uid}-tech`} placeholder={t("maintenance.namePlaceholder")} value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} className="text-sm h-8 bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-company`} className="text-xs font-semibold">{t("maintenance.company")}</Label>
            <Input id={`${uid}-company`} placeholder={t("maintenance.companyPlaceholder")} value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="text-sm h-8 bg-background" />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-0.5">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">{t("common.cancel")}</Button>
        <Button size="sm" onClick={submit} disabled={busy || receiptUploading} className="h-7 gap-1.5 text-xs">
          {busy || receiptUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {busy ? t("common.saving") : receiptUploading ? t("common.uploading") : t("maintenance.markComplete")}
        </Button>
      </div>
    </div>
  );
}
