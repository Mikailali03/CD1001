import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Hammer,
  TrendingUp,
  CalendarClock,
  UserCheck,
  Check,
  Loader2,
  RefreshCw,
  DollarSign,
  Receipt,
  Upload,
  UserRound,
  X,
  Calendar,
  Lock,
  Sparkles,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { useSubscription, isBasicPlus } from "@/contexts/subscription-context";
import { format, addDays } from "date-fns";
import { getSpecsForCategory } from "@/lib/maintenance-specs";
import type { MaintenanceSpec } from "@/lib/maintenance-specs";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type AssetScore = {
  assetId: string;
  assetName: string;
  category: string;
  score: number;
  ageYears: number;
  lifespanYears: number;
};

type OverdueTask = {
  id: string;
  title: string;
  nextDueDate: string;
  isDiy?: boolean;
  assetId?: string;
  assetName?: string;
  estimatedCost?: string | null;
};

type CompletePayload = {
  notes?: string;
  isDiy: boolean;
  cost?: number;
  technicianName?: string;
  companyName?: string;
  receiptUrl?: string;
  completedDate: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  healthScore: number;
  healthGrade: string;
  overdueTaskCount: number;
  overdueTasks?: OverdueTask[];
  assetScores?: AssetScore[];
  propertyId: string;
};

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  B: { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200"    },
  C: { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
  D: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200"  },
  F: { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200"     },
};

async function compressImage(file: File, maxPx = 1024, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Shared completion form ────────────────────────────────────────────────────
function CompletionForm({
  isDiyDefault,
  estimatedCost,
  titleHint,
  onDone,
  onCancel,
}: {
  isDiyDefault: boolean;
  estimatedCost?: string | null;
  titleHint: string;
  onDone: (payload: CompletePayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(estimatedCost ? String(Number(estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState<boolean>(isDiyDefault);
  const [technicianName, setTechnicianName] = useState(isDiyDefault ? "Homeowner (DIY)" : "");
  const [companyName, setCompanyName] = useState("");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  function toggleDiy(diy: boolean) {
    setIsDiy(diy);
    setTechnicianName(diy ? "Homeowner (DIY)" : "");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setReceiptData(compressed);
      setReceiptPreview(compressed);
    } catch {
      toast({ title: "Could not read image", variant: "destructive" });
    }
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
        receiptUrl: receiptData || undefined,
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
        <Label className="text-xs font-semibold">Notes (optional)</Label>
        <Textarea
          placeholder={`e.g. Completed ${titleHint.toLowerCase()}. Everything looks good.`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-sm min-h-[56px] resize-none bg-background"
          autoFocus
        />
      </div>

      {/* Cost + Receipt */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Actual Cost
          </Label>
          <Input
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
          <Label className="text-xs font-semibold flex items-center gap-1">
            <Receipt className="h-3 w-3" /> Receipt
          </Label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          {receiptPreview ? (
            <div className="relative h-8">
              <img src={receiptPreview} alt="Receipt" className="h-8 w-full object-cover rounded-md border" />
              <button
                className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => { setReceiptPreview(null); setReceiptData(null); if (fileRef.current) fileRef.current.value = ""; }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="h-8 w-full rounded-md border border-dashed border-border bg-background hover:bg-muted flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Upload className="h-3 w-3" /> Upload image
            </button>
          )}
        </div>
      </div>

      {/* DIY / Pro toggle */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Who did the work?</Label>
        <div className="flex gap-2">
          <button
            onClick={() => toggleDiy(true)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            <Hammer className="h-3.5 w-3.5" /> I did it myself
          </button>
          <button
            onClick={() => toggleDiy(false)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${!isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            <UserCheck className="h-3.5 w-3.5" /> Hired a pro
          </button>
        </div>
      </div>

      {/* Pro fields */}
      {!isDiy && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <UserRound className="h-3 w-3" /> Technician
            </Label>
            <Input placeholder="Name" value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} className="text-sm h-8 bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Company</Label>
            <Input placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="text-sm h-8 bg-background" />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-0.5">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">Cancel</Button>
        <Button size="sm" onClick={submit} disabled={busy} className="h-7 gap-1.5 text-xs">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {busy ? "Saving…" : "Mark Complete"}
        </Button>
      </div>
    </div>
  );
}

// ── Overdue task row ──────────────────────────────────────────────────────────
function TaskItem({
  task,
  done,
  onMarkDone,
}: {
  task: OverdueTask;
  done: boolean;
  onMarkDone: (taskId: string, payload: CompletePayload) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const daysOverdue = Math.floor((Date.now() - new Date(task.nextDueDate).getTime()) / 86_400_000);

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-800 line-through opacity-70 truncate">{task.title}</p>
        </div>
        <span className="text-[10px] text-emerald-600 font-semibold shrink-0">Done ✓</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/25 bg-destructive/5 overflow-hidden">
      <div className="flex items-start gap-2.5 p-3">
        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium leading-snug">{task.title}</p>
          <p className="text-xs text-muted-foreground">
            {task.assetName && <span className="font-medium">{task.assetName} · </span>}
            <span className="text-destructive/80 font-medium">{daysOverdue}d overdue</span>
            {" · was due "}
            {format(new Date(task.nextDueDate), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {task.isDiy && (
            <Badge variant="secondary" className="text-[10px] font-bold gap-0.5 px-1.5">
              <Hammer className="h-2.5 w-2.5" /> DIY
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            onClick={() => setExpanded(!expanded)}
          >
            <Check className="h-3 w-3" /> Done
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <CompletionForm
            isDiyDefault={task.isDiy ?? true}
            estimatedCost={task.estimatedCost}
            titleHint={task.title}
            onDone={(payload) => onMarkDone(task.id, payload)}
            onCancel={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  );
}

// ── Manufacturer spec row ─────────────────────────────────────────────────────
function SpecItem({
  spec,
  assetId,
  assetName,
  done,
  onMarkDone,
}: {
  spec: MaintenanceSpec;
  assetId: string;
  assetName: string;
  done: boolean;
  onMarkDone: (assetId: string, spec: MaintenanceSpec, payload: CompletePayload) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  // Next due = today (untracked recommendation — suggest starting now)
  const nextDueDate = new Date();
  const nextDueDateAfterCompletion = addDays(new Date(), spec.intervalDays);

  const intervalLabel =
    spec.intervalDays < 60
      ? `Every ${spec.intervalDays}d`
      : spec.intervalDays < 400
      ? `Every ${Math.round(spec.intervalDays / 30)}mo`
      : `Every ${Math.round(spec.intervalDays / 365)}yr`;

  const priorityColors = {
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-slate-100 text-slate-600",
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-800 line-through opacity-70 truncate">{spec.title}</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Next due: {format(nextDueDateAfterCompletion, "MMM d, yyyy")} · Now tracked
          </p>
        </div>
        <span className="text-[10px] text-emerald-600 font-semibold shrink-0">Done ✓</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            {spec.isDiy ? (
              <Hammer className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            ) : (
              <UserCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{spec.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {assetName} · {intervalLabel}
                {spec.estimatedMinutes && ` · ~${spec.estimatedMinutes} min`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priorityColors[spec.priority]}`}>
              {spec.priority}
            </span>
            {spec.isDiy ? (
              <Badge variant="secondary" className="text-[10px] font-bold gap-0.5 px-1.5">
                <Hammer className="h-2.5 w-2.5" /> DIY
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-medium gap-0.5 px-1.5">
                <UserCheck className="h-2.5 w-2.5" /> Pro
              </Badge>
            )}
          </div>
        </div>

        {/* Next due date */}
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>
            <span className="font-semibold">Recommended now</span>
            {" · next due "}
            <span className="font-semibold">{format(nextDueDateAfterCompletion, "MMM d, yyyy")}</span>
            {" after completion"}
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">{spec.description}</p>

        <div className="flex items-center gap-2">
          {spec.steps && spec.steps.length > 0 && (
            <button
              onClick={() => setStepsOpen(!stepsOpen)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {stepsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {stepsOpen ? "Hide steps" : `Show ${spec.steps.length} steps`}
            </button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 ml-auto"
            onClick={() => setExpanded(!expanded)}
          >
            <Check className="h-3 w-3" /> Done
          </Button>
        </div>

        {stepsOpen && spec.steps && (
          <div>
            <ol className="mt-1 space-y-1.5 pl-4 list-decimal marker:text-muted-foreground">
              {spec.steps.map((step, i) => (
                <li key={i} className="text-xs text-foreground/80 leading-snug pl-0.5">{step}</li>
              ))}
            </ol>
            {spec.toolsNeeded && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">Tools:</span>
                {spec.toolsNeeded.map((t) => (
                  <span key={t} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-medium">{t}</span>
                ))}
              </div>
            )}
            {spec.safetyNotes && (
              <div className="mt-2 rounded bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-800 leading-snug">
                ⚠️ {spec.safetyNotes}
              </div>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3">
          <CompletionForm
            isDiyDefault={spec.isDiy}
            titleHint={spec.title}
            onDone={(payload) => onMarkDone(assetId, spec, payload)}
            onCancel={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function HealthScoreModal({
  open,
  onOpenChange,
  healthScore,
  healthGrade,
  overdueTaskCount,
  overdueTasks = [],
  assetScores = [],
  propertyId,
}: Props) {
  const gc = GRADE_COLORS[healthGrade] ?? GRADE_COLORS["C"]!;
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();
  const { toast } = useToast();
  const { subscription, openUpgradeModal } = useSubscription();
  const locked = !isBasicPlus(subscription?.tier);

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  // Key = `${assetId}:${spec.title}` for spec completions
  const [completedSpecKeys, setCompletedSpecKeys] = useState<Set<string>>(new Set());

  const remainingOverdue = overdueTaskCount - completedIds.size;
  const pointGain = Math.min(overdueTaskCount * 15, 100);
  const potentialScore = Math.min(healthScore + pointGain, 100);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["property-summary", propertyId] });
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey.includes(propertyId) });
    queryClient.invalidateQueries({
      predicate: (q) =>
        q.queryKey.some(
          (k) => typeof k === "string" && (k.includes("inbox") || k.includes("ledger") || k.includes("summary"))
        ),
    });
  }

  async function handleMarkDone(taskId: string, payload: CompletePayload) {
    const res = await authFetch(`${BASE}/api/maintenance/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      toast({ title: "Something went wrong", description: "Could not mark task as done. Please try again.", variant: "destructive" });
      return;
    }

    setCompletedIds((prev) => new Set([...prev, taskId]));
    invalidateAll();

    toast({
      title: "Task marked complete! 🎉",
      description: payload.notes?.trim() ? "Notes saved and next recurrence scheduled." : "Next recurrence has been scheduled.",
    });
  }

  async function handleMarkSpecDone(assetId: string, spec: MaintenanceSpec, payload: CompletePayload) {
    // Step 1: create the task for this asset
    const createRes = await authFetch(`${BASE}/api/assets/${assetId}/maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: spec.title,
        description: spec.description,
        intervalDays: spec.intervalDays,
        isDiy: spec.isDiy,
        nextDueDate: new Date().toLocaleDateString("en-CA"),
      }),
    });

    if (!createRes.ok) {
      toast({ title: "Something went wrong", description: "Could not create task. Please try again.", variant: "destructive" });
      return;
    }

    const task = await createRes.json();

    // Step 2: immediately complete it
    const completeRes = await authFetch(`${BASE}/api/maintenance/${task.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!completeRes.ok) {
      toast({ title: "Something went wrong", description: "Task created but could not be marked complete.", variant: "destructive" });
      return;
    }

    setCompletedSpecKeys((prev) => new Set([...prev, `${assetId}:${spec.title}`]));
    invalidateAll();

    toast({
      title: "Task logged and scheduled! 🎉",
      description: `${spec.title} is now tracked. Next due in ${spec.intervalDays} days.`,
    });
  }

  const recommendedByAsset = assetScores
    .slice()
    .sort((a, b) => a.score - b.score)
    .flatMap((asset) =>
      getSpecsForCategory(asset.category)
        .filter((s) => s.isDiy)
        .slice(0, 2)
        .map((spec) => ({ spec, asset }))
    )
    .slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 gap-0">
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">Your Home Improvement Plan</DialogTitle>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${gc.bg} ${gc.text} ${gc.border}`}>
              <TrendingUp className="h-3.5 w-3.5" />
              Grade {healthGrade} · {healthScore}/100
            </div>
          </div>

          {overdueTaskCount > 0 && completedIds.size < overdueTaskCount && (
            <div className="mt-3 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <TrendingUp className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm text-foreground">
                Fix {remainingOverdue} remaining task{remainingOverdue !== 1 ? "s" : ""} to reach{" "}
                <span className="font-bold text-primary">{potentialScore}/100</span>
              </p>
            </div>
          )}
          {completedIds.size > 0 && completedIds.size >= overdueTaskCount && (
            <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-800 font-medium">All overdue tasks complete — great work! Your score is updating.</p>
              <RefreshCw className="h-3.5 w-3.5 text-emerald-600 animate-spin shrink-0" />
            </div>
          )}
        </DialogHeader>

        {locked ? (
          /* ── Locked: blurred preview + upgrade overlay ── */
          <div className="relative flex-1">
            {/* Blurred fake content */}
            <div className="blur-sm pointer-events-none select-none opacity-50 px-6 py-4 space-y-4" aria-hidden>
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold">Fix First — Overdue Tasks</span>
                <span className="text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full font-bold ml-auto">3 remaining</span>
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg border border-destructive/25 bg-destructive/5" />
              ))}
              <Separator />
              <div className="flex items-center gap-2 mb-3">
                <Hammer className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Recommended by Manufacturers</span>
                <Badge variant="secondary" className="text-[10px] font-bold ml-auto">DIY First</Badge>
              </div>
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-lg border bg-card" />
              ))}
            </div>

            {/* Upgrade overlay */}
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="bg-background/95 backdrop-blur-sm rounded-2xl border shadow-xl p-6 w-full max-w-sm text-center space-y-4">
                <div className="flex justify-center">
                  <div className="bg-primary/10 rounded-full p-4">
                    <Lock className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-bold">Unlock Your Home Improvement Plan</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    See overdue tasks, manufacturer-recommended maintenance, and a personalized action plan to protect your home's value.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    <span className="leading-snug text-center">Overdue task alerts</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <span className="leading-snug text-center">Manufacturer specs</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="leading-snug text-center">Score improvement tips</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => { onOpenChange(false); openUpgradeModal(); }}
                    className="w-full gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Upgrade to Basic — $9.99/mo
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground">
                    Maybe later
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="px-6 py-4 space-y-6">

                {/* ── Section 1: Overdue tasks ── */}
                {overdueTaskCount > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <CalendarClock className="h-4 w-4 text-destructive" />
                      <h3 className="text-sm font-semibold">Fix First — Overdue Tasks</h3>
                      <span className="text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full font-bold ml-auto">
                        {remainingOverdue} remaining
                      </span>
                    </div>
                    <div className="space-y-2">
                      {overdueTasks.map((t) => (
                        <TaskItem key={t.id} task={t} done={completedIds.has(t.id)} onMarkDone={handleMarkDone} />
                      ))}
                    </div>
                  </section>
                )}

                {overdueTaskCount > 0 && recommendedByAsset.length > 0 && <Separator />}

                {/* ── Section 2: Manufacturer-spec DIY tasks ── */}
                {recommendedByAsset.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Hammer className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Recommended by Manufacturers</h3>
                      <Badge variant="secondary" className="text-[10px] font-bold ml-auto">DIY First</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      These tasks come from manufacturer maintenance specs for your tracked assets. Completing them adds a service record and starts the recurring schedule.
                    </p>
                    <div className="space-y-2">
                      {recommendedByAsset.map(({ spec, asset }, i) => (
                        <SpecItem
                          key={`${asset.assetId}-${i}`}
                          spec={spec}
                          assetId={asset.assetId}
                          assetName={asset.assetName}
                          done={completedSpecKeys.has(`${asset.assetId}:${spec.title}`)}
                          onMarkDone={handleMarkSpecDone}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {overdueTaskCount === 0 && recommendedByAsset.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3 opacity-70" />
                    <p className="font-semibold">Great shape!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      No immediate action needed. Check back after adding more assets or maintenance schedules.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* ── Footer ── */}
            <div className="border-t px-6 py-4 flex items-center justify-between gap-3 bg-muted/30">
              <p className="text-xs text-muted-foreground leading-snug">
                Completing tasks builds your home's documented history.
              </p>
              <Button size="sm" onClick={() => onOpenChange(false)} variant="outline">Close</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
