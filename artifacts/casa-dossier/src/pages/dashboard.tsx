import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPropertySummary,
  getGetPropertySummaryQueryKey,
  useUpdateProperty,
  useListMarketplaceJobs,
  getGetPropertyQueryKey,
  getListPropertiesQueryKey,
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
  Wrench,
  Clock,
  Calendar,
} from "lucide-react";
import { format } from "@/lib/date";
import { Link } from "wouter";
import homeHeroBadge from "@assets/home_hero_badge_1779979811101.png";

// ── Grade config (static colors only — labels/CTAs are translated at render time)
const GRADE_CONFIG = {
  A: { color: "#3d7a5f", bg: "#3d7a5f12", ringFg: "#3d7a5f", labelKey: "gradeExcellent" as const, ctaKey: "ctaExcellent" as const },
  B: { color: "#4b7fb5", bg: "#4b7fb512", ringFg: "#4b7fb5", labelKey: "gradeGood"      as const, ctaKey: "ctaGood"      as const },
  C: { color: "#c8853a", bg: "#c8853a12", ringFg: "#c8853a", labelKey: "gradeFair"      as const, ctaKey: "ctaFair"      as const },
  D: { color: "#b85a2a", bg: "#b85a2a12", ringFg: "#b85a2a", labelKey: "gradePoor"      as const, ctaKey: "ctaPoor"      as const },
  F: { color: "#c0392b", bg: "#c0392b0e", ringFg: "#c0392b", labelKey: "gradeCritical"  as const, ctaKey: "ctaCritical"  as const },
} as const;

// ── Compact health score widget ────────────────────────────────────────────────
function HealthScoreWidget({ score, grade, overdueCount, onClick }: {
  score: number; grade: keyof typeof GRADE_CONFIG; overdueCount: number; onClick: () => void;
}) {
  const cfg = GRADE_CONFIG[grade];
  const { t } = useTranslation();
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
          {score >= 100 ? (
            <img src={homeHeroBadge} alt={t("dashboard.homeHero")} className="w-10 h-10 object-contain" />
          ) : (
            <>
              <span className="text-lg font-black tabular-nums" style={{ color: cfg.color }}>{score}</span>
              <span className="text-[9px] text-muted-foreground font-medium">/ 100</span>
            </>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ color: cfg.color }}>{t("dashboard.grade", { grade })}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
            {t(`dashboard.${cfg.labelKey}`)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{t(`dashboard.${cfg.ctaKey}`)}</p>
        {overdueCount > 0 && (
          <p className="text-xs font-semibold mt-1.5 flex items-center gap-1" style={{ color: cfg.color }}>
            <TrendingUp className="h-3 w-3" />
            {t("dashboard.improvementPlan")}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
    </button>
  );
}

// ── Investment Ledger dashboard card ──────────────────────────────────────────
// One card, one action: what's inside is listed as plain text (not tiles that
// look like separate buttons) and the CTA on the right opens the ledger.
function LedgerCard({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const features = [
    { icon: DollarSign, label: `${t("dashboard.trackSpend")} ${t("dashboard.bySystem")}` },
    { icon: TrendingUp, label: t("dashboard.estVsActual") },
    { icon: FileText,   label: t("dashboard.allRecords") },
  ];
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="bg-primary/10 rounded-xl p-2.5 shrink-0">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight">{t("dashboard.investmentLedger")}</p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
              {features.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-1">
                  <Icon className="h-3 w-3 text-primary/70" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 self-start sm:self-center shrink-0 rounded-lg bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 group-hover:bg-primary/15 transition-colors">
          {t("dashboard.openLedger")}
          <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </button>
  );
}

// ── Pending service requests widget ───────────────────────────────────────────
const jobUrgencyConfig: Record<string, { label: string; icon: React.ReactNode; borderColor: string; textColor: string }> = {
  emergency: { label: "Emergency", borderColor: "border-l-destructive",   textColor: "text-destructive",    icon: <AlertCircle className="h-3 w-3 text-destructive" /> },
  high:      { label: "High",      borderColor: "border-l-orange-500",    textColor: "text-orange-600",     icon: <AlertCircle className="h-3 w-3 text-orange-500" /> },
  medium:    { label: "Medium",    borderColor: "border-l-amber-400",     textColor: "text-amber-600",      icon: <Clock className="h-3 w-3 text-amber-500" /> },
  low:       { label: "Low",       borderColor: "border-l-muted-foreground/30", textColor: "text-muted-foreground", icon: <Clock className="h-3 w-3 text-muted-foreground" /> },
};

function PendingJobsWidget() {
  const { data: jobs } = useListMarketplaceJobs();
  const { t } = useTranslation();
  const activeJobs = (jobs ?? []).filter(
    (j) => j.status === "open" || j.status === "claimed" || (j.status as string) === "en_route" || (j.status as string) === "arrived"
  );
  if (!activeJobs.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t("dashboard.activeServiceRequests")}</h2>
          <span className="text-xs bg-primary/10 text-primary font-semibold rounded-full px-2 py-0.5">{activeJobs.length}</span>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
          <Link href="/marketplace">
            {t("dashboard.viewAll")} <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {activeJobs.map((job) => {
          const uc = jobUrgencyConfig[job.urgency ?? "medium"] ?? jobUrgencyConfig.medium;
          const jobStatus = job.status as string;
          const STATUS_LABEL: Record<string, string> = {
            open:     t("dashboard.awaitingPro"),
            claimed:  t("dashboard.proAssigned"),
            en_route: t("dashboard.onTheWay"),
            arrived:  t("dashboard.arrived"),
          };
          const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
            open:     "secondary",
            claimed:  "default",
            en_route: "default",
            arrived:  "default",
          };
          const STATUS_CLASS: Record<string, string> = {
            open:     "",
            claimed:  "",
            en_route: "bg-blue-500 hover:bg-blue-500 text-white",
            arrived:  "bg-emerald-500 hover:bg-emerald-500 text-white",
          };
          const showScheduled = jobStatus === "claimed" || jobStatus === "en_route" || jobStatus === "arrived";
          return (
            <Link key={job.id} href="/marketplace">
              <div className={`shrink-0 w-64 sm:w-auto rounded-xl border border-l-4 ${uc.borderColor} bg-card hover:shadow-md hover:-translate-y-0.5 transition-all p-3.5 space-y-2 cursor-pointer`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {uc.icon}
                    <span className="text-xs font-semibold text-foreground truncate">{job.assetName}</span>
                  </div>
                  <Badge variant={STATUS_VARIANT[jobStatus] ?? "secondary"} className={`text-[10px] shrink-0 ${STATUS_CLASS[jobStatus] ?? ""}`}>
                    {STATUS_LABEL[jobStatus] ?? t("dashboard.awaitingPro")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{job.description}</p>
                {showScheduled && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 shrink-0" />
                    {job.scheduledAt
                      ? <span className="font-medium text-foreground">{format(new Date(job.scheduledAt), t("dashboard.scheduledAtFormat"))}</span>
                      : <span className="italic">{t("dashboard.serviceDatePending")}</span>}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function NoPropertyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="bg-secondary rounded-2xl p-6 mb-6">
        <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{t("dashboard.noProperty")}</h2>
      <p className="text-muted-foreground max-w-sm mb-6 text-sm">
        {t("dashboard.addHomeDesc")}
      </p>
      <Button asChild className="gap-2">
        <Link href="/properties"><Plus className="h-4 w-4" />{t("dashboard.addYourHome")}</Link>
      </Button>
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
  const { t } = useTranslation();
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
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
          toast({ title: t("dashboard.toast.renamed"), description: t("dashboard.toast.renamedDesc", { name: trimmed }) });
        },
        onError: () => toast({ title: t("dashboard.toast.renameFailed"), variant: "destructive" }),
        onSettled: () => setEditingName(false),
      }
    );
  }

  const { data: summary, isLoading: summaryLoading } = useGetPropertySummary(
    activePropertyId ?? "",
    { query: { enabled: !!activePropertyId, queryKey: getGetPropertySummaryQueryKey(activePropertyId ?? "") } }
  );

  const isLoading = propLoading || (!!activePropertyId && summaryLoading);

  if (isLoading) return <DashboardSkeleton />;
  if (!activePropertyId || !activeProperty) return <NoPropertyState />;
  if (!summary) return <DashboardSkeleton />;

  const grade = (summary.healthGrade ?? "C") as keyof typeof GRADE_CONFIG;
  const recentRecords = summary.recentRecords ?? [];
  const assetScores = summary.assetScores ?? [];
  const overdueTasksList = summary.overdueTasks ?? [];
  const location = [activeProperty.city, activeProperty.state].filter(Boolean).join(", ");

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Property header + score widget ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                aria-label={t("dashboard.homeName")}
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
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title={t("dashboard.renameHome")}
                  aria-label={t("dashboard.renameHome")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground h-7 px-2 shrink-0">
              <Link href={`/properties/${activePropertyId}`}>
                <span className="text-xs">{t("dashboard.view")}</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
          {location && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </p>
          )}
          {!!(activeProperty.bedrooms || activeProperty.bathrooms || activeProperty.sqft) && (
            <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              {!!activeProperty.bedrooms && (
                <span className="flex items-center gap-1">
                  <BedDouble className="h-3.5 w-3.5" />
                  {activeProperty.bedrooms} {t("dashboard.bd")}
                </span>
              )}
              {!!activeProperty.bathrooms && (
                <span className="flex items-center gap-1">
                  <Bath className="h-3.5 w-3.5" />
                  {Number(activeProperty.bathrooms)} {t("dashboard.ba")}
                </span>
              )}
              {!!activeProperty.sqft && (
                <span className="flex items-center gap-1">
                  <Ruler className="h-3.5 w-3.5" />
                  {activeProperty.sqft.toLocaleString()} {t("dashboard.sqft")}
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

      {/* ── Active service requests widget ── */}
      <PendingJobsWidget />

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.trackedAssets")}</CardTitle>
            <Hammer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAssets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 font-semibold">{summary.verifiedAssets}</span> {t("dashboard.ofVerified", { total: summary.totalAssets })}
            </p>
          </CardContent>
        </Card>

        <Card className={`hover:shadow-sm transition-shadow ${(summary.overdueTaskCount ?? 0) > 0 ? "border-destructive/30" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.overdueTasks")}</CardTitle>
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
              {(summary.overdueTaskCount ?? 0) > 0 ? t("dashboard.seeWhatToFix") : t("dashboard.allClear")}
            </button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.assetsBySystem")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {summary.assetsByCategory?.map((cat) => (
                <div key={cat.category} className="flex items-center gap-1 bg-secondary rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {t(`assets.category.${cat.category}`, { defaultValue: cat.category })} <span className="text-muted-foreground">· {cat.count}</span>
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
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-sm font-semibold">{t("dashboard.recentServiceActivity")}</CardTitle>
            <CardDescription>{t("dashboard.latestWork")}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pt-0">
            {recentRecords.length > 0 ? (
              <div className="space-y-4">
                {recentRecords.slice(0, 6).map((record) => (
                  <div key={record.id} className="flex items-start gap-3">
                    <div className="mt-0.5 bg-secondary p-1.5 rounded-full shrink-0">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium leading-snug line-clamp-2">{record.description}</p>
                      <p className="text-xs text-muted-foreground break-words">
                        {record.assetName && <span className="font-medium">{record.assetName} · </span>}
                        {record.companyName === "CasaService" ? (
                          <>
                            <span className="inline-flex items-center bg-amber-50 border border-amber-200 font-semibold px-1 py-px rounded text-[10px] tracking-wide mr-0.5">
                              <span className="casa-shimmer-gold">✦ CasaService</span>
                            </span>
                            {record.technicianName && ` — ${record.technicianName}`}
                          </>
                        ) : (record.technicianName || record.companyName || t("dashboard.serviceFallback"))}
                        {" · "}{format(new Date(record.date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">{t("dashboard.noServiceRecords")}</p>
                <p className="text-xs mt-1 text-center max-w-xs">
                  {t("dashboard.noServiceRecordsDesc")}
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
