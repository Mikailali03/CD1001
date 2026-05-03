import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetProperty,
  getGetPropertyQueryKey,
  useGetPropertySummary,
  getGetPropertySummaryQueryKey,
  useListAssets,
  getListAssetsQueryKey,
  useUpdateProperty,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AddAssetDialog } from "@/components/add-asset-dialog";
import { EditAssetSheet } from "@/components/edit-asset-sheet";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  MapPin,
  Plus,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Ruler,
  BedDouble,
  Bath,
  DollarSign,
  Pencil,
  Archive,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

const statusIcon = {
  verified:        <ShieldCheck className="h-4 w-4 text-chart-1" />,
  needs_attention: <AlertTriangle className="h-4 w-4 text-destructive" />,
  unverified:      <ShieldAlert className="h-4 w-4 text-muted-foreground" />,
};

const statusBadge = {
  verified:        <Badge className="bg-chart-1/10 text-chart-1 border-chart-1/20 hover:bg-chart-1/20">Verified</Badge>,
  needs_attention: <Badge variant="destructive">Needs Attention</Badge>,
  unverified:      <Badge variant="secondary">Unverified</Badge>,
};

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<(typeof assets)[0] | null>(null);
  const [retiredOpen, setRetiredOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const updateProperty = useUpdateProperty();

  const { data: property, isLoading: propertyLoading } = useGetProperty(id!, {
    query: { enabled: !!id, queryKey: getGetPropertyQueryKey(id!) },
  });
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useGetPropertySummary(id!, {
    query: { enabled: !!id, queryKey: getGetPropertySummaryQueryKey(id!) },
  });
  const { data: assets, isLoading: assetsLoading, refetch: refetchAssets } = useListAssets(id!, undefined, {
    query: { enabled: !!id, queryKey: getListAssetsQueryKey(id!) },
  });

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: retiredAssets = [], refetch: refetchRetired } = useQuery<any[]>({
    queryKey: ["retired-assets", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/properties/${id}/assets?includeRetired=true`);
      const all = await res.json();
      return all.filter((a: any) => !!a.retiredAt);
    },
  });

  if (propertyLoading || summaryLoading || assetsLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!property) return <div className="p-6 text-center text-muted-foreground">Property not found.</div>;

  const healthScore = summary?.healthScore ?? 0;
  const healthColor = healthScore >= 80 ? "text-chart-1" : healthScore >= 50 ? "text-chart-3" : "text-destructive";

  const grouped = (assets ?? []).reduce<Record<string, typeof assets>>((acc, a) => {
    if (!acc[a!.category]) acc[a!.category] = [];
    acc[a!.category]!.push(a);
    return acc;
  }, {});

  function handleAssetCreated(assetId: string) {
    refetchAssets();
    refetchSummary();
    toast({ title: "Asset added", description: "Maintenance plan generated and added to your dossier." });
  }

  function startEditingName() {
    setNameValue(property?.name ?? "");
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  function commitNameEdit() {
    const trimmed = nameValue.trim();
    if (!trimmed || !id || trimmed === property?.name) {
      setEditingName(false);
      return;
    }
    updateProperty.mutate(
      { propertyId: id, data: { name: trimmed } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(id) });
          toast({ title: "Home renamed", description: `Now called "${trimmed}".` });
        },
        onError: () => toast({ title: "Could not save name", variant: "destructive" }),
        onSettled: () => setEditingName(false),
      }
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <Link href="/properties" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground gap-1.5 mb-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Properties
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
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
              className="text-3xl font-bold tracking-tight text-primary bg-transparent border-b-2 border-primary outline-none w-full max-w-lg"
              autoFocus
            />
          ) : (
            <div className="group flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-primary">{property.name}</h1>
              <button
                onClick={startEditingName}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Rename home"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="text-muted-foreground flex items-center gap-1.5 mt-1 text-sm">
            <MapPin className="h-3.5 w-3.5" />
            {[property.address, property.city, property.state].filter(Boolean).join(", ")}
          </p>
        </div>
        {id && (
          <Button className="shrink-0 gap-2" onClick={() => setAddAssetOpen(true)} data-testid="button-add-asset">
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — Property Summary */}
        <div className="space-y-4">
          <Card>
            {property.photoUrl ? (
              <div className="h-44 w-full overflow-hidden rounded-t-xl">
                <img src={property.photoUrl} alt={property.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-32 w-full bg-muted/50 rounded-t-xl flex items-center justify-center">
                <Building2 className="h-10 w-10 text-muted-foreground/20" />
              </div>
            )}
            <CardContent className="pt-5 space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium">Dossier Health</span>
                  <span className={`text-sm font-bold ${healthColor}`}>{healthScore}/100</span>
                </div>
                <Progress value={healthScore} className="h-2" />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {summary?.verifiedAssets ?? 0} of {summary?.totalAssets ?? 0} assets verified
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Overdue Tasks</p>
                  <p className={`text-xl font-bold ${(summary?.overdueTaskCount ?? 0) > 0 ? "text-destructive" : "text-chart-1"}`}>
                    {summary?.overdueTaskCount ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Assets</p>
                  <p className="text-xl font-bold">{summary?.totalAssets ?? 0}</p>
                </div>
              </div>

              {/* Property metadata */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t text-sm">
                {property.yearBuilt && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span>Built {property.yearBuilt}</span>
                  </div>
                )}
                {property.sqft && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Ruler className="h-3.5 w-3.5 shrink-0" />
                    <span>{property.sqft.toLocaleString()} sqft</span>
                  </div>
                )}
                {(property as any).bedrooms && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <BedDouble className="h-3.5 w-3.5 shrink-0" />
                    <span>{(property as any).bedrooms} bed</span>
                  </div>
                )}
                {(property as any).bathrooms && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Bath className="h-3.5 w-3.5 shrink-0" />
                    <span>{(property as any).bathrooms} bath</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Capital Outlook teaser */}
          {(assets ?? []).some((a) => (a as any).replacementCost) && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2.5">
                  <DollarSign className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Capital Outlook</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      Est. replacement costs tracked for {(assets ?? []).filter((a) => (a as any).replacementCost).length} assets.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category breakdown */}
          {(summary?.assetsByCategory?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Assets by Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary!.assetsByCategory!.map((cat) => (
                  <div key={cat.category} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{cat.category}</span>
                    <Badge variant="secondary" className="text-xs">{cat.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right — Asset Inventory */}
        <div className="lg:col-span-2 space-y-4">
          {Object.keys(grouped).length > 0 ? (
            Object.entries(grouped).map(([category, categoryAssets]) => (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="divide-y">
                    {categoryAssets!.map((asset) => (
                      <div key={asset!.id} className="flex items-center justify-between py-3.5 -mx-6 px-6 hover:bg-muted/40 transition-colors group">
                        <Link href={`/properties/${property.id}/assets/${asset!.id}`} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                          <div className="bg-secondary p-2 rounded-lg group-hover:bg-background transition-colors shrink-0">
                            {statusIcon[asset!.status as keyof typeof statusIcon] ?? statusIcon.unverified}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{asset!.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[asset!.brand, asset!.model].filter(Boolean).join(" · ") || "No specs on file"}
                            </p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {(asset as any).replacementCost && (
                            <span className="hidden sm:block text-xs text-muted-foreground font-medium">
                              ${Number((asset as any).replacementCost).toLocaleString()}
                            </span>
                          )}
                          {asset!.installDate && (
                            <span className="hidden sm:block text-xs text-muted-foreground">
                              {format(new Date(asset!.installDate), "MMM yyyy")}
                            </span>
                          )}
                          {statusBadge[asset!.status as keyof typeof statusBadge] ?? statusBadge.unverified}
                          <button
                            onClick={(e) => { e.preventDefault(); setEditAsset(asset!); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Edit asset"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-base mb-1">No assets tracked yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-5">
                  Start your dossier by adding your home's major systems — HVAC, water heater, roof, and more.
                </p>
                <Button className="gap-2" onClick={() => setAddAssetOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Your First Asset
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Add asset card at bottom */}
          {Object.keys(grouped).length > 0 && (
            <button
              onClick={() => setAddAssetOpen(true)}
              className="w-full rounded-xl border-2 border-dashed border-muted-foreground/20 py-5 flex items-center justify-center gap-2.5 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
            >
              <div className="bg-muted rounded-full p-1.5">
                <Plus className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Add Another Asset</p>
                <p className="text-xs opacity-60">AI Lens auto-fills from a photo</p>
              </div>
            </button>
          )}

          {/* Retired Assets */}
          {retiredAssets.length > 0 && (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 overflow-hidden">
              <button
                onClick={() => setRetiredOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-amber-600" />
                  Retired Assets
                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-amber-200 ml-1">
                    {retiredAssets.length}
                  </Badge>
                </span>
                {retiredOpen
                  ? <ChevronDown className="h-4 w-4 text-amber-600" />
                  : <ChevronRight className="h-4 w-4 text-amber-600" />
                }
              </button>
              {retiredOpen && (
                <div className="divide-y divide-amber-200/50 border-t border-amber-200">
                  {retiredAssets.map((asset: any) => (
                    <div key={asset.id} className="flex items-center justify-between py-3 px-4 hover:bg-amber-100/30 transition-colors group">
                      <Link href={`/properties/${property!.id}/assets/${asset.id}`} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                        <div className="bg-amber-100 p-2 rounded-lg shrink-0">
                          <Archive className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate text-amber-900">{asset.name}</p>
                          <p className="text-xs text-amber-600 truncate">
                            {[asset.brand, asset.model].filter(Boolean).join(" · ") || asset.category}
                            {asset.retiredAt && ` · Retired ${format(new Date(asset.retiredAt), "MMM yyyy")}`}
                          </p>
                        </div>
                      </Link>
                      <button
                        onClick={() => setEditAsset(asset)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-amber-200/50 text-amber-600 hover:text-amber-800"
                        title="Edit / Restore asset"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {id && (
        <AddAssetDialog
          propertyId={id}
          open={addAssetOpen}
          onOpenChange={setAddAssetOpen}
          onCreated={handleAssetCreated}
        />
      )}

      <EditAssetSheet
        asset={editAsset as any}
        open={!!editAsset}
        onOpenChange={(open) => { if (!open) setEditAsset(null); }}
        onSaved={() => { refetchAssets(); refetchRetired(); refetchSummary(); }}
      />
    </div>
  );
}
