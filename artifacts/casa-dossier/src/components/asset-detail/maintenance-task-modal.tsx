import { useState, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  completeMaintenanceTask,
  getListMaintenanceTasksQueryKey,
  getListServiceRecordsQueryKey,
  getGetPropertyMaintenanceInboxQueryKey,
  getGetPropertySummaryQueryKey,
  type MaintenanceTask,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle, CheckCheck, CheckCircle2, Clock, DollarSign, Hammer,
  Loader2, Receipt, RefreshCw, UserCheck, UserRound, X,
} from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { ReceiptUpload } from "@/components/receipt-upload";
import { StepList } from "./step-list";
import { dueLabel } from "./due-label";

// Stored sentinel the server also writes for DIY records; not a display string.
const DIY_TECHNICIAN_NAME = "Homeowner (DIY)";

// ── Maintenance Task Detail + Completion Modal ────────────────────────────────
export function MaintenanceTaskModal({
  task,
  assetId,
  propertyId,
  open,
  onClose,
  onComplete,
}: {
  task: MaintenanceTask;
  assetId: string;
  propertyId: string;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const today = new Date();
  const diff = differenceInCalendarDays(new Date(task.nextDueDate), today);
  const isOverdue = diff < 0;
  const isSoon = diff >= 0 && diff <= 14;

  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(task.estimatedCost ? String(Number(task.estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState<boolean>(task.isDiy ?? true);
  const [technicianName, setTechnicianName] = useState(task.isDiy !== false ? DIY_TECHNICIAN_NAME : "");
  const [companyName, setCompanyName] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const uid = useId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  function resetForm() {
    setNotes(""); setCost(task.estimatedCost ? String(Number(task.estimatedCost)) : "");
    setIsDiy(task.isDiy ?? true); setTechnicianName(task.isDiy !== false ? DIY_TECHNICIAN_NAME : "");
    setCompanyName(""); setReceiptUrl(null);
  }

  function handleClose() { resetForm(); onClose(); }

  function toggleDiy(diy: boolean) {
    setIsDiy(diy);
    setTechnicianName(diy ? DIY_TECHNICIAN_NAME : "");
  }

  async function handleSubmit() {
    setBusy(true);
    try {
      await completeMaintenanceTask(task.id, {
        notes: notes.trim() || undefined,
        isDiy,
        cost: cost ? parseFloat(cost) : undefined,
        technicianName: technicianName.trim() || undefined,
        companyName: companyName.trim() || undefined,
        receiptUrl: receiptUrl || undefined,
        completedDate: new Date().toLocaleDateString("en-CA"),
      });
      toast({ title: t("assetDetail.toast.taskCompleted"), description: t("assetDetail.toast.taskCompletedDesc") });
      queryClient.invalidateQueries({ queryKey: getListMaintenanceTasksQueryKey(assetId) });
      queryClient.invalidateQueries({ queryKey: getListServiceRecordsQueryKey(assetId) });
      queryClient.invalidateQueries({ queryKey: getGetPropertyMaintenanceInboxQueryKey(propertyId) });
      queryClient.invalidateQueries({ queryKey: getGetPropertySummaryQueryKey(propertyId) });
      resetForm();
      onComplete();
    } catch {
      toast({ title: t("assetDetail.toast.taskCompleteFailed"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent hideCloseButton className="max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogTitle className="sr-only">{task.title}</DialogTitle>
        <DialogDescription className="sr-only">{t("assetDetail.task.modalDescription")}</DialogDescription>

        {/* ── Modal header ── */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isOverdue
                  ? "bg-destructive/10 text-destructive"
                  : isSoon
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-muted text-muted-foreground"
              }`}>
                {isOverdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {dueLabel(t, diff, task.nextDueDate)}
              </span>
              {task.isDiy && (
                <Badge variant="secondary" className="text-[10px] gap-0.5 h-5">
                  <Hammer className="h-2.5 w-2.5" /> {t("assetDetail.task.diy")}
                </Badge>
              )}
              {!!task.estimatedCost && Number(task.estimatedCost) > 0 && (
                <Badge variant="outline" className="text-[10px] gap-0.5 h-5">
                  <DollarSign className="h-2.5 w-2.5" /> {t("assetDetail.task.estAmount", { amount: Number(task.estimatedCost).toLocaleString() })}
                </Badge>
              )}
              {!!task.intervalDays && (
                <Badge variant="outline" className="text-[10px] gap-0.5 h-5">
                  <RefreshCw className="h-2.5 w-2.5" /> {t("assetDetail.due.every", { days: task.intervalDays })}
                </Badge>
              )}
            </div>
            <h2 className="text-base font-bold leading-snug">{task.title}</h2>
          </div>
          <button
            onClick={handleClose}
            aria-label={t("common.close")}
            className="shrink-0 rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Task description / steps */}
          {task.description && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("assetDetail.task.howTo")}</p>
              <StepList description={task.description} />
            </div>
          )}

          {/* Divider */}
          <div className="border-t" />

          {/* Completion form */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {t("assetDetail.task.markAsComplete")}
            </p>
            <div className="space-y-3.5">

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-notes`} className="text-xs font-semibold">{t("assetDetail.task.notesOptional")}</Label>
                <Textarea
                  id={`${uid}-notes`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("assetDetail.task.notesPlaceholder", { title: task.title.toLowerCase() })}
                  className="resize-none h-16 text-sm"
                />
              </div>

              {/* Cost + Receipt */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${uid}-cost`} className="text-xs font-semibold flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> {t("assetDetail.task.actualCost")}
                  </Label>
                  <Input id={`${uid}-cost`} type="number" min={0} step="0.01" placeholder="0.00" value={cost}
                    onChange={(e) => setCost(e.target.value)} className="text-sm h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${uid}-receipt`} className="text-xs font-semibold flex items-center gap-1">
                    <Receipt className="h-3 w-3" /> {t("assetDetail.task.receipt")}
                  </Label>
                  <ReceiptUpload
                    id={`${uid}-receipt`}
                    value={receiptUrl}
                    onChange={setReceiptUrl}
                    onUploadingChange={setReceiptUploading}
                  />
                </div>
              </div>

              {/* DIY / Pro toggle */}
              <div className="space-y-1.5">
                <Label id={`${uid}-who`} className="text-xs font-semibold">{t("assetDetail.who.label")}</Label>
                <div className="flex gap-2" role="group" aria-labelledby={`${uid}-who`}>
                  <button type="button" aria-pressed={isDiy} onClick={() => toggleDiy(true)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                    <Hammer className="h-3.5 w-3.5" /> {t("assetDetail.who.myself")}
                  </button>
                  <button type="button" aria-pressed={!isDiy} onClick={() => toggleDiy(false)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${!isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                    <UserCheck className="h-3.5 w-3.5" /> {t("assetDetail.who.pro")}
                  </button>
                </div>
              </div>

              {/* Pro fields */}
              {!isDiy && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${uid}-tech`} className="text-xs font-semibold flex items-center gap-1"><UserRound className="h-3 w-3" /> {t("assetDetail.who.technician")}</Label>
                    <Input id={`${uid}-tech`} placeholder={t("assetDetail.who.namePlaceholder")} value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} className="text-sm h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${uid}-company`} className="text-xs font-semibold">{t("assetDetail.who.company")}</Label>
                    <Input id={`${uid}-company`} placeholder={t("assetDetail.who.companyPlaceholder")} value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="text-sm h-8" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sticky footer ── */}
        <div className="border-t px-5 py-3.5 flex gap-2 shrink-0 bg-background">
          <Button variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={handleClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" className="flex-1 h-9 text-sm gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            onClick={handleSubmit} disabled={busy || receiptUploading}>
            {busy || receiptUploading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {busy ? t("common.saving") : t("common.uploading")}</>
              : <><CheckCheck className="h-4 w-4" /> {t("assetDetail.task.markComplete")}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
