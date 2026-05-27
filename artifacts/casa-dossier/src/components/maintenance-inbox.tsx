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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Hammer,
  Calendar,
  X,
  Loader2,
  Wrench,
  DollarSign,
  Receipt,
  Upload,
  UserRound,
  UserCheck,
  Plus,
  Pencil,
  Trash2,
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

type AssetOption = {
  id: string;
  name: string;
  category: string;
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

const INTERVAL_OPTIONS = [
  { value: "30", label: "Monthly (30 days)" },
  { value: "60", label: "Every 2 months" },
  { value: "90", label: "Quarterly (90 days)" },
  { value: "180", label: "Every 6 months" },
  { value: "365", label: "Annually (365 days)" },
];

type CompletePayload = {
  notes?: string;
  isDiy: boolean;
  cost?: number;
  technicianName?: string;
  companyName?: string;
  receiptUrl?: string;
};

type EditPayload = {
  title: string;
  description?: string;
  intervalDays: number;
  nextDueDate: string;
  estimatedCost?: number;
  isDiy: boolean;
};

type TaskRowProps = {
  task: InboxTask;
  isOverdue: boolean;
  onDone: (taskId: string, payload: CompletePayload) => Promise<void>;
  onEdit: (taskId: string, updates: EditPayload) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
};

function TaskRow({ task, isOverdue, onDone, onEdit, onDelete }: TaskRowProps) {
  const [mode, setMode] = useState<"idle" | "complete" | "edit" | "delete">("idle");
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState(task.estimatedCost ? String(Number(task.estimatedCost)) : "");
  const [isDiy, setIsDiy] = useState<boolean>(task.isDiy ?? true);
  const [technicianName, setTechnicianName] = useState(task.isDiy !== false ? "Homeowner (DIY)" : "");
  const [companyName, setCompanyName] = useState("");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();

  // Edit state
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description ?? "");
  const [editIntervalDays, setEditIntervalDays] = useState(String(task.intervalDays));
  const [editNextDueDate, setEditNextDueDate] = useState(task.nextDueDate);
  const [editCost, setEditCost] = useState(task.estimatedCost ? String(Number(task.estimatedCost)) : "");
  const [editIsDiy, setEditIsDiy] = useState(task.isDiy ?? true);

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

  async function handleConfirmComplete() {
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

  async function handleConfirmEdit() {
    if (!editTitle.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await onEdit(task.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        intervalDays: parseInt(editIntervalDays),
        nextDueDate: editNextDueDate,
        estimatedCost: editCost ? parseFloat(editCost) : undefined,
        isDiy: editIsDiy,
      });
      setMode("idle");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete() {
    setBusy(true);
    try {
      await onDelete(task.id);
      setDismissed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`rounded-xl border transition-all ${
        isOverdue ? "border-destructive/25 bg-destructive/3" : "border-border bg-card"
      } ${mode !== "idle" ? "shadow-sm" : ""}`}
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

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {mode === "idle" && (
            <>
              <button
                onClick={() => setMode("edit")}
                className="flex items-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Edit task"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setMode("delete")}
                className="flex items-center p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setMode("complete")}
                className="flex items-center gap-1 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Done</span>
              </button>
            </>
          )}
          {mode !== "idle" && (
            <button
              onClick={() => setMode("idle")}
              className="flex items-center gap-1 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Complete form */}
      {mode === "complete" && (
        <div className="border-t bg-muted/30 px-3 sm:px-4 py-3.5 space-y-3 rounded-b-xl">
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
                    className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() => { setReceiptPreview(null); setReceiptData(null); if (fileRef.current) fileRef.current.value = ""; }}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="h-8 w-full rounded-md border border-dashed hover:bg-muted flex items-center justify-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Upload className="h-3 w-3" />Upload
                </button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Who did the work?</Label>
            <div className="flex gap-2">
              <button
                onClick={() => toggleDiy(true)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium flex-1 justify-center ${isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                <Hammer className="h-3.5 w-3.5" />I did it myself
              </button>
              <button
                onClick={() => toggleDiy(false)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium flex-1 justify-center ${!isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                <UserCheck className="h-3.5 w-3.5" />Hired a pro
              </button>
            </div>
          </div>
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
          <div className="flex justify-end pt-0.5">
            <Button size="sm" onClick={handleConfirmComplete} disabled={busy} className="gap-1.5 h-8 text-xs">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {busy ? "Saving…" : "Mark Complete"}
            </Button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {mode === "edit" && (
        <div className="border-t bg-muted/30 px-3 sm:px-4 py-3.5 space-y-3 rounded-b-xl">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Task Title</Label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-sm h-8 bg-background"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Description (optional)</Label>
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="text-sm resize-none h-14 bg-background"
              placeholder="Instructions or notes…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Recurrence</Label>
              <Select value={editIntervalDays} onValueChange={setEditIntervalDays}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Next Due Date</Label>
              <Input
                type="date"
                value={editNextDueDate}
                onChange={(e) => setEditNextDueDate(e.target.value)}
                className="text-sm h-8 bg-background"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Est. Cost
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={editCost}
                onChange={(e) => setEditCost(e.target.value)}
                className="text-sm h-8 bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Type</Label>
              <div className="flex gap-1.5 h-8">
                <button
                  onClick={() => setEditIsDiy(true)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border font-medium flex-1 justify-center ${editIsDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                >
                  <Hammer className="h-3 w-3" />DIY
                </button>
                <button
                  onClick={() => setEditIsDiy(false)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border font-medium flex-1 justify-center ${!editIsDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                >
                  <UserCheck className="h-3 w-3" />Pro
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-0.5">
            <Button size="sm" onClick={handleConfirmEdit} disabled={busy} className="gap-1.5 h-8 text-xs">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
              {busy ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {mode === "delete" && (
        <div className="border-t bg-destructive/5 px-3 sm:px-4 py-3 rounded-b-xl flex items-center justify-between gap-3">
          <p className="text-xs text-destructive font-medium">Delete this task? This can't be undone.</p>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleConfirmDelete}
            disabled={busy}
            className="h-7 text-xs gap-1.5 shrink-0"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── New Task Form ─────────────────────────────────────────────────────────────

type NewTaskFormProps = {
  propertyId: string;
  assets: AssetOption[];
  onSave: (assetId: string, data: {
    title: string;
    description?: string;
    intervalDays: number;
    nextDueDate: string;
    estimatedCost?: number;
    isDiy: boolean;
  }) => Promise<void>;
  onCancel: () => void;
};

function NewTaskForm({ assets, onSave, onCancel }: NewTaskFormProps) {
  const today = new Date().toLocaleDateString("en-CA");
  const [title, setTitle] = useState("");
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [intervalDays, setIntervalDays] = useState("90");
  const [nextDueDate, setNextDueDate] = useState(today);
  const [estimatedCost, setEstimatedCost] = useState("");
  const [isDiy, setIsDiy] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function handleSubmit() {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!assetId) {
      toast({ title: "Please select an asset", variant: "destructive" });
      return;
    }
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
      <p className="text-xs font-bold text-foreground uppercase tracking-wide">New Manual Task</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Task Title *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Clean gutters"
            className="text-sm h-8 bg-background"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Asset *</Label>
          <Select value={assetId} onValueChange={setAssetId}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="Select asset…" />
            </SelectTrigger>
            <SelectContent>
              {assets.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Description (optional)</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What needs to be done and why…"
          className="text-sm resize-none h-14 bg-background"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Recurrence</Label>
          <Select value={intervalDays} onValueChange={setIntervalDays}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Due Date</Label>
          <Input
            type="date"
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            className="text-sm h-8 bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Est. Cost
          </Label>
          <Input
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
        <Label className="text-xs font-semibold">Type</Label>
        <div className="flex gap-2">
          <button
            onClick={() => setIsDiy(true)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium flex-1 justify-center ${isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            <Hammer className="h-3.5 w-3.5" />DIY
          </button>
          <button
            onClick={() => setIsDiy(false)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium flex-1 justify-center ${!isDiy ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            <UserCheck className="h-3.5 w-3.5" />Hire a Pro
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-0.5">
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 text-xs">
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={busy} className="gap-1.5 h-8 text-xs">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {busy ? "Saving…" : "Add Task"}
        </Button>
      </div>
    </div>
  );
}

// ── Main Inbox ────────────────────────────────────────────────────────────────

export function MaintenanceInbox({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery<InboxData>({
    queryKey: ["maintenance-inbox", propertyId],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/properties/${propertyId}/inbox`);
      if (!res.ok) throw new Error("Failed to load inbox");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: assets = [] } = useQuery<AssetOption[]>({
    queryKey: ["assets", propertyId],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/properties/${propertyId}/assets`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
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

  async function editTask(taskId: string, updates: EditPayload) {
    const res = await authFetch(`${BASE}/api/maintenance/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...updates,
        estimatedCost: updates.estimatedCost,
      }),
    });
    if (!res.ok) {
      toast({ title: "Could not update task", variant: "destructive" });
      throw new Error("Failed");
    }
    toast({ title: "Task updated" });
    queryClient.invalidateQueries({ queryKey: ["maintenance-inbox", propertyId] });
  }

  async function deleteTask(taskId: string) {
    const res = await authFetch(`${BASE}/api/maintenance/${taskId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast({ title: "Could not delete task", variant: "destructive" });
      throw new Error("Failed");
    }
    toast({ title: "Task deleted" });
    queryClient.invalidateQueries({ queryKey: ["maintenance-inbox", propertyId] });
  }

  async function createTask(assetId: string, data: {
    title: string;
    description?: string;
    intervalDays: number;
    nextDueDate: string;
    estimatedCost?: number;
    isDiy: boolean;
  }) {
    const res = await authFetch(`${BASE}/api/assets/${assetId}/maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      toast({ title: "Could not create task", variant: "destructive" });
      throw new Error("Failed");
    }
    toast({ title: "Task added", description: "It will appear when it's due within 30 days." });
    setAddOpen(false);
    queryClient.invalidateQueries({ queryKey: ["maintenance-inbox", propertyId] });
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
          <div className="flex items-center gap-2 shrink-0">
            {total > 0 && (
              <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                <Wrench className="h-3.5 w-3.5" />
                Tap Done to complete
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => setAddOpen((v) => !v)}
            >
              {addOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {addOpen ? "Cancel" : "New Task"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 sm:px-6 space-y-3 pt-0">
        {total === 0 && !addOpen ? (
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
                  <TaskRow
                    key={task.id}
                    task={task}
                    isOverdue={true}
                    onDone={markDone}
                    onEdit={editTask}
                    onDelete={deleteTask}
                  />
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
                  <TaskRow
                    key={task.id}
                    task={task}
                    isOverdue={false}
                    onDone={markDone}
                    onEdit={editTask}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {addOpen && (
          <div className="border rounded-xl overflow-hidden">
            <NewTaskForm
              propertyId={propertyId}
              assets={assets}
              onSave={createTask}
              onCancel={() => setAddOpen(false)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
