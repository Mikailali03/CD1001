import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPropertySummary,
  useUpdateProperty,
  getGetPropertyQueryKey,
} from "@workspace/api-client-react";
import { useProperty } from "@/contexts/property-context";
import { HealthScoreModal } from "@/components/health-score-modal";
import { MaintenanceInbox } from "@/components/maintenance-inbox";
import { InvestmentLedgerModal } from "@/components/investment-ledger-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  AlertCircle,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Building2,
  Plus,
  TrendingUp,
  ChevronRight,
  Hammer,
  Receipt,
  DollarSign,
  Pencil,
  BedDouble,
  Bath,
  Ruler,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

// ── Grade config ───────────────────────────────────────────────────────────────
const GRADE_CONFIG = {
  A: { color: "#3d7a5f", bg: "#3d7a5f12", ringFg: "#3d7a5f", label: "Excellent",  cta: "Your home is in great shape!" },
  B: { color: "#4b7fb5", bg: "#4b7fb512", ringFg: "#4b7fb5", label: "Good",       cta: "A few quick tasks will get you to A." },
  C: { color: "#c8853a", bg: "#c8853a12", ringFg: "#c8853a", label: "Fair",       cta: "Several items need attention." },
  D: { color: "#b85a2a", bg: "#b85a2a12", ringFg: "#b85a2a", label: "Poor",       cta: "Significant backlog detected." },
  F: { color: "#c0392b", bg: "#c0392b0e", ringFg: "#c0392b", label: "Critical",   cta: "Immediate action recommended." },
} as const;

// ── Compact health score widget ────────────────────────────────────────────────
function HealthScoreWidget({ score, grade, overdueCount, onClick }: {
  score: number; grade: keyof typeof GRADE_CONFIG; overdueCount: number; onClick: () => void;
}) {
  const cfg = GRADE_CONFIG[grade];
  const radius = 26, stroke = 5;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 rounded-xl border-2 bg-card px-5 py-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto"
      style={{ borderColor: cfg.color + "44" }}
    >
      <div className="relative shrink-0">
        <svg width={66} height={66} className="-rotate-90">
          <circle cx={33} cy={33} r={radius} fill="none" stroke={cfg.bg} strokeWidth={stroke} />
          <circle cx={33} cy={33} r={radius} fill="none" stroke={cfg.ringFg} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-lg font-black tabular-nums" style={{ color: cfg.color }}>{score}</span>
          <span className="text-[9px] text-muted-foreground font-medium">/ 100</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ color: cfg.color }}>Grade {grade}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{cfg.cta}</p>
        {overdueCount > 0 && (
          <p className="text-xs font-semibold mt-1.5 flex items-center gap-1" style={{ color: cfg.color }}>
            <TrendingUp className="h-3 w-3" />
            See improvement plan
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
    </button>
  );
}

// ── Investment Ledger dashboard card ──────────────────────────────────────────
function LedgerCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-xl p-2.5 shrink-0">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">Investment Ledger</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Spending by category · expected vs actual
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
      </div>
      <div className="grid grid-cols-3 divide-x border-t bg-muted/20">
        {[
          { icon: DollarSign, label: "Track spend", sub: "by system" },
          { icon: TrendingUp,  label: "Compare",    sub: "est. vs actual" },
          { icon: FileText,    label: "Full ledger", sub: "all records" },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex flex-col items-center gap-0.5 py-3 px-2">
            <Icon className="h-3.5 w-3.5 text-primary mb-0.5" />
            <span className="text-[11px] font-semibold text-foreground">{label}</span>
            <span className="text-[10px] text-muted-foreground">{sub}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function NoPropertyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="bg-secondary rounded-2xl p-6 mb-6">
        <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No property selected</h2>
      <p className="text-muted-foreground max-w-sm mb-6 text-sm">
        Add your home to start tracking its health score, assets, and maintenance schedule.
      </p>
      <Link href="/properties">
        <Button className="gap-2"><Plus className="h-4 w-4" />Add Your Home</Button>
      </Link>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-[74px] w-72 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { activePropertyId, activeProperty, isLoading: propLoading } = useProperty();
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateProperty = useUpdateProperty();

  function startEditingName() {
    setNameValue(activeProperty?.name ?? "");
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  function commitNameEdit() {
    const trimmed = nameValue.trim();
    if (!trimmed || !activePropertyId || trimmed === activeProperty?.name) {
      setEditingName(false);
      return;
    }
    updateProperty.mutate(
      { propertyId: activePropertyId, data: { name: trimmed } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(activePropertyId) });
          toast({ title: "Home renamed", description: `Now called "${trimmed}".` });
        },
        onError: () => toast({ title: "Could not save name", variant: "destructive" }),
        onSettled: () => setEditingName(false),
      }
    );
  }

  const { data: summary, isLoading: summaryLoading } = useGetPropertySummary(
    activePropertyId ?? "",
    { query: { enabled: !!activePropertyId } }
  );

  const isLoading = propLoading || (!!activePropertyId && summaryLoading);

  if (isLoading) return <DashboardSkeleton />;
  if (!activePropertyId || !activeProperty) return <NoPropertyState />;
  if (!summary) return <DashboardSkeleton />;

  const grade = (summary.healthGrade ?? "C") as keyof typeof GRADE_CONFIG;
  const recentRecords = (summary as any).recentRecords ?? [];
  const assetScores: any[] = (summary as any).assetScores ?? [];
  const overdueTasksList: any[] = (summary as any).overdueTasks ?? [];
  const location = [activeProperty.city, activeProperty.state].filter(Boolean).join(", ");

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Property header + score widget ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitNameEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitNameEdit();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="text-2xl font-bold tracking-tight bg-transparent border-b-2 border-primary outline-none w-full max-w-sm"
                autoFocus
              />
            ) : (
              <div className="group flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{activeProperty.name}</h1>
                <button
                  onClick={startEditingName}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Rename home"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <Link href={`/properties/${activePropertyId}`}>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground h-7 px-2 shrink-0">
                <span className="text-xs">View</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {location && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </p>
          )}
          {(activeProperty.bedrooms || activeProperty.bathrooms || activeProperty.sqft) && (
            <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              {activeProperty.bedrooms && (
                <span className="flex items-center gap-1">
                  <BedDouble className="h-3.5 w-3.5" />
                  {activeProperty.bedrooms} bd
                </span>
              )}
              {activeProperty.bathrooms && (
                <span className="flex items-center gap-1">
                  <Bath className="h-3.5 w-3.5" />
                  {activeProperty.bathrooms} ba
                </span>
              )}
              {activeProperty.sqft && (
                <span className="flex items-center gap-1">
                  <Ruler className="h-3.5 w-3.5" />
                  {activeProperty.sqft.toLocaleString()} sqft
                </span>
              )}
            </div>
          )}
        </div>
        <HealthScoreWidget
          score={summary.healthScore}
          grade={grade}
          overdueCount={summary.overdueTaskCount ?? 0}
          onClick={() => setHealthModalOpen(true)}
        />
      </div>

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tracked Assets</CardTitle>
            <Hammer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAssets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 font-semibold">{summary.verifiedAssets}</span> of {summary.totalAssets} verified
            </p>
          </CardContent>
        </Card>

        <Card className={`hover:shadow-sm transition-shadow ${(summary.overdueTaskCount ?? 0) > 0 ? "border-destructive/30" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertCircle className={`h-4 w-4 ${(summary.overdueTaskCount ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(summary.overdueTaskCount ?? 0) > 0 ? "text-destructive" : ""}`}>
              {summary.overdueTaskCount}
            </div>
            <button
              onClick={() => setHealthModalOpen(true)}
              className="text-xs text-primary underline-offset-2 hover:underline mt-1 flex items-center gap-0.5"
            >
              {(summary.overdueTaskCount ?? 0) > 0 ? "See what to fix →" : "All clear"}
            </button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assets by System</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {summary.assetsByCategory?.map((cat) => (
                <div key={cat.category} className="flex items-center gap-1 bg-secondary rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {cat.category} <span className="text-muted-foreground">· {cat.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Investment Ledger card ── */}
      <LedgerCard onClick={() => setLedgerOpen(true)} />

      {/* ── Bottom row: maintenance inbox + recent activity ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Maintenance Inbox */}
        <MaintenanceInbox propertyId={activePropertyId} />

        {/* Recent service activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Recent Service Activity</CardTitle>
            <CardDescription>Latest work done on this property</CardDescription>
          </CardHeader>
          <CardContent>
            {recentRecords.length > 0 ? (
              <div className="space-y-5">
                {recentRecords.slice(0, 6).map((record: any) => (
                  <div key={record.id} className="flex items-start gap-3">
                    <div className="mt-0.5 bg-secondary p-1.5 rounded-full shrink-0">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium leading-tight line-clamp-2">{record.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.assetName && <span className="font-medium">{record.assetName} · </span>}
                        {record.technicianName || record.companyName || "Service"}
                        {" · "}{format(new Date(record.date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No service records yet</p>
                <p className="text-xs mt-1 text-center max-w-xs">
                  Service history will appear here as you log work done on your home's systems.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Health score modal ── */}
      <HealthScoreModal
        open={healthModalOpen}
        onOpenChange={setHealthModalOpen}
        healthScore={summary.healthScore}
        healthGrade={summary.healthGrade ?? "C"}
        overdueTaskCount={summary.overdueTaskCount ?? 0}
        overdueTasks={overdueTasksList}
        assetScores={assetScores}
        propertyId={activePropertyId}
      />

      {/* ── Investment ledger modal ── */}
      <InvestmentLedgerModal
        open={ledgerOpen}
        onOpenChange={setLedgerOpen}
        propertyId={activePropertyId}
      />
    </div>
  );
}
