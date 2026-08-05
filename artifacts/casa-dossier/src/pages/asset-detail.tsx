import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  useGetAsset,
  getGetAssetQueryKey,
  useListServiceRecords,
  useListMaintenanceTasks,
  useCreateServiceRecord,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, ShieldCheck, AlertTriangle, ShieldAlert,
  Calendar, Wrench, CheckCircle2, Clock, Hammer,
  AlertCircle, FileText, DollarSign, Plus, X,
  Loader2, UserCheck, UserRound, ImagePlus, Receipt,
  CheckCheck, Upload, Pencil, Archive, RefreshCw, Trash2,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { EditAssetSheet } from "@/components/edit-asset-sheet";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Category & scoring config ──────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; bg: string; lifespan: number }> = {
  HVAC:       { emoji: "❄️",  color: "#3b82f6", bg: "#3b82f615", lifespan: 15 },
  Plumbing:   { emoji: "🔧",  color: "#06b6d4", bg: "#06b6d415", lifespan: 12 },
  Electrical: { emoji: "⚡",  color: "#eab308", bg: "#eab30815", lifespan: 40 },
  Roof:       { emoji: "🏠",  color: "#78716c", bg: "#78716c15", lifespan: 25 },
  Appliance:  { emoji: "🫙",  color: "#8b5cf6", bg: "#8b5cf615", lifespan: 12 },
  Structural: { emoji: "🏗️", color: "#22c55e", bg: "#22c55e15", lifespan: 50 },
  Other:      { emoji: "📦",  color: "#94a3b8", bg: "#94a3b815", lifespan: 20 },
};

function calcScore(asset: any): number {
  let score = 100;
  const cfg = CATEGORY_CONFIG[asset.category] ?? CATEGORY_CONFIG.Other!;
  if (asset.installDate) {
    const ageYears = (Date.now() - new Date(asset.installDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    score -= Math.round(Math.min(ageYears / cfg.lifespan, 1) * 40);
  }
  if (asset.status === "needs_attention") score -= 25;
  else if (asset.status === "unverified") score -= 5;
  if (asset.status === "verified") score = Math.min(score + 5, 100);
  if (asset.warrantyExpiry && new Date(asset.warrantyExpiry) > new Date()) score = Math.min(score + 5, 100);
  return Math.max(0, Math.round(score));
}

function gradeFromScore(score: number) {
  if (score >= 90) return { grade: "A", color: "#3d7a5f", label: "Excellent" };
  if (score >= 75) return { grade: "B", color: "#4b7fb5", label: "Good" };
  if (score >= 55) return { grade: "C", color: "#c8853a", label: "Fair" };
  if (score >= 35) return { grade: "D", color: "#b85a2a", label: "Poor" };
  return { grade: "F", color: "#c0392b", label: "Critical" };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Large Radial Gauge ─────────────────────────────────────────────────────────
function LargeRadialGauge({ score }: { score: number }) {
  const { grade, color, label } = gradeFromScore(score);
  const radius = 44, stroke = 7;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;
  return (
    <div className="relative shrink-0">
      <svg width={104} height={104} className="-rotate-90">
        <circle cx={52} cy={52} r={radius} fill="none" stroke={color + "20"} strokeWidth={stroke} />
        <circle cx={52} cy={52} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none gap-0.5">
        <span className="text-2xl font-black" style={{ color }}>{grade}</span>
        <span className="text-xs font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

// ── Life-used bar ──────────────────────────────────────────────────────────────
function LifeBar({ installDate, category }: { installDate: string | null; category: string }) {
  if (!installDate) return null;
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.Other!;
  const ageYears = (Date.now() - new Date(installDate).getTime()) / (365.25 * 24 * 3600 * 1000);
  const pct = Math.min(Math.round((ageYears / cfg.lifespan) * 100), 100);
  const barColor = pct >= 80 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#22c55e";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Life used</span>
        <span className="font-semibold" style={{ color: barColor }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <p className="text-[10px] text-muted-foreground">
        ~{Math.round(ageYears)} yr old · {cfg.lifespan} yr expected lifespan
      </p>
    </div>
  );
}

// ── Step formatter ────────────────────────────────────────────────────────────
function StepList({ description }: { description: string }) {
  const lines = description.split("\n").map((l) => l.trim()).filter(Boolean);
  const isNumbered = lines.length > 1 && lines.every((l) => /^\d+[.)]\s/.test(l));
  const isBullet = lines.length > 1 && lines.every((l) => /^[-•*]\s/.test(l));

  if (isNumbered) {
    return (
      <ol className="space-y-3">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span>{line.replace(/^\d+[.)]\s*/, "")}</span>
          </li>
        ))}
      </ol>
    );
  }
  if (isBullet) {
    return (
      <ul className="space-y-2.5">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
            <span className="shrink-0 mt-2 h-1.5 w-1.5 rounded-full bg-primary/50" />
            <span>{line.replace(/^[-•*]\s*/, "")}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{description}</p>
  );
}

// ── Shared task interval options ──────────────────────────────────────────────
const INTERVAL_OPTIONS = [
  { value: "30", label: "Monthly (30 days)" },
  { value: "60", label: "Every 2 months" },
  { value: "90", label: "Quarterly (90 days)" },
  { value: "180", label: "Every 6 months" },
  { value: "365", label: "Annually (365 days)" },
];

// ── Edit Task Modal ───────────────────────────────────────────────────────────
function EditTaskModal({
  task,
  assetId,
  open,
  onClose,
}: {
  task: any;
  assetId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState<string>(task.title ?? "");
  const [description, setDescription] = useState<string>(task.description ?? "");
  const [intervalDays, setIntervalDays] = useState<string>(String(task.intervalDays ?? 90));
  const [nextDueDate, setNextDueDate] = useState<string>(task.nextDueDate ?? "");
  const [estimatedCost, setEstimatedCost] = useState<string>(task.estimatedCost ? String(Number(task.estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState<boolean>(task.isDiy ?? true);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();

  async function handleSave() {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(`${BASE}/api/maintenance/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          intervalDays: parseInt(intervalDays),
          nextDueDate,
          estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
          isDiy,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Task updated" });
      queryClient.invalidateQueries({ queryKey: ["tasks", assetId] });
      onClose();
    } catch {
      toast({ title: "Could not update task", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogTitle className="sr-only">Edit Task</DialogTitle>
        <DialogDescription className="sr-only">Edit maintenance task details</DialogDescription>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b shrink-0">
          <p className="text-base font-bold flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            Edit Task
          </p>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Task Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm h-8" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none h-16 text-sm" placeholder="How-to notes…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Recurrence</Label>
              <Select value={intervalDays} onValueChange={setIntervalDays}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Next Due Date</Label>
              <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="text-sm h-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1"><DollarSign className="h-3 w-3" />Est. Cost (optional)</Label>
            <Input type="number" min={0} step="0.01" placeholder="0.00" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} className="text-sm h-8" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Type</Label>
            <div className="flex gap-2">
              <button onClick={() => setIsDiy(true)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                <Hammer className="h-3.5 w-3.5" />DIY
              </button>
              <button onClick={() => setIsDiy(false)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${!isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                <UserCheck className="h-3.5 w-3.5" />Hire a Pro
              </button>
            </div>
          </div>
        </div>
        <div className="border-t px-5 py-3.5 flex gap-2 shrink-0 bg-background">
          <Button variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" className="flex-1 h-9 text-sm gap-1.5" onClick={handleSave} disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><CheckCircle2 className="h-4 w-4" />Save Changes</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Completed Task Row (with edit/delete) ─────────────────────────────────────
function CompletedTaskRow({ task, assetId }: { task: any; assetId: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      const res = await authFetch(`${BASE}/api/maintenance/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Task deleted" });
      queryClient.invalidateQueries({ queryKey: ["tasks", assetId] });
      setHidden(true);
    } catch {
      toast({ title: "Could not delete task", variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  }

  if (hidden) return null;

  return (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground group">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <span className="flex-1 line-clamp-1">{task.title}</span>
        {task.completedAt && (
          <span className="shrink-0 text-[10px]">{format(new Date(task.completedAt), "MMM d")}</span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditOpen(true)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={() => setDeleteConfirm(true)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {deleteConfirm && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1.5">
          <p className="text-[11px] text-destructive font-medium">Delete "{task.title}"?</p>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setDeleteConfirm(false)} disabled={deleteBusy}>Cancel</Button>
            <Button variant="destructive" size="sm" className="h-6 text-[11px] px-2 gap-1" onClick={handleDelete} disabled={deleteBusy}>
              {deleteBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}Delete
            </Button>
          </div>
        </div>
      )}
      <EditTaskModal open={editOpen} onClose={() => setEditOpen(false)} task={task} assetId={assetId} />
    </>
  );
}

// ── Add Task Inline Form ───────────────────────────────────────────────────────
function AddTaskInlineForm({ assetId, onSuccess }: { assetId: string; onSuccess: () => void }) {
  const today = new Date().toLocaleDateString("en-CA");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [intervalDays, setIntervalDays] = useState("90");
  const [nextDueDate, setNextDueDate] = useState(today);
  const [estimatedCost, setEstimatedCost] = useState("");
  const [isDiy, setIsDiy] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();

  function reset() {
    setTitle(""); setDescription(""); setIntervalDays("90");
    setNextDueDate(today); setEstimatedCost(""); setIsDiy(true);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(`${BASE}/api/assets/${assetId}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          intervalDays: parseInt(intervalDays),
          nextDueDate,
          estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
          isDiy,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Task added" });
      queryClient.invalidateQueries({ queryKey: ["tasks", assetId] });
      reset();
      setOpen(false);
      onSuccess();
    } catch {
      toast({ title: "Could not create task", variant: "destructive" });
    } finally {
      setBusy(false);
    }
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
          Add Maintenance Task
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border-2 border-primary/20 bg-primary/3 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 bg-primary/5">
        <p className="text-sm font-bold flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-primary" />
          New Maintenance Task
        </p>
        <button onClick={() => { setOpen(false); reset(); }} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Task Title <span className="text-destructive">*</span></Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Clean condenser coils" className="text-sm h-8 bg-background" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Description (optional)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Step-by-step instructions…" className="resize-none h-14 text-sm bg-background" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Recurrence</Label>
            <Select value={intervalDays} onValueChange={setIntervalDays}>
              <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1"><Calendar className="h-3 w-3" />Due Date</Label>
            <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="text-sm h-8 bg-background" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1"><DollarSign className="h-3 w-3" />Est. Cost</Label>
            <Input type="number" min={0} step="0.01" placeholder="0.00" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} className="text-sm h-8 bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Type</Label>
            <div className="flex gap-1.5 h-8">
              <button onClick={() => setIsDiy(true)} className={`flex items-center gap-1 text-xs px-2 rounded-md border font-medium flex-1 justify-center transition-colors ${isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                <Hammer className="h-3 w-3" />DIY
              </button>
              <button onClick={() => setIsDiy(false)} className={`flex items-center gap-1 text-xs px-2 rounded-md border font-medium flex-1 justify-center transition-colors ${!isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                <UserCheck className="h-3 w-3" />Pro
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-0.5">
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setOpen(false); reset(); }} disabled={busy}>Cancel</Button>
          <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={handleSubmit} disabled={busy}>
            {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : <><Plus className="h-3.5 w-3.5" />Add Task</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Maintenance Task Detail + Completion Modal ────────────────────────────────
function MaintenanceTaskModal({
  task,
  assetId,
  open,
  onClose,
  onComplete,
}: {
  task: any;
  assetId: string;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const today = new Date();
  const diff = differenceInCalendarDays(new Date(task.nextDueDate), today);
  const isOverdue = diff < 0;
  const isSoon = diff >= 0 && diff <= 14;

  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(task.estimatedCost ? String(Number(task.estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState<boolean>(task.isDiy ?? true);
  const [technicianName, setTechnicianName] = useState(task.isDiy !== false ? "Homeowner (DIY)" : "");
  const [companyName, setCompanyName] = useState("");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();

  function resetForm() {
    setNotes(""); setCost(task.estimatedCost ? String(Number(task.estimatedCost)) : "");
    setIsDiy(task.isDiy ?? true); setTechnicianName(task.isDiy !== false ? "Homeowner (DIY)" : "");
    setCompanyName(""); setReceiptPreview(null); setReceiptData(null);
  }

  function handleClose() { resetForm(); onClose(); }

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

  async function handleSubmit() {
    setBusy(true);
    try {
      const res = await authFetch(`${BASE}/api/maintenance/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.trim() || undefined,
          isDiy,
          cost: cost ? parseFloat(cost) : undefined,
          technicianName: technicianName.trim() || undefined,
          companyName: companyName.trim() || undefined,
          receiptUrl: receiptData || undefined,
          completedDate: new Date().toLocaleDateString("en-CA"),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Task marked complete", description: "A new service record was saved." });
      queryClient.invalidateQueries({ queryKey: ["tasks", assetId] });
      queryClient.invalidateQueries({ queryKey: ["service-records", assetId] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => typeof k === "string" && k.includes("inbox")) });
      resetForm();
      onComplete();
    } catch {
      toast({ title: "Could not complete task", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent hideCloseButton className="max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogTitle className="sr-only">{task.title}</DialogTitle>
        <DialogDescription className="sr-only">Maintenance task details and completion form</DialogDescription>

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
                {isOverdue
                  ? `${Math.abs(diff)}d overdue`
                  : diff === 0 ? "Due today"
                  : diff === 1 ? "Due tomorrow"
                  : `Due ${format(new Date(task.nextDueDate), "MMM d, yyyy")}`}
              </span>
              {task.isDiy && (
                <Badge variant="secondary" className="text-[10px] gap-0.5 h-5">
                  <Hammer className="h-2.5 w-2.5" /> DIY
                </Badge>
              )}
              {task.estimatedCost && Number(task.estimatedCost) > 0 && (
                <Badge variant="outline" className="text-[10px] gap-0.5 h-5">
                  <DollarSign className="h-2.5 w-2.5" /> Est. ${Number(task.estimatedCost).toLocaleString()}
                </Badge>
              )}
              {task.intervalDays && (
                <Badge variant="outline" className="text-[10px] gap-0.5 h-5">
                  <RefreshCw className="h-2.5 w-2.5" /> Every {task.intervalDays}d
                </Badge>
              )}
            </div>
            <h2 className="text-base font-bold leading-snug">{task.title}</h2>
          </div>
          <button
            onClick={handleClose}
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
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">How to do it</p>
              <StepList description={task.description} />
            </div>
          )}

          {/* Divider */}
          <div className="border-t" />

          {/* Completion form */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Mark as Complete
            </p>
            <div className="space-y-3.5">

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={`e.g. Completed ${task.title.toLowerCase()}. Everything looks good.`}
                  className="resize-none h-16 text-sm"
                />
              </div>

              {/* Cost + Receipt */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Actual Cost
                  </Label>
                  <Input type="number" min={0} step="0.01" placeholder="0.00" value={cost}
                    onChange={(e) => setCost(e.target.value)} className="text-sm h-8" />
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
                        className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => { setReceiptPreview(null); setReceiptData(null); if (fileRef.current) fileRef.current.value = ""; }}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()}
                      className="h-8 w-full rounded-md border border-dashed hover:bg-muted flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Upload className="h-3 w-3" /> Upload
                    </button>
                  )}
                </div>
              </div>

              {/* DIY / Pro toggle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Who did the work?</Label>
                <div className="flex gap-2">
                  <button onClick={() => toggleDiy(true)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                    <Hammer className="h-3.5 w-3.5" /> I did it myself
                  </button>
                  <button onClick={() => toggleDiy(false)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${!isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                    <UserCheck className="h-3.5 w-3.5" /> Hired a pro
                  </button>
                </div>
              </div>

              {/* Pro fields */}
              {!isDiy && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1"><UserRound className="h-3 w-3" /> Technician</Label>
                    <Input placeholder="Name" value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} className="text-sm h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Company</Label>
                    <Input placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="text-sm h-8" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sticky footer ── */}
        <div className="border-t px-5 py-3.5 flex gap-2 shrink-0 bg-background">
          <Button variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1 h-9 text-sm gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            onClick={handleSubmit} disabled={busy}>
            {busy
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              : <><CheckCheck className="h-4 w-4" /> Mark Complete</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Mark Complete Form (row + modal trigger) ──────────────────────────────────
function MarkCompleteForm({
  task,
  assetId,
  onDismiss,
}: {
  task: any;
  assetId: string;
  onDismiss: () => void;
}) {
  const today = new Date();
  const diff = differenceInCalendarDays(new Date(task.nextDueDate), today);
  const isOverdue = diff < 0;
  const isSoon = diff >= 0 && diff <= 14;

  const [modalOpen, setModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      const res = await authFetch(`${BASE}/api/maintenance/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Task deleted" });
      queryClient.invalidateQueries({ queryKey: ["tasks", assetId] });
      onDismiss();
    } catch {
      toast({ title: "Could not delete task", variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 flex items-center gap-2.5 animate-in fade-in">
        <CheckCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        <p className="text-sm font-semibold text-emerald-700">Done! Service record saved.</p>
      </div>
    );
  }

  return (
    <>
      <div className={`rounded-xl border overflow-hidden ${isOverdue ? "border-destructive/25 bg-destructive/3" : "border-border"}`}>
        {/* Main row */}
        <div className="flex items-start gap-2 px-3.5 py-3">
          {/* Clickable left area */}
          <button
            onClick={() => setModalOpen(true)}
            className="flex-1 text-left min-w-0 space-y-1.5 hover:opacity-80 transition-opacity"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-semibold text-sm leading-tight">{task.title}</p>
              {task.isDiy && (
                <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5 h-4">
                  <Hammer className="h-2.5 w-2.5" />DIY
                </Badge>
              )}
              {task.estimatedCost && Number(task.estimatedCost) > 0 && (
                <Badge variant="outline" className="text-[9px] px-1.5 h-4 gap-0.5">
                  <DollarSign className="h-2.5 w-2.5" />{Number(task.estimatedCost).toLocaleString()}
                </Badge>
              )}
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{task.description}</p>
            )}
            <div className={`flex items-center gap-1.5 text-xs font-medium ${isOverdue ? "text-destructive" : isSoon ? "text-amber-600" : "text-muted-foreground"}`}>
              {isOverdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {isOverdue
                ? `${Math.abs(diff)}d overdue · was due ${format(new Date(task.nextDueDate), "MMM d, yyyy")}`
                : diff === 0 ? "Due today"
                : diff === 1 ? "Due tomorrow"
                : `Due ${format(new Date(task.nextDueDate), "MMM d, yyyy")}`}
              {task.intervalDays && <span className="text-muted-foreground font-normal">· every {task.intervalDays}d</span>}
            </div>
          </button>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditOpen(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit task"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete task"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2 h-6 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3" />
              Mark Done
            </button>
          </div>
        </div>

        {/* Delete confirm bar */}
        {deleteConfirm && (
          <div className="border-t bg-destructive/5 px-3.5 py-2.5 flex items-center justify-between gap-3">
            <p className="text-xs text-destructive font-medium">Delete this task? This can't be undone.</p>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDeleteConfirm(false)} disabled={deleteBusy}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" className="h-7 text-xs gap-1.5" onClick={handleDelete} disabled={deleteBusy}>
                {deleteBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      <MaintenanceTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        task={task}
        assetId={assetId}
        onComplete={() => {
          setDone(true);
          setModalOpen(false);
          setTimeout(onDismiss, 900);
        }}
      />

      <EditTaskModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        task={task}
        assetId={assetId}
      />
    </>
  );
}

// ── Inline Add Service Record Form ────────────────────────────────────────────
const TODAY = new Date().toISOString().split("T")[0]!;

type ServiceFormState = {
  description: string;
  date: string;
  isDiy: boolean;
  technicianName: string;
  companyName: string;
  cost: string;
};

const BLANK: ServiceFormState = { description: "", date: TODAY, isDiy: true, technicianName: "Homeowner (DIY)", companyName: "", cost: "" };

function AddServiceRecordForm({ assetId, gradeColor, onSuccess }: {
  assetId: string;
  gradeColor: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ServiceFormState>(BLANK);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useCreateServiceRecord({
    mutation: {
      onSuccess: () => {
        toast({ title: "Service record saved", description: "It now appears in the timeline." });
        queryClient.invalidateQueries({ queryKey: ["service-records", assetId] });
        queryClient.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => typeof k === "string" && k.includes("summary")) });
        setForm(BLANK);
        setOpen(false);
        onSuccess();
      },
      onError: () => {
        toast({ title: "Could not save record", variant: "destructive" });
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
      technicianName: diy ? "Homeowner (DIY)" : "",
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
          Log Service Record
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border-2 border-primary/20 bg-primary/3 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 bg-primary/5">
        <p className="text-sm font-bold flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" />
          New Service Record
        </p>
        <button onClick={() => { setOpen(false); setForm(BLANK); }} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-3.5">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">What was done? <span className="text-destructive">*</span></Label>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="e.g. Annual HVAC tune-up. Cleaned coils, replaced filter."
            className="resize-none h-16 text-sm bg-background"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Date
            </Label>
            <Input
              type="date"
              value={form.date}
              max={TODAY}
              onChange={(e) => set("date", e.target.value)}
              className="text-sm h-8 bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Cost (optional)
            </Label>
            <Input
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
          <Label className="text-xs font-semibold">Who did the work?</Label>
          <div className="flex gap-2">
            <button
              onClick={() => toggleDiy(true)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${
                form.isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
              }`}
            >
              <Hammer className="h-3.5 w-3.5" />
              I did it myself
            </button>
            <button
              onClick={() => toggleDiy(false)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-1 justify-center ${
                !form.isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Hired a pro
            </button>
          </div>
        </div>
        {!form.isDiy && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <UserRound className="h-3 w-3" /> Technician
              </Label>
              <Input
                placeholder="Name"
                value={form.technicianName}
                onChange={(e) => set("technicianName", e.target.value)}
                className="text-sm h-8 bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Company</Label>
              <Input
                placeholder="Company name"
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
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5"
            onClick={handleSubmit}
            disabled={!form.description.trim() || mutation.isPending}
          >
            {mutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
            ) : (
              <><CheckCircle2 className="h-3.5 w-3.5" /> Save Record</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AssetDetail() {
  const { propertyId, assetId } = useParams<{ propertyId: string; assetId: string }>();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const [editOpen, setEditOpen] = useState(false);

  const { data: asset, isLoading: assetLoading } = useGetAsset(assetId!, {
    query: { enabled: !!assetId, queryKey: getGetAssetQueryKey(assetId!) },
  });

  const { data: records = [], isLoading: recordsLoading } = useListServiceRecords(assetId!, {
    query: { enabled: !!assetId, queryKey: ["service-records", assetId!] },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useListMaintenanceTasks(assetId!, {
    query: { enabled: !!assetId, queryKey: ["tasks", assetId!] },
  });

  const dismissTask = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  }, []);

  if (assetLoading || recordsLoading || tasksLoading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-5 w-24" />
        <div className="flex gap-6">
          <Skeleton className="h-[120px] w-[360px] rounded-xl" />
          <Skeleton className="h-[120px] flex-1 rounded-xl" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[340px] rounded-xl" />
          <Skeleton className="h-[340px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!asset) return <div className="p-6 text-center text-muted-foreground">Asset not found.</div>;

  const score = calcScore(asset);
  const { color: gradeColor } = gradeFromScore(score);
  const cfg = CATEGORY_CONFIG[asset.category] ?? CATEGORY_CONFIG.Other!;
  const underWarranty = asset.warrantyExpiry && new Date(asset.warrantyExpiry) > new Date();

  const pendingTasks = (tasks as any[]).filter((t) => !t.completedAt && !dismissed.has(t.id));
  const completedTasks = (tasks as any[]).filter((t) => t.completedAt);
  const sortedRecords = [...(records as any[])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">

      {/* Back link + Request Service */}
      <div className="flex items-center justify-between">
        <Link href="/assets" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          My Assets
        </Link>
        <Link href={`/marketplace?propertyId=${asset.propertyId}&assetId=${asset.id}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Request Service for This Asset</span>
            <span className="sm:hidden">Request Service</span>
          </Button>
        </Link>
      </div>

      {/* Retired banner */}
      {(asset as any).retiredAt && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Archive className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">This asset has been retired</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Retired {format(new Date((asset as any).retiredAt), "MMMM d, yyyy")} — removed from active inventory. Service history is fully preserved.
            </p>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 border border-amber-300 hover:border-amber-400 rounded-lg px-2.5 py-1 transition-colors"
          >
            Restore
          </button>
        </div>
      )}

      {/* ── Hero card ── */}
      <div className="rounded-2xl border bg-card p-5 flex flex-col sm:flex-row items-start gap-5" style={{ borderColor: cfg.color + "30" }}>
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ background: cfg.bg }}>
            {cfg.emoji}
          </div>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{asset.name}</h1>
              {underWarranty && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 text-xs font-bold">
                  <ShieldCheck className="h-3 w-3" />Under Warranty
                </Badge>
              )}
              {asset.status === "needs_attention" && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3" />Needs Attention
                </Badge>
              )}
              {asset.status === "verified" && (
                <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-xs">
                  <ShieldCheck className="h-3 w-3" />Verified
                </Badge>
              )}
              {asset.status === "unverified" && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <ShieldAlert className="h-3 w-3" />Unverified
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {asset.category}{asset.brand ? ` · ${asset.brand}` : ""}{asset.model ? ` · ${asset.model}` : ""}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              {asset.serialNumber && (
                <div className="text-xs">
                  <span className="text-muted-foreground">S/N </span>
                  <span className="font-mono font-semibold">{asset.serialNumber}</span>
                </div>
              )}
              {asset.installDate && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Installed </span>
                  <span className="font-semibold">{format(new Date(asset.installDate), "MMM yyyy")}</span>
                </div>
              )}
              {asset.warrantyExpiry && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Warranty </span>
                  <span className={`font-semibold ${underWarranty ? "text-emerald-600" : "text-destructive"}`}>
                    {underWarranty ? `until ${format(new Date(asset.warrantyExpiry), "MMM yyyy")}` : "Expired"}
                  </span>
                </div>
              )}
              {asset.replacementCost && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Est. replacement </span>
                  <span className="font-semibold">${Number(asset.replacementCost).toLocaleString()}</span>
                </div>
              )}
            </div>
            <div className="pt-2 max-w-xs">
              <LifeBar installDate={asset.installDate ?? null} category={asset.category} />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 shrink-0">
          <LargeRadialGauge score={score} />
          <p className="text-[10px] text-muted-foreground font-medium">Asset Health</p>
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 rounded-lg px-2.5 py-1 transition-colors bg-background"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        </div>
      </div>

      {/* Asset Photo */}
      {(asset as any).photoUrl && (
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: cfg.color + "30" }}>
          <img
            src={(asset as any).photoUrl}
            alt={asset.name}
            className="w-full max-h-72 object-cover"
          />
        </div>
      )}

      {/* Notes */}
      {asset.notes && (
        <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground mr-1.5">Notes:</span>{asset.notes}
        </div>
      )}

      {/* ── Bottom grid ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Maintenance Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                Maintenance Schedule
              </CardTitle>
              {pendingTasks.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {pendingTasks.length} task{pendingTasks.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {pendingTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <CheckCircle2 className="h-7 w-7 text-emerald-500 opacity-60" />
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs text-center max-w-[180px] text-muted-foreground">No pending tasks for this asset.</p>
              </div>
            ) : (
              pendingTasks.map((task: any) => (
                <MarkCompleteForm
                  key={task.id}
                  task={task}
                  assetId={assetId!}
                  onDismiss={() => dismissTask(task.id)}
                />
              ))
            )}

            {completedTasks.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  {completedTasks.length} Completed
                </p>
                {completedTasks.slice(0, 3).map((t: any) => (
                  <CompletedTaskRow key={t.id} task={t} assetId={assetId!} />
                ))}
              </div>
            )}

            <AddTaskInlineForm
              assetId={assetId!}
              onSuccess={() => {}}
            />
          </CardContent>
        </Card>

        {/* Service History */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Service History
              </CardTitle>
              {sortedRecords.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {sortedRecords.length} record{sortedRecords.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {sortedRecords.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                <FileText className="h-7 w-7 opacity-20" />
                <p className="text-sm font-medium">No service records yet</p>
                <p className="text-xs text-center max-w-[200px]">Log your first service record below.</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-border ml-2 space-y-5 py-1">
                {sortedRecords.map((record: any) => (
                  <div key={record.id} className="relative pl-5">
                    <div
                      className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-background border-2 flex items-center justify-center"
                      style={{ borderColor: gradeColor }}
                    >
                      <div className="h-1.5 w-1.5 rounded-full" style={{ background: gradeColor }} />
                    </div>
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className="font-semibold text-sm leading-tight">{record.description}</p>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                        {format(new Date(record.date), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {(record.companyName || record.technicianName) && (
                        <p className="flex items-center gap-1.5">
                          {record.companyName === "CasaService" && (
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-flex items-center bg-amber-50 border border-amber-200 font-semibold px-1.5 py-0.5 rounded text-[10px] tracking-wide">
                                <span className="casa-shimmer-gold">✦ CasaService</span>
                              </span>
                              {record.technicianName && (
                                <span className="text-[10px]"> — {record.technicianName}</span>
                              )}
                            </span>
                          )}
                          {record.companyName !== "CasaService" && record.companyName && (
                            <span>{record.companyName}</span>
                          )}
                          {record.companyName !== "CasaService" && record.technicianName && (
                            <span className="text-muted-foreground">({record.technicianName})</span>
                          )}
                        </p>
                      )}
                      {record.cost && Number(record.cost) > 0 && (
                        <p className="font-semibold text-foreground">${Number(record.cost).toLocaleString()}</p>
                      )}
                      {record.receiptUrl && (
                        <div className="mt-1.5">
                          <img
                            src={record.receiptUrl}
                            alt="Receipt"
                            className="h-16 rounded-md object-cover border border-border cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(record.receiptUrl, "_blank")}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Inline add form */}
            <AddServiceRecordForm
              assetId={assetId!}
              gradeColor={gradeColor}
              onSuccess={() =>
                queryClient.invalidateQueries({ queryKey: ["service-records", assetId!] })
              }
            />
          </CardContent>
        </Card>
      </div>

      <EditAssetSheet
        asset={asset as any}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => queryClient.invalidateQueries({ queryKey: getGetAssetQueryKey(assetId!) })}
      />
    </div>
  );
}
