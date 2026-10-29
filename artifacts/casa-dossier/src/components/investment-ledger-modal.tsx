import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  useGetInvestmentLedger,
  getGetInvestmentLedgerQueryKey,
  type GetInvestmentLedgerRange,
} from "@workspace/api-client-react";
import { useSubscription, isBasicPlus } from "@/contexts/subscription-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "@/lib/date";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, Minus, Receipt, DollarSign,
  Wrench, Calendar, Lock, Sparkles,
} from "lucide-react";

// ── Date range options (labels live under `ledger.range.<key>`) ───────────────
const RANGES: GetInvestmentLedgerRange[] = [
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
  "this_year",
  "last_year",
  "all_time",
];

// ── Category colours (matches asset-detail) ───────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  HVAC:       "#3b82f6",
  Plumbing:   "#06b6d4",
  Electrical: "#eab308",
  Roof:       "#78716c",
  Appliance:  "#8b5cf6",
  Structural: "#22c55e",
  Other:      "#94a3b8",
};

function catColor(cat: string) {
  return CAT_COLORS[cat] ?? "#94a3b8";
}

function fmt$(n: number) {
  return n === 0 ? "$0"
    : n >= 1000 ? `$${(n / 1000).toFixed(1)}k`
    : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// ── Custom donut label ────────────────────────────────────────────────────────
function DonutCenter({ total }: { total: number }) {
  const { t } = useTranslation();
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
      <tspan x="50%" dy="-0.4em" fontSize={18} fontWeight={700} fill="currentColor">
        {fmt$(total)}
      </tspan>
      <tspan x="50%" dy="1.4em" fontSize={10} fill="#94a3b8">
        {t("ledger.totalSpent")}
      </tspan>
    </text>
  );
}

// ── Expected vs Actual row ────────────────────────────────────────────────────
function CompareBar({ actual, expected }: { actual: number; expected: number }) {
  const max = Math.max(actual, expected, 1);
  const over = actual > expected && expected > 0;
  const under = actual < expected && expected > 0;
  const diff = Math.abs(actual - expected);
  const diffPct = expected > 0 ? Math.round((diff / expected) * 100) : 0;
  const { t } = useTranslation();
  const diffAmount = diff.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t("ledger.expectedVsActual")}</p>
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-muted-foreground">{t("ledger.expected")}</span>
            <span>${expected.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(expected / max) * 100}%`, background: "#94a3b8" }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-muted-foreground">{t("ledger.actual")}</span>
            <span>${actual.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(actual / max) * 100}%`,
                background: over ? "#ef4444" : under ? "#22c55e" : "#3b82f6",
              }}
            />
          </div>
        </div>
      </div>

      {expected > 0 && (
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${
          over ? "text-destructive" : under ? "text-emerald-600" : "text-muted-foreground"
        }`}>
          {over ? <TrendingUp className="h-3.5 w-3.5" /> : under ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          {over
            ? t("ledger.overBudget", { pct: diffPct, amount: diffAmount })
            : under
            ? t("ledger.underBudget", { pct: diffPct, amount: diffAmount })
            : t("ledger.onBudget")}
        </div>
      )}
      {expected === 0 && actual > 0 && (
        <p className="text-xs text-muted-foreground">{t("ledger.noEstimates")}</p>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function InvestmentLedgerModal({
  open,
  onOpenChange,
  propertyId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyId: string;
}) {
  const { t } = useTranslation();
  const { subscription, isLoading: subscriptionLoading, openUpgradeModal } = useSubscription();
  const locked = !subscriptionLoading && !isBasicPlus(subscription?.tier);
  const [range, setRange] = useState<GetInvestmentLedgerRange>("this_year");
  const params = { range };
  const { data, isLoading: loading } = useGetInvestmentLedger(propertyId, params, {
    query: {
      queryKey: getGetInvestmentLedgerQueryKey(propertyId, params),
      enabled: open && !!propertyId,
    },
  });

  const pieData = (data?.byCategory ?? [])
    .filter((c) => c.actual > 0)
    .map((c) => ({ name: c.category, value: c.actual }));

  const hasSpend = (data?.totals.actual ?? 0) > 0;
  const records = data?.records.filter((r) => r.cost && Number(r.cost) > 0) ?? [];

  if (locked) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center py-6 gap-4">
            <div className="bg-amber-100 dark:bg-amber-950 p-4 rounded-full">
              <Lock className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold mb-1">{t("dashboard.investmentLedger")}</DialogTitle>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <Trans i18nKey="ledger.lockedDesc" components={{ strong: <strong /> }} />
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Button
                onClick={() => { onOpenChange(false); openUpgradeModal(); }}
                className="w-full gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {t("healthScore.upgradeToBasic", { price: "$9.99" })}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                {t("healthScore.maybeLater")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <div className="bg-primary/10 rounded-lg p-1.5">
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            {t("dashboard.investmentLedger")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {t("ledger.subtitle")}
          </p>
        </DialogHeader>

        {/* Range selector */}
        <div className="px-6 pt-4 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {RANGES.map((key) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                aria-pressed={range === key}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  range === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`ledger.range.${key}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 pt-4 pb-6 space-y-5">
          {loading || subscriptionLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Wrench className="h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm font-medium">{t("ledger.loadFailed")}</p>
            </div>
          ) : (
            <>
              {/* Donut chart + category legend */}
              {hasSpend ? (
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
                    {t("ledger.spendByCategory")}
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-full sm:w-56 h-48 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius="58%"
                            outerRadius="80%"
                            paddingAngle={2}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {pieData.map((entry) => (
                              <Cell key={entry.name} fill={catColor(entry.name)} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, t("ledger.spent")]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="flex-1 space-y-2 w-full">
                      {data.byCategory.filter(c => c.actual > 0).map((c) => {
                        const pct = data.totals.actual > 0
                          ? Math.round((c.actual / data.totals.actual) * 100)
                          : 0;
                        return (
                          <div key={c.category} className="flex items-center gap-2.5">
                            <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: catColor(c.category) }} />
                            <span className="text-xs font-medium flex-1">{t(`assets.category.${c.category}`, { defaultValue: c.category })}</span>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                            <span className="text-xs font-bold tabular-nums">
                              ${c.actual.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        );
                      })}
                      <div className="border-t pt-2 flex items-center gap-2.5">
                        <div className="h-2.5 w-2.5 shrink-0" />
                        <span className="text-xs font-bold flex-1">{t("ledger.total")}</span>
                        <span className="text-xs font-black tabular-nums text-primary">
                          ${data.totals.actual.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border bg-muted/20 flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <DollarSign className="h-8 w-8 opacity-20" />
                  <p className="text-sm font-medium">{t("ledger.noSpend")}</p>
                  <p className="text-xs text-center max-w-xs">{t("ledger.noSpendDesc")}</p>
                </div>
              )}

              {/* Expected vs Actual */}
              <CompareBar actual={data.totals.actual} expected={data.totals.expected} />

              {/* Running ledger */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  {t("ledger.maintenanceLedger")}
                  {records.length > 0 && (
                    <span className="ml-2 font-normal normal-case text-muted-foreground">
                      {t("ledger.recordsWithCosts", { count: records.length })}
                    </span>
                  )}
                </p>
                {records.length === 0 ? (
                  <div className="rounded-xl border bg-muted/20 flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">{t("ledger.noCostRecords")}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden divide-y">
                    {records.map((r) => (
                      <div key={r.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div
                          className="mt-0.5 h-2.5 w-2.5 rounded-sm shrink-0 mt-1.5"
                          style={{ background: catColor(r.assetCategory) }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight line-clamp-1">{r.description}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                            <span className="font-medium">{r.assetName}</span>
                            <span>·</span>
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1.5 h-4 font-medium"
                              style={{ background: catColor(r.assetCategory) + "20", color: catColor(r.assetCategory) }}
                            >
                              {t(`assets.category.${r.assetCategory}`, { defaultValue: r.assetCategory })}
                            </Badge>
                            {(r.companyName || r.technicianName) && (
                              <>
                                <span>·</span>
                                {r.companyName === "CasaService" ? (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="inline-flex items-center bg-amber-50 border border-amber-200 font-semibold px-1 py-px rounded text-[9px] tracking-wide">
                                      <span className="casa-shimmer-gold">✦ CasaService</span>
                                    </span>
                                    {r.technicianName && <span> — {r.technicianName}</span>}
                                  </span>
                                ) : (
                                  <span>{r.companyName || r.technicianName}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-foreground">
                            ${Number(r.cost).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-0.5 justify-end">
                            <Calendar className="h-2.5 w-2.5" />
                            {format(new Date(r.date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    ))}
                    {/* Ledger total */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
                      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("ledger.periodTotal")}</span>
                      <span className="text-sm font-black text-primary">
                        ${data.totals.actual.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
