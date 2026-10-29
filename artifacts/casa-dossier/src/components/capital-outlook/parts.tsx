import type { CapitalOutlookAsset, CapitalTimelineEntry } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";

/** Whole-dollar USD. Numeric DB columns can arrive as strings, hence Number(). */
export function fmt(n: number | string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));
}

// Labels live under `capitalOutlook.urgency.<key>`.
export const URGENCY_CONFIG = {
  critical: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", bar: "#ef4444" },
  warning:  { color: "text-amber-600",   bg: "bg-amber-50",       border: "border-amber-200",       bar: "#f59e0b" },
  good:     { color: "text-chart-1",     bg: "bg-chart-1/10",     border: "border-chart-1/20",      bar: "#22c55e" },
  unknown:  { color: "text-muted-foreground", bg: "bg-muted",      border: "border-border",          bar: "#94a3b8" },
};

export const CATEGORY_ICONS: Record<string, string> = {
  HVAC: "❄️", Plumbing: "🔧", Electrical: "⚡", Roof: "🏠", Appliance: "🫙", Structural: "🏗️", Other: "📦",
};

export function LifeBar({ percent, urgency }: { percent: number; urgency: CapitalOutlookAsset["urgency"] }) {
  const colors = { critical: "bg-destructive", warning: "bg-amber-400", good: "bg-chart-1", unknown: "bg-muted-foreground/30" };
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${colors[urgency]}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export type CustomTooltipProps = {
  active?: boolean;
  payload?: { value: number }[];
  label?: number;
  data?: CapitalTimelineEntry[];
};

export function CustomBarTooltip({ active, payload, label, data }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = data?.find((d) => d.year === label);
  return (
    <div className="bg-background border shadow-lg rounded-xl px-4 py-3 text-sm min-w-[180px]">
      <p className="font-bold text-base mb-1">{label}</p>
      <p className="text-primary font-semibold">{fmt(payload[0]!.value)}</p>
      {entry?.assetNames.length ? (
        <div className="mt-2 pt-2 border-t space-y-0.5">
          {entry.assetNames.map((n) => (
            <p key={n} className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-muted-foreground inline-block" />
              {n}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SummaryCard({ icon, label, value, sub, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${highlight ? "bg-primary/15" : "bg-muted"}`}>
            <span className={highlight ? "text-primary" : "text-muted-foreground"}>{icon}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`text-xl font-bold mt-0.5 ${highlight ? "text-primary" : ""}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
