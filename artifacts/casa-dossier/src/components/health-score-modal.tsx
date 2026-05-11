import { useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react";
import { format } from "date-fns";
import { getSpecsForCategory } from "@/lib/maintenance-specs";
import type { MaintenanceSpec } from "@/lib/maintenance-specs";

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

// ── Mark-Done inline form ─────────────────────────────────────────────────────
function MarkDoneForm({
  task,
  onDone,
  onCancel,
}: {
  task: OverdueTask;
  onDone: (taskId: string, notes: string, isDiy: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [isDiy, setIsDiy] = useState(task.isDiy ?? true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await onDone(task.id, notes, isDiy);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg bg-muted/50 border p-3 animate-in slide-in-from-top-2 duration-200">
      <div className="space-y-1">
        <Label className="text-xs font-medium">Notes (optional)</Label>
        <Textarea
          placeholder="e.g. Replaced with Filtrete 1500 filter, cleaned the area…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-sm min-h-[60px] resize-none"
          autoFocus
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id={`diy-${task.id}`}
            checked={isDiy}
            onCheckedChange={setIsDiy}
          />
          <Label htmlFor={`diy-${task.id}`} className="text-xs cursor-pointer">
            I did this myself (DIY)
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={busy} className="h-7 gap-1 text-xs">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {busy ? "Saving…" : "Mark Done"}
          </Button>
        </div>
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
  onMarkDone: (taskId: string, notes: string, isDiy: boolean) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const daysOverdue = Math.floor(
    (Date.now() - new Date(task.nextDueDate).getTime()) / 86_400_000
  );

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
              <Hammer className="h-2.5 w-2.5" />
              DIY
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            onClick={() => setExpanded(!expanded)}
          >
            <Check className="h-3 w-3" />
            Done
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3">
          <MarkDoneForm
            task={task}
            onDone={onMarkDone}
            onCancel={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  );
}

// ── Manufacturer spec row ─────────────────────────────────────────────────────
function SpecItem({ spec, assetName }: { spec: MaintenanceSpec; assetName: string }) {
  const [expanded, setExpanded] = useState(false);

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

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
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
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priorityColors[spec.priority]}`}
          >
            {spec.priority}
          </span>
          {spec.isDiy ? (
            <Badge variant="secondary" className="text-[10px] font-bold gap-0.5 px-1.5">
              <Hammer className="h-2.5 w-2.5" />
              DIY
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] font-medium gap-0.5 px-1.5">
              <UserCheck className="h-2.5 w-2.5" />
              Pro
            </Badge>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{spec.description}</p>

      {spec.steps && spec.steps.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {expanded ? "Hide steps" : `Show ${spec.steps.length} steps`}
          </button>
          {expanded && (
            <ol className="mt-2 space-y-1.5 pl-4 list-decimal marker:text-muted-foreground">
              {spec.steps.map((step, i) => (
                <li key={i} className="text-xs text-foreground/80 leading-snug pl-0.5">
                  {step}
                </li>
              ))}
            </ol>
          )}
          {expanded && spec.toolsNeeded && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-muted-foreground font-medium">Tools:</span>
              {spec.toolsNeeded.map((t) => (
                <span key={t} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-medium">
                  {t}
                </span>
              ))}
            </div>
          )}
          {expanded && spec.safetyNotes && (
            <div className="mt-2 rounded bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-800 leading-snug">
              ⚠️ {spec.safetyNotes}
            </div>
          )}
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

  // Track locally-completed task IDs so UI updates immediately
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const remainingOverdue = overdueTaskCount - completedIds.size;
  const pointGain = Math.min(overdueTaskCount * 15, 100);
  const potentialScore = Math.min(healthScore + pointGain, 100);

  async function handleMarkDone(taskId: string, notes: string, isDiy: boolean) {
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    const res = await authFetch(`${BASE}/api/maintenance/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes.trim() || undefined, isDiy, completedDate: new Date().toLocaleDateString("en-CA") }),
    });

    if (!res.ok) {
      toast({
        title: "Something went wrong",
        description: "Could not mark task as done. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Optimistic: mark done locally immediately
    setCompletedIds((prev) => new Set([...prev, taskId]));

    // Refetch property summary so score ring updates
    await queryClient.invalidateQueries({
      queryKey: ["property-summary", propertyId],
    });
    // Also invalidate the default generated key pattern
    await queryClient.invalidateQueries({ predicate: (q) => q.queryKey.includes(propertyId) });

    toast({
      title: "Task marked done! 🎉",
      description: notes.trim()
        ? "Notes saved and next recurrence scheduled."
        : "Next recurrence has been scheduled.",
    });
  }

  // Manufacturer-spec recommendations per asset (lowest-score first, DIY first)
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
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${gc.bg} ${gc.text} ${gc.border}`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Grade {healthGrade} · {healthScore}/100
            </div>
          </div>

          {/* Score jump banner */}
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
              <p className="text-sm text-emerald-800 font-medium">
                All overdue tasks complete — great work! Your score is updating.
              </p>
              <RefreshCw className="h-3.5 w-3.5 text-emerald-600 animate-spin shrink-0" />
            </div>
          )}
        </DialogHeader>

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
                    <TaskItem
                      key={t.id}
                      task={t}
                      done={completedIds.has(t.id)}
                      onMarkDone={handleMarkDone}
                    />
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
                  <Badge variant="secondary" className="text-[10px] font-bold ml-auto">
                    DIY First
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  These tasks come from manufacturer maintenance specs for your tracked assets. Most take under an hour and require no special skills.
                </p>
                <div className="space-y-2">
                  {recommendedByAsset.map(({ spec, asset }, i) => (
                    <SpecItem
                      key={`${asset.assetId}-${i}`}
                      spec={spec}
                      assetName={asset.assetName}
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
            Completing DIY tasks builds your home's documented history.
          </p>
          <Button size="sm" onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
