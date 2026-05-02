import { useProperty } from "@/contexts/property-context";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  ChevronRight,
  Plus,
  Building2,
  Package,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; bg: string; lifespan: number }> = {
  HVAC:       { emoji: "❄️",  color: "#3b82f6", bg: "#3b82f615", lifespan: 15 },
  Plumbing:   { emoji: "🔧",  color: "#06b6d4", bg: "#06b6d415", lifespan: 12 },
  Electrical: { emoji: "⚡",  color: "#eab308", bg: "#eab30815", lifespan: 40 },
  Roof:       { emoji: "🏠",  color: "#78716c", bg: "#78716c15", lifespan: 25 },
  Appliance:  { emoji: "🫙",  color: "#8b5cf6", bg: "#8b5cf615", lifespan: 12 },
  Structural: { emoji: "🏗️", color: "#22c55e", bg: "#22c55e15", lifespan: 50 },
  Other:      { emoji: "📦",  color: "#94a3b8", bg: "#94a3b815", lifespan: 20 },
};

const CATEGORY_ORDER = ["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"];

type Asset = {
  id: string;
  propertyId: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  installDate: string | null;
  warrantyExpiry: string | null;
  replacementCost: string | null;
  status: string;
  notes: string | null;
};

// ── Per-asset health score ─────────────────────────────────────────────────────
function calcScore(asset: Asset): number {
  let score = 100;
  const cfg = CATEGORY_CONFIG[asset.category] ?? CATEGORY_CONFIG.Other!;

  if (asset.installDate) {
    const ageYears = (Date.now() - new Date(asset.installDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    const agePct = Math.min(ageYears / cfg.lifespan, 1);
    score -= Math.round(agePct * 40);
  }

  if (asset.status === "needs_attention") score -= 25;
  else if (asset.status === "unverified") score -= 5;
  if (asset.status === "verified") score = Math.min(score + 5, 100);
  if (asset.warrantyExpiry && new Date(asset.warrantyExpiry) > new Date()) {
    score = Math.min(score + 5, 100);
  }

  return Math.max(0, Math.round(score));
}

function gradeFromScore(score: number) {
  if (score >= 90) return { grade: "A", color: "#3d7a5f" };
  if (score >= 75) return { grade: "B", color: "#4b7fb5" };
  if (score >= 55) return { grade: "C", color: "#c8853a" };
  if (score >= 35) return { grade: "D", color: "#b85a2a" };
  return { grade: "F", color: "#c0392b" };
}

function isUnderWarranty(warrantyExpiry: string | null): boolean {
  if (!warrantyExpiry) return false;
  return new Date(warrantyExpiry) > new Date();
}

// ── Radial Gauge ──────────────────────────────────────────────────────────────
function RadialGauge({ score }: { score: number }) {
  const { grade, color } = gradeFromScore(score);
  const radius = 22, stroke = 4;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;

  return (
    <div className="relative shrink-0">
      <svg width={56} height={56} className="-rotate-90">
        <circle cx={28} cy={28} r={radius} fill="none" stroke={color + "20"} strokeWidth={stroke} />
        <circle
          cx={28} cy={28} r={radius} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[13px] font-black" style={{ color }}>{grade}</span>
        <span className="text-[9px] text-muted-foreground">{score}</span>
      </div>
    </div>
  );
}

// ── Asset Card ────────────────────────────────────────────────────────────────
function AssetCard({ asset, propertyId }: { asset: Asset; propertyId: string }) {
  const score = calcScore(asset);
  const cfg = CATEGORY_CONFIG[asset.category] ?? CATEGORY_CONFIG.Other!;
  const underWarranty = isUnderWarranty(asset.warrantyExpiry);

  return (
    <Link href={`/properties/${propertyId}/assets/${asset.id}`}>
      <div
        className="group relative flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
        style={{ borderColor: cfg.color + "20" }}
      >
        {/* Category icon */}
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl select-none"
          style={{ background: cfg.bg }}
        >
          {cfg.emoji}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5 flex-wrap">
            <span className="font-semibold text-sm leading-tight">{asset.name}</span>
            {underWarranty && (
              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 border-emerald-200 font-bold gap-0.5">
                <ShieldCheck className="h-2.5 w-2.5" />
                Warranty
              </Badge>
            )}
            {asset.status === "needs_attention" && (
              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20 font-bold">
                Needs Attention
              </Badge>
            )}
          </div>
          {(asset.brand || asset.model) && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {[asset.brand, asset.model].filter(Boolean).join(" · ")}
            </p>
          )}
          {asset.serialNumber && (
            <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5 truncate">
              S/N: {asset.serialNumber}
            </p>
          )}
        </div>

        {/* Radial gauge + chevron */}
        <div className="flex items-center gap-1.5 shrink-0">
          <RadialGauge score={score} />
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────
function AssetsSkeleton() {
  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div className="space-y-1.5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      {[0, 1].map((g) => (
        <div key={g} className="space-y-3">
          <Skeleton className="h-5 w-24" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MyAssets() {
  const { activePropertyId, activeProperty, isLoading: propLoading } = useProperty();

  const { data: assets = [], isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ["assets", activePropertyId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/properties/${activePropertyId}/assets`);
      if (!res.ok) throw new Error("Failed to fetch assets");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  if (propLoading || (!!activePropertyId && assetsLoading)) return <AssetsSkeleton />;

  if (!activePropertyId || !activeProperty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="bg-secondary rounded-2xl p-6 mb-6">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No property selected</h2>
        <p className="text-muted-foreground max-w-sm mb-6 text-sm">
          Add your home to start tracking assets and their health.
        </p>
        <Link href="/properties">
          <Button className="gap-2"><Plus className="h-4 w-4" />Add Your Home</Button>
        </Link>
      </div>
    );
  }

  // Group assets by category, skip "Home Stewardship" type assets with no serial/brand
  const grouped = CATEGORY_ORDER.reduce<Record<string, Asset[]>>((acc, cat) => {
    const items = assets.filter((a) => a.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  // Catch any uncategorized
  const otherCats = assets.filter((a) => !CATEGORY_ORDER.includes(a.category));
  if (otherCats.length > 0) grouped["Other"] = [...(grouped["Other"] ?? []), ...otherCats];

  const totalAssets = assets.length;
  const underWarrantyCount = assets.filter((a) => isUnderWarranty(a.warrantyExpiry)).length;
  const needsAttentionCount = assets.filter((a) => a.status === "needs_attention").length;

  return (
    <div className="p-6 space-y-7 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Assets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{activeProperty.name}</p>
        </div>
        <Link href={`/properties/${activePropertyId}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Asset
          </Button>
        </Link>
      </div>

      {/* ── Summary pills ── */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1.5 text-xs font-medium">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
          {totalAssets} tracked
        </div>
        {underWarrantyCount > 0 && (
          <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 rounded-full px-3 py-1.5 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            {underWarrantyCount} under warranty
          </div>
        )}
        {needsAttentionCount > 0 && (
          <div className="flex items-center gap-1.5 bg-destructive/10 text-destructive rounded-full px-3 py-1.5 text-xs font-medium">
            {needsAttentionCount} need{needsAttentionCount === 1 ? "s" : ""} attention
          </div>
        )}
      </div>

      {/* ── Category sections ── */}
      {Object.entries(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="bg-muted rounded-2xl p-5">
            <Package className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          </div>
          <div>
            <p className="font-semibold text-sm">No assets tracked yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add your first asset to start tracking health scores and maintenance.
            </p>
          </div>
          <Link href={`/properties/${activePropertyId}`}>
            <Button size="sm" className="gap-1.5 mt-1">
              <Plus className="h-3.5 w-3.5" />
              Add Asset
            </Button>
          </Link>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => {
          const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.Other!;
          return (
            <div key={category} className="space-y-3">
              {/* Category heading */}
              <div className="flex items-center gap-2">
                <span className="text-base select-none">{cfg.emoji}</span>
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                  {category}
                </h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>

              {/* Asset cards */}
              <div className="space-y-2">
                {items.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} propertyId={activePropertyId} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
