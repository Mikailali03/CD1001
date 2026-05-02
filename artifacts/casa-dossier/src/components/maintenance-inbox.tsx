import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Hammer,
  Calendar,
  ChevronRight,
  X,
  Loader2,
  Inbox,
  UserCheck,
  Wrench,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type InboxTask = {
  id: string;
  assetId: string;
  title: string;
  description: string | null;
  intervalDays: number;
  nextDueDate: string;
  isDiy: boolean;
  estimatedCost: string | null;
  assetName: string;
  assetCategory: string;
};

type InboxData = {
  overdue: InboxTask[];
  upcoming: InboxTask[];
  totalCount: number;
};

const CATEGORY_ICONS: Record<string, string> = {
  HVAC: "❄️",
  Plumbing: "🔧",
  Electrical: "⚡",
  Roof: "🏠",
  Appliance: "🫙",
  Structural: "🏗️",
  Other: "📦",
};

type TaskRowProps = {
  task: InboxTask;
  isOverdue: boolean;
  onDone: (taskId: string, notes: string, isDiy: boolean) => Promise<void>;
};

function TaskRow({ task, isOverdue, onDone }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");
  const [diyChecked, setDiyChecked] = useState(task.isDiy);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const today = new Date();
  const dueDate = new Date(task.nextDueDate);
  const daysDiff = differenceInCalendarDays(dueDate, today);
  const absdays = Math.abs(daysDiff);

  if (dismissed) return null;

  async function handleConfirm() {
    setBusy(true);
    try {
      await onDone(task.id, notes, diyChecked);
      setDismissed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`rounded-xl border transition-all ${
        isOverdue ? "border-destructive/25 bg-destructive/3" : "border-border bg-card"
      } ${expanded ? "shadow-sm" : ""}`}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Category icon */}
        <span className="text-lg shrink-0 mt-0.5 select-none">
          {CATEGORY_ICONS[task.assetCategory] ?? "📦"}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">{task.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.assetName}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {task.isDiy && (
                <Badge variant="secondary" className="text-[10px] font-bold gap-0.5 px-1.5 py-0.5 h-auto">
                  <Hammer className="h-2.5 w-2.5" />
                  DIY
                </Badge>
              )}
            </div>
          </div>

          {/* Due date line */}
          <div className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium ${isOverdue ? "text-destructive" : daysDiff <= 7 ? "text-amber-600" : "text-muted-foreground"}`}>
            {isOverdue ? (
              <AlertCircle className="h-3 w-3 shrink-0" />
            ) : (
              <Calendar className="h-3 w-3 shrink-0" />
            )}
            <span>
              {isOverdue
                ? `${absdays} day${absdays !== 1 ? "s" : ""} overdue · ${format(dueDate, "MMM d")}`
                : daysDiff === 0
                ? "Due today"
                : daysDiff === 1
                ? "Due tomorrow"
                : `Due in ${daysDiff} days · ${format(dueDate, "MMM d")}`}
            </span>
            {task.estimatedCost && (
              <span className="text-muted-foreground font-normal ml-1">· est. ${Number(task.estimatedCost).toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* Mark done trigger */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
            expanded
              ? "bg-muted text-muted-foreground"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          {expanded ? <X className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {expanded ? "Cancel" : "Done"}
        </button>
      </div>

      {/* Inline Mark Done panel */}
      {expanded && (
        <div className="border-t bg-muted/30 px-4 py-3 space-y-3 rounded-b-xl">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional: add a note (what you did, cost, who did it…)"
            className="text-sm resize-none h-16 bg-background"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-3">
              <button
                onClick={() => setDiyChecked(true)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                  diyChecked ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                <Hammer className="h-3 w-3" />
                I did it myself
              </button>
              <button
                onClick={() => setDiyChecked(false)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                  !diyChecked ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                <UserCheck className="h-3 w-3" />
                Hired a pro
              </button>
            </div>
            <Button size="sm" onClick={handleConfirm} disabled={busy} className="gap-1.5 h-8 text-xs">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {busy ? "Saving…" : "Mark Complete"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MaintenanceInbox({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<InboxData>({
    queryKey: ["maintenance-inbox", propertyId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/properties/${propertyId}/inbox`);
      if (!res.ok) throw new Error("Failed to load inbox");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  async function markDone(taskId: string, notes: string, isDiy: boolean) {
    const res = await fetch(`${BASE}/api/maintenance/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes || undefined, isDiy }),
    });

    if (!res.ok) {
      toast({ title: "Could not mark task complete", variant: "destructive" });
      throw new Error("Failed");
    }

    toast({ title: "Task marked complete", description: "Next recurrence has been scheduled." });

    // Refresh inbox + health score
    queryClient.invalidateQueries({ queryKey: ["maintenance-inbox", propertyId] });
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => typeof k === "string" && (k.includes("summary") || k.includes("properties"))) });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56 mt-1" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </CardContent>
      </Card>
    );
  }

  const overdue = data?.overdue ?? [];
  const upcoming = data?.upcoming ?? [];
  const total = overdue.length + upcoming.length;

  return (
    <Card className={overdue.length > 0 ? "border-destructive/25" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Maintenance Inbox</CardTitle>
              {total > 0 && (
                <Badge
                  className={`text-[10px] font-bold px-1.5 py-0.5 h-auto ${
                    overdue.length > 0
                      ? "bg-destructive/15 text-destructive border-destructive/25"
                      : "bg-amber-100 text-amber-700 border-amber-200"
                  }`}
                >
                  {total}
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0.5">
              {overdue.length > 0
                ? `${overdue.length} overdue · ${upcoming.length} due in the next 30 days`
                : upcoming.length > 0
                ? `${upcoming.length} task${upcoming.length !== 1 ? "s" : ""} due in the next 30 days`
                : "All clear for the next 30 days"}
            </CardDescription>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Wrench className="h-3.5 w-3.5" />
              Tap Done to complete
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <div className="bg-emerald-100 p-3 rounded-full">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-0.5">No tasks due in the next 30 days.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Overdue section */}
            {overdue.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-destructive uppercase tracking-wide">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Overdue ({overdue.length})
                </div>
                {overdue.map((task) => (
                  <TaskRow key={task.id} task={task} isOverdue={true} onDone={markDone} />
                ))}
              </div>
            )}

            {/* Upcoming section */}
            {upcoming.length > 0 && (
              <div className="space-y-2">
                {overdue.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wide pt-1">
                    <Clock className="h-3.5 w-3.5" />
                    Due This Month ({upcoming.length})
                  </div>
                )}
                {upcoming.map((task) => (
                  <TaskRow key={task.id} task={task} isOverdue={false} onDone={markDone} />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
