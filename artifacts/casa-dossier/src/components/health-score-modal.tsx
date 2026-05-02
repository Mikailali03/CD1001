import { useState } from "react";
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
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Wrench,
  Hammer,
  Star,
  TrendingUp,
  CalendarClock,
  UserCheck,
} from "lucide-react";
import { format, addDays } from "date-fns";
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
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  healthScore: number;
  healthGrade: string;
  overdueTaskCount: number;
  overdueTasks?: OverdueTask[];
  assetScores?: AssetScore[];
};

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  B: { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200"    },
  C: { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
  D: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200"  },
  F: { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200"     },
};

function TaskItem({ task }: { task: OverdueTask }) {
  const [expanded, setExpanded] = useState(false);
  const daysOverdue = Math.floor((Date.now() - new Date(task.nextDueDate).getTime()) / 86_400_000);

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug">{task.title}</p>
            <p className="text-xs text-destructive/80 mt-0.5">
              {daysOverdue} day{daysOverdue !== 1 ? "s" : ""} overdue · was due {format(new Date(task.nextDueDate), "MMM d")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {task.isDiy && (
            <Badge variant="secondary" className="text-[10px] font-bold gap-0.5 px-1.5">
              <Hammer className="h-2.5 w-2.5" />
              DIY
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function SpecItem({ spec, assetName }: { spec: MaintenanceSpec; assetName: string }) {
  const [expanded, setExpanded] = useState(false);

  const intervalLabel =
    spec.intervalDays < 60 ? `Every ${spec.intervalDays}d` :
    spec.intervalDays < 400 ? `Every ${Math.round(spec.intervalDays / 30)}mo` :
    `Every ${Math.round(spec.intervalDays / 365)}yr`;

  const priorityColors = {
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {spec.isDiy
            ? <Hammer className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            : <UserCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          }
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

      {/* description */}
      <p className="text-xs text-muted-foreground leading-relaxed">{spec.description}</p>

      {/* steps expand */}
      {spec.steps && spec.steps.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? "Hide steps" : `Show ${spec.steps.length} steps`}
          </button>
          {expanded && (
            <ol className="mt-2 space-y-1.5 pl-4 list-decimal marker:text-muted-foreground">
              {spec.steps.map((step, i) => (
                <li key={i} className="text-xs text-foreground/80 leading-snug pl-0.5">{step}</li>
              ))}
            </ol>
          )}
          {expanded && spec.toolsNeeded && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-muted-foreground font-medium">Tools:</span>
              {spec.toolsNeeded.map((t) => (
                <span key={t} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-medium">{t}</span>
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

export function HealthScoreModal({
  open,
  onOpenChange,
  healthScore,
  healthGrade,
  overdueTaskCount,
  overdueTasks = [],
  assetScores = [],
}: Props) {
  const gc = GRADE_COLORS[healthGrade] ?? GRADE_COLORS["C"]!;

  // For each asset, get the top 2 manufacturer-recommended tasks
  const recommendedByAsset = assetScores
    .slice()
    .sort((a, b) => a.score - b.score) // lowest score first
    .flatMap((asset) =>
      getSpecsForCategory(asset.category)
        .filter((s) => s.isDiy) // DIY first
        .slice(0, 2)
        .map((spec) => ({ spec, asset }))
    )
    .slice(0, 10);

  const pointGain = Math.min(overdueTaskCount * 15, 100);
  const potentialScore = Math.min(healthScore + pointGain, 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">Your Home Improvement Plan</DialogTitle>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${gc.bg} ${gc.text} ${gc.border}`}>
              <TrendingUp className="h-3.5 w-3.5" />
              Grade {healthGrade} · {healthScore}/100
            </div>
          </div>
          {overdueTaskCount > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <Star className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm text-foreground">
                Fix your {overdueTaskCount} overdue task{overdueTaskCount !== 1 ? "s" : ""} to jump to{" "}
                <span className="font-bold text-primary">{potentialScore}/100</span>
              </p>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-6">

            {/* Section 1: Overdue tasks */}
            {overdueTaskCount > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarClock className="h-4 w-4 text-destructive" />
                  <h3 className="text-sm font-semibold">Fix First — Overdue Tasks</h3>
                  <span className="text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full font-bold ml-auto">
                    {overdueTaskCount} overdue
                  </span>
                </div>
                <div className="space-y-2">
                  {overdueTasks.length > 0
                    ? overdueTasks.map((t) => <TaskItem key={t.id} task={t} />)
                    : Array.from({ length: Math.min(overdueTaskCount, 3) }).map((_, i) => (
                        <div key={i} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <p className="text-sm font-medium text-muted-foreground">Overdue maintenance task</p>
                          </div>
                        </div>
                      ))}
                </div>
              </section>
            )}

            {overdueTaskCount > 0 && recommendedByAsset.length > 0 && <Separator />}

            {/* Section 2: Manufacturer-recommended DIY tasks */}
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
                    <SpecItem key={`${asset.assetId}-${i}`} spec={spec} assetName={asset.assetName} />
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

        <div className="border-t px-6 py-4 flex items-center justify-between gap-3 bg-muted/30">
          <p className="text-xs text-muted-foreground leading-snug">
            Completing DIY tasks is free and builds your home's documented history.
          </p>
          <Button size="sm" onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
