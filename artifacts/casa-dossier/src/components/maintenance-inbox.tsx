import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Hammer,
  Calendar,
  X,
  Loader2,
  Inbox,
  UserCheck,
  Wrench,
  DollarSign,
  Receipt,
  Upload,
  UserRound,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

type CompletePayload = {
  notes?: string;
  isDiy: boolean;
  cost?: number;
  technicianName?: string;
  companyName?: string;
  receiptUrl?: string;
};

type TaskRowProps = {
  task: InboxTask;
  isOverdue: boolean;
  onDone: (taskId: string, payload: CompletePayload) => Promise<void>;
};

function TaskRow({ task, isOverdue, onDone }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(
    task.estimatedCost ? String(Number(task.estimatedCost)) : ""
  );
  const [isDiy, setIsDiy] = useState<boolean>(task.isDiy ?? true);
  const [technicianName, setTechnicianName] = useState(
    task.isDiy !== false ? "Homeowner (DIY)" : ""
  );
  const [companyName, setCompanyName] = useState("");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();

  const today = new Date();
  const dueDate = new Date(task.nextDueDate);
  const daysDiff = differenceInCalendarDays(dueDate, today);
  const absdays = Math.abs(daysDiff);

  if (dismissed) return null;

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

  async function handleConfirm() {
    setBusy(true);
    try {
      await onDone(task.id, {
        notes: notes.trim() || undefined,
        isDiy,
        cost: cost ? parseFloat(cost) : undefined,
        technicianName: technicianName.trim() || undefined,
        companyName: companyName.trim() || undefined,
        receiptUrl: receiptData || undefined,
      });
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
      <div className="flex items-start gap-2 sm:gap-3 px-3 sm:px-4 py-3">
        <span className="text-lg shrink-0 mt-0.5 select-none">
          {CATEGORY_ICONS[task.assetCategory] ?? "📦"}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight line-clamp-2">{task.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate leading-snug">{task.assetName}</p>
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

          <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1.5 text-xs font-medium ${isOverdue ? "text-destructive" : daysDiff <= 7 ? "text-amber-600" : "text-muted-foreground"}`}>
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
              <span className="text-muted-foreground font-normal">· est. ${Number(task.estimatedCost).toLocaleString()}</span>
            )}
          </div>
        </div>

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

      {/* Expanded completion form */}
      {expanded && (
        <div className="border-t bg-muted/30 px-3 sm:px-4 py-3.5 space-y-3 rounded-b-xl">

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`e.g. Completed ${task.title.toLowerCase()}. Everything looks good.`}
              className="text-sm resize-none h-16 bg-background"
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
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
              {receiptPreview ? (
                <div className="relative h-8">
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="h-8 w-full object-cover rounded-md border border-border"
                  />
                  <button
                    className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => {
                      setReceiptPreview(null);
                      setReceiptData(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="h-8 w-full rounded-md border border-dashed border-border bg-background hover:bg-muted flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Upload className="h-3 w-3" />
                  Upload image
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
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${
                  isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                <Hammer className="h-3.5 w-3.5" />
                I did it myself
              </button>
              <button
                onClick={() => toggleDiy(false)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${
                  !isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Hired a pro
              </button>
            </div>
          </div>

          {/* Technician + Company (pro only) */}
          {!isDiy && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <UserRound className="h-3 w-3" /> Technician
                </Label>
                <Input
                  placeholder="Name"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className="text-sm h-8 bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Company</Label>
                <Input
                  placeholder="Company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="text-sm h-8 bg-background"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end pt-0.5">
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
  const authFetch = useAuthFetch();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<InboxData>({
    queryKey: ["maintenance-inbox", propertyId],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/properties/${propertyId}/inbox`);
      if (!res.ok) throw new Error("Failed to load inbox");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  async function markDone(taskId: string, payload: CompletePayload) {
    const res = await authFetch(`${BASE}/api/maintenance/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, completedDate: new Date().toLocaleDateString("en-CA") }),
    });

    if (!res.ok) {
      toast({ title: "Could not mark task complete", variant: "destructive" });
      throw new Error("Failed");
    }

    toast({ title: "Task marked complete", description: "Next recurrence has been scheduled." });

    queryClient.invalidateQueries({ queryKey: ["maintenance-inbox", propertyId] });
    queryClient.invalidateQueries({
      predicate: (q) =>
        q.queryKey.some(
          (k) => typeof k === "string" && (k.includes("summary") || k.includes("properties") || k.includes("ledger"))
        ),
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="px-4 sm:px-6 pb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56 mt-1" />
        </CardHeader>
        <CardContent className="px-4 sm:px-6 space-y-2">
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
      <CardHeader className="px-4 sm:px-6 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Maintenance Inbox</CardTitle>
              {total > 0 && (
                <Badge
                  className={`text-[10px] font-bold px-1.5 py-0.5 h-auto shrink-0 ${
                    overdue.length > 0
                      ? "bg-destructive/15 text-destructive border-destructive/25"
                      : "bg-amber-100 text-amber-700 border-amber-200"
                  }`}
                >
                  {total}
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0.5 text-wrap">
              {overdue.length > 0
                ? `${overdue.length} overdue · ${upcoming.length} due in the next 30 days`
                : upcoming.length > 0
                ? `${upcoming.length} task${upcoming.length !== 1 ? "s" : ""} due in the next 30 days`
                : "All clear for the next 30 days"}
            </CardDescription>
          </div>
          {total > 0 && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Wrench className="h-3.5 w-3.5" />
              Tap Done to complete
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 sm:px-6 space-y-3 pt-0">
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
