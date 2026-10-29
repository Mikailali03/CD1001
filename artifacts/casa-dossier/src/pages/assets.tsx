import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useProperty } from "@/contexts/property-context";
import { useListAssets, getListAssetsQueryKey, type Asset } from "@workspace/api-client-react";
import { Link, useSearch } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddAssetDialog } from "@/components/add-asset-dialog";
import {
  ShieldCheck,
  ChevronRight,
  Plus,
  Building2,
  Package,
} from "lucide-react";
import { calcScore, categoryConfig, gradeFromScore } from "@/lib/asset-scoring";

const CATEGORY_ORDER = ["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"];

function isUnderWarranty(warrantyExpiry?: string | null): boolean {
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
  const { t } = useTranslation();
  const score = calcScore(asset);
  const cfg = categoryConfig(asset.category);
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
                {t("assets.warranty")}
              </Badge>
            )}
            {asset.status === "needs_attention" && (
              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20 font-bold">
                {t("assets.needsAttention")}
              </Badge>
            )}
          </div>
          {(asset.brand || asset.model) && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {[asset.brand, asset.model].filter(Boolean).join(" · ")}
            </p>
          )}
          {asset.serialNumber && (
            <p className="text-xs text-muted-foreground/70 font-mono mt-0.5 truncate">
              {t("assets.serialNumber")}: {asset.serialNumber}
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
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const search = useSearch();

  useEffect(() => {
    if (search.includes("add=1")) setAddOpen(true);
  }, [search]);

  const { data: assets = [], isLoading: assetsLoading } = useListAssets(activePropertyId ?? "", undefined, {
    query: { queryKey: getListAssetsQueryKey(activePropertyId ?? ""), enabled: !!activePropertyId },
  });

  if (propLoading || (!!activePropertyId && assetsLoading)) return <AssetsSkeleton />;

  if (!activePropertyId || !activeProperty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="bg-secondary rounded-2xl p-6 mb-6">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto" />
        </div>
        <h2 className="text-xl font-semibold mb-2">{t("assets.noPropertyTitle")}</h2>
        <p className="text-muted-foreground max-w-sm mb-6 text-sm">
          {t("assets.noPropertyDesc")}
        </p>
        <Button asChild className="gap-2">
          <Link href="/properties"><Plus className="h-4 w-4" />{t("assets.addYourHome")}</Link>
        </Button>
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
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-7 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("assets.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{activeProperty.name}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          {t("assets.addAsset")}
        </Button>
      </div>

      {/* ── Summary pills ── */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1.5 text-xs font-medium">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
          {t("assets.trackedCount", { count: totalAssets })}
        </div>
        {underWarrantyCount > 0 && (
          <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 rounded-full px-3 py-1.5 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("assets.underWarrantyCount", { count: underWarrantyCount })}
          </div>
        )}
        {needsAttentionCount > 0 && (
          <div className="flex items-center gap-1.5 bg-destructive/10 text-destructive rounded-full px-3 py-1.5 text-xs font-medium">
            {t("assets.needsAttentionCount", { count: needsAttentionCount })}
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
            <p className="font-semibold text-sm">{t("assets.noAssetsTitle")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("assets.noAssetsDesc")}
            </p>
          </div>
          <Button size="sm" className="gap-1.5 mt-1" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            {t("assets.addAsset")}
          </Button>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => {
          const cfg = categoryConfig(category);
          return (
            <div key={category} className="space-y-3">
              {/* Category heading */}
              <div className="flex items-center gap-2">
                <span className="text-base select-none">{cfg.emoji}</span>
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                  {t(`assets.category.${category}`, { defaultValue: category })}
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

      <AddAssetDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        propertyId={activePropertyId}
      />
    </div>
  );
}
