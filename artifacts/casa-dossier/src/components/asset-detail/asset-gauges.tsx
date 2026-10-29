import { useTranslation } from "react-i18next";
import { getExpectedLifespan } from "@workspace/maintenance-specs";
import { gradeFromScore } from "@/lib/asset-scoring";

// ── Large Radial Gauge ─────────────────────────────────────────────────────────
export function LargeRadialGauge({ score }: { score: number }) {
  const { t } = useTranslation();
  const { grade, color, labelKey } = gradeFromScore(score);
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
        <span className="text-xs text-muted-foreground">{t(`assets.grade.${labelKey}`)}</span>
      </div>
    </div>
  );
}

// ── Life-used bar ──────────────────────────────────────────────────────────────
export function LifeBar({ installDate, category, name }: { installDate: string | null; category: string; name: string }) {
  const { t } = useTranslation();
  if (!installDate) return null;
  const lifespan = getExpectedLifespan(category, name);
  const ageYears = (Date.now() - new Date(installDate).getTime()) / (365.25 * 24 * 3600 * 1000);
  const pct = Math.min(Math.round((ageYears / lifespan) * 100), 100);
  const barColor = pct >= 80 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#22c55e";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{t("assetDetail.lifeUsed")}</span>
        <span className="font-semibold" style={{ color: barColor }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("assetDetail.lifeSummary", { age: Math.round(ageYears), lifespan })}
      </p>
    </div>
  );
}
