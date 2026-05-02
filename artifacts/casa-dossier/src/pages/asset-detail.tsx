import { useGetAsset, getGetAssetQueryKey, useListServiceRecords, useListMaintenanceTasks } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ShieldCheck, AlertTriangle, ShieldAlert,
  Calendar, Tag, Wrench, CheckCircle2, Clock, Hammer,
  AlertCircle, FileText, DollarSign,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";

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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AssetDetail() {
  const { propertyId, assetId } = useParams<{ propertyId: string; assetId: string }>();

  const { data: asset, isLoading: assetLoading } = useGetAsset(assetId!, {
    query: { enabled: !!assetId, queryKey: getGetAssetQueryKey(assetId!) },
  });

  const { data: records = [], isLoading: recordsLoading } = useListServiceRecords(assetId!, {
    query: { enabled: !!assetId, queryKey: ["service-records", assetId!] },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useListMaintenanceTasks(assetId!, {
    query: { enabled: !!assetId, queryKey: ["tasks", assetId!] },
  });

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
  const today = new Date();

  const pendingTasks = (tasks as any[]).filter((t) => !t.completedAt);
  const completedTasks = (tasks as any[]).filter((t) => t.completedAt);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">

      {/* Back link */}
      <Link href="/assets" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground gap-1.5">
        <ArrowLeft className="h-4 w-4" />
        My Assets
      </Link>

      {/* ── Hero card ── */}
      <div className="rounded-2xl border bg-card p-5 flex flex-col sm:flex-row items-start gap-5" style={{ borderColor: cfg.color + "30" }}>

        {/* Left: icon + meta */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ background: cfg.bg }}>
            {cfg.emoji}
          </div>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{asset.name}</h1>
              {underWarranty && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 text-xs font-bold">
                  <ShieldCheck className="h-3 w-3" />
                  Under Warranty
                </Badge>
              )}
              {asset.status === "needs_attention" && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  Needs Attention
                </Badge>
              )}
              {asset.status === "verified" && (
                <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-xs">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </Badge>
              )}
              {asset.status === "unverified" && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <ShieldAlert className="h-3 w-3" />
                  Unverified
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {asset.category}{asset.brand ? ` · ${asset.brand}` : ""}{asset.model ? ` · ${asset.model}` : ""}
            </p>

            {/* Key specs inline */}
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

            {/* Life bar */}
            <div className="pt-2 max-w-xs">
              <LifeBar installDate={asset.installDate} category={asset.category} />
            </div>
          </div>
        </div>

        {/* Right: radial gauge */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <LargeRadialGauge score={score} />
          <p className="text-[10px] text-muted-foreground font-medium">Asset Health</p>
        </div>
      </div>

      {/* ── Notes ── */}
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
                <Badge variant="secondary" className="text-[10px]">{pendingTasks.length} task{pendingTasks.length !== 1 ? "s" : ""}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {pendingTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <CheckCircle2 className="h-7 w-7 text-emerald-500 opacity-60" />
                <p className="text-sm font-medium">No tasks scheduled</p>
              </div>
            ) : (
              pendingTasks.map((task: any) => {
                const due = new Date(task.nextDueDate);
                const diff = differenceInCalendarDays(due, today);
                const isOverdue = diff < 0;
                const isSoon = diff >= 0 && diff <= 14;
                return (
                  <div
                    key={task.id}
                    className={`rounded-xl border px-3.5 py-3 space-y-1.5 ${isOverdue ? "border-destructive/25 bg-destructive/3" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm leading-tight">{task.title}</p>
                      <div className="flex gap-1 shrink-0">
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
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{task.description}</p>
                    )}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${isOverdue ? "text-destructive" : isSoon ? "text-amber-600" : "text-muted-foreground"}`}>
                      {isOverdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {isOverdue
                        ? `${Math.abs(diff)}d overdue · was due ${format(due, "MMM d, yyyy")}`
                        : diff === 0 ? "Due today"
                        : diff === 1 ? "Due tomorrow"
                        : `Due ${format(due, "MMM d, yyyy")}`}
                      {task.intervalDays && (
                        <span className="text-muted-foreground font-normal">· every {task.intervalDays}d</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
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
              {(records as any[]).length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{(records as any[]).length} record{(records as any[]).length !== 1 ? "s" : ""}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {(records as any[]).length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <FileText className="h-7 w-7 opacity-20" />
                <p className="text-sm font-medium">No service records yet</p>
                <p className="text-xs text-center max-w-xs">Service history will appear here as you log work done on this asset.</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-border ml-2 space-y-5 py-1">
                {(records as any[]).map((record: any) => (
                  <div key={record.id} className="relative pl-5">
                    {/* Timeline dot */}
                    <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-background border-2 flex items-center justify-center" style={{ borderColor: gradeColor }}>
                      <div className="h-1.5 w-1.5 rounded-full" style={{ background: gradeColor }} />
                    </div>
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className="font-semibold text-sm leading-tight">{record.description}</p>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                        {format(new Date(record.date), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {(record.companyName || record.technicianName) && (
                        <p>{[record.companyName, record.technicianName ? `(${record.technicianName})` : ""].filter(Boolean).join(" ")}</p>
                      )}
                      {record.cost && Number(record.cost) > 0 && (
                        <p className="font-semibold text-foreground">${Number(record.cost).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed tasks as lightweight history entries */}
            {completedTasks.length > 0 && (records as any[]).length === 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Completed Tasks</p>
                {completedTasks.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="flex-1">{t.title}</span>
                    {t.completedAt && <span className="shrink-0">{format(new Date(t.completedAt), "MMM d")}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Request service CTA */}
      <div className="flex justify-end">
        <Link href={`/marketplace`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Request Service for This Asset
          </Button>
        </Link>
      </div>
    </div>
  );
}
