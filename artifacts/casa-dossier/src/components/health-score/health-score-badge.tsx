import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGetPropertySummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import homeHeroBadge from "@assets/home_hero_badge_1779979811101.png";

// ------------------------------------------------------------------
// Circular progress ring — used on the property card
// ------------------------------------------------------------------

const RING_RADIUS = 36;
const RING_STROKE = 7;
const RING_SIZE = (RING_RADIUS + RING_STROKE) * 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function scoreColor(score: number): string {
  if (score >= 90) return "#10b981"; // emerald
  if (score >= 75) return "#3b82f6"; // blue
  if (score >= 60) return "#f59e0b"; // amber
  if (score >= 45) return "#f97316"; // orange
  return "#ef4444";                  // red
}

interface HealthScoreBadgeProps {
  propertyId: string;
  onClick: (e: React.MouseEvent) => void;
}

export function HealthScoreBadge({ propertyId, onClick }: HealthScoreBadgeProps) {
  const { t } = useTranslation();
  const { data: summary, isLoading } = useGetPropertySummary(propertyId);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    if (summary?.healthScore == null) return;
    // Defer one frame so the transition is visible even when data is cached
    const raf = requestAnimationFrame(() => {
      setTimeout(() => setAnimatedScore(summary.healthScore), 50);
    });
    return () => cancelAnimationFrame(raf);
  }, [summary?.healthScore]);

  if (isLoading) {
    return <Skeleton className="rounded-full shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }} />;
  }

  if (!summary) return null;

  const { healthScore, healthGrade } = summary;
  const color = scoreColor(healthScore);
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const filled = RING_CIRCUMFERENCE * (animatedScore / 100);
  const offset = RING_CIRCUMFERENCE - filled;

  return (
    <button
      onClick={onClick}
      title={t("propertyHealth.badgeTitle", { score: healthScore, grade: healthGrade })}
      className="shrink-0 rounded-full cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        aria-label={t("propertyHealth.badgeLabel", { score: healthScore })}
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={RING_RADIUS}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={RING_STROKE}
        />
        {/* Progress arc — starts at top (-90°) */}
        <circle
          cx={cx}
          cy={cy}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
        />
        {/* Score / badge label */}
        {healthScore >= 100 ? (
          <image
            href={homeHeroBadge}
            x={cx - 28}
            y={cy - 28}
            width={56}
            height={56}
          />
        ) : (
          <>
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="17"
              fontWeight="700"
              fill={color}
              style={{ fontFamily: "inherit" }}
            >
              {healthScore}
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12"
              fontWeight="600"
              fill={color}
              opacity="0.75"
              style={{ fontFamily: "inherit" }}
            >
              {healthGrade}
            </text>
          </>
        )}
      </svg>
    </button>
  );
}
