import { useState, useRef } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useGetProperty,
  getGetPropertyQueryKey,
  getListPropertiesQueryKey,
  useGetPropertySummary,
  getGetPropertySummaryQueryKey,
  useListAssets,
  getListAssetsQueryKey,
  useUpdateProperty,
  type Asset,
  type ListAssetsParams,
  type Property,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddAssetDialog } from "@/components/add-asset-dialog";
import { CollaboratorsPanel } from "@/components/collaborators-panel";
import { EditAssetSheet } from "@/components/edit-asset-sheet";
import { EditPropertySheet } from "@/components/edit-property-sheet";
import { PropertySummaryCard } from "@/components/property-detail/property-summary-card";
import { RetiredAssetsSection } from "@/components/property-detail/retired-assets-section";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode,
  Building2,
  MapPin,
  Plus,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowLeft,
  Ruler,
  BedDouble,
  Bath,
  DollarSign,
  Pencil,
} from "lucide-react";
import { format } from "@/lib/date";

const RETIRED_PARAMS: ListAssetsParams = { includeRetired: true };

const statusIcon = {
  verified:        <ShieldCheck className="h-4 w-4 text-chart-1" />,
  needs_attention: <AlertTriangle className="h-4 w-4 text-destructive" />,
  unverified:      <ShieldAlert className="h-4 w-4 text-muted-foreground" />,
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status === "verified") {
    return <Badge className="bg-chart-1/10 text-chart-1 border-chart-1/20 hover:bg-chart-1/20">{t("assetDetail.badges.verified")}</Badge>;
  }
  if (status === "needs_attention") return <Badge variant="destructive">{t("assetDetail.badges.needsAttention")}</Badge>;
  return <Badge variant="secondary">{t("assetDetail.badges.unverified")}</Badge>;
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [editPropertyOpen, setEditPropertyOpen] = useState(false);
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

  const { data: retiredAssets = [], refetch: refetchRetired } = useListAssets(id!, RETIRED_PARAMS, {
    query: {
      enabled: !!id,
      queryKey: getListAssetsQueryKey(id!, RETIRED_PARAMS),
      select: (all) => all.filter((a) => !!a.retiredAt),
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

  if (!property) return <div className="p-6 text-center text-muted-foreground">{t("propertyDetail.notFound")}</div>;

  // userId is on the row the server returns but not in the generated Property type.
  const isOwner = !!(user?.id && (property as Property & { userId?: string }).userId === user.id);

  const grouped = (assets ?? []).reduce<Record<string, typeof assets>>((acc, a) => {
    if (!acc[a!.category]) acc[a!.category] = [];
    acc[a!.category]!.push(a);
    return acc;
  }, {});

  function handleAssetCreated(assetId: string) {
    refetchAssets();
    refetchSummary();
    toast({ title: t("propertyDetail.toast.assetAdded"), description: t("propertyDetail.toast.assetAddedDesc") });
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
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
          toast({ title: t("propertyDetail.toast.renamed"), description: t("propertyDetail.toast.renamedDesc", { name: trimmed }) });
        },
        onError: () => toast({ title: t("propertyDetail.toast.renameFailed"), variant: "destructive" }),
        onSettled: () => setEditingName(false),
      }
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <Link href="/properties" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground gap-1.5 mb-2">
        <ArrowLeft className="h-4 w-4" />
        {t("propertyDetail.back")}
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          {editingName ? (
            <input
              aria-label={t("propertyDetail.homeName")}
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
                className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                title={t("propertyDetail.rename")}
                aria-label={t("propertyDetail.rename")}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="text-muted-foreground flex items-center gap-1.5 mt-1 text-sm">
            <MapPin className="h-3.5 w-3.5" />
            {[property.address, property.city, property.state].filter(Boolean).join(", ")}
          </p>
          {!!(property.bedrooms || property.bathrooms || property.sqft) && (
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              {!!property.bedrooms && (
                <span className="flex items-center gap-1">
                  <BedDouble className="h-3.5 w-3.5" />
                  {t("propertyDetail.bdShort", { count: property.bedrooms })}
                </span>
              )}
              {!!property.bathrooms && (
                <span className="flex items-center gap-1">
                  <Bath className="h-3.5 w-3.5" />
                  {t("propertyDetail.baShort", { count: Number(property.bathrooms) })}
                </span>
              )}
              {!!property.sqft && (
                <span className="flex items-center gap-1">
                  <Ruler className="h-3.5 w-3.5" />
                  {t("propertyDetail.sqft", { value: property.sqft.toLocaleString() })}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditPropertyOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            {t("propertyDetail.edit")}
          </Button>
          {id && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/properties/${id}/labels`}>
                <QrCode className="h-3.5 w-3.5" />
                {t("qr.printLabels")}
              </Link>
            </Button>
          )}
          {id && (
            <Button className="gap-2" onClick={() => setAddAssetOpen(true)} data-testid="button-add-asset">
              <Plus className="h-4 w-4" />
              {t("assets.addAsset")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — Property Summary */}
        <div className="space-y-4">
          <PropertySummaryCard property={property} summary={summary} />

          {/* Capital Outlook teaser */}
          {(assets ?? []).some((a) => a.replacementCost) && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2.5">
                  <DollarSign className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">{t("nav.capitalOutlook")}</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      {t("propertyDetail.capitalTeaser", { count: (assets ?? []).filter((a) => a.replacementCost).length })}
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
                <CardTitle className="text-sm font-medium">{t("propertyDetail.assetsByCategory")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary!.assetsByCategory!.map((cat) => (
                  <div key={cat.category} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{t(`assets.category.${cat.category}`, { defaultValue: cat.category })}</span>
                    <Badge variant="secondary" className="text-xs">{cat.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Collaborators */}
          {id && (
            <CollaboratorsPanel propertyId={id} isOwner={isOwner} />
          )}
        </div>

        {/* Right — Asset Inventory */}
        <div className="lg:col-span-2 space-y-4">
          {Object.keys(grouped).length > 0 ? (
            Object.entries(grouped).map(([category, categoryAssets]) => (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {t(`assets.category.${category}`, { defaultValue: category })}
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
                              {[asset!.brand, asset!.model].filter(Boolean).join(" · ") || t("propertyDetail.noSpecs")}
                            </p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {asset!.replacementCost && (
                            <span className="hidden sm:block text-xs text-muted-foreground font-medium">
                              ${Number(asset!.replacementCost).toLocaleString()}
                            </span>
                          )}
                          {asset!.installDate && (
                            <span className="hidden sm:block text-xs text-muted-foreground">
                              {format(new Date(asset!.installDate), "MMM yyyy")}
                            </span>
                          )}
                          <StatusBadge status={asset!.status} />
                          <button
                            onClick={(e) => { e.preventDefault(); setEditAsset(asset!); }}
                            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity ml-1 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                            title={t("propertyDetail.editAsset")}
                            aria-label={t("propertyDetail.editAssetNamed", { name: asset!.name })}
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
                <h3 className="font-semibold text-base mb-1">{t("assets.noAssetsTitle")}</h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-5">
                  {t("propertyDetail.emptyDesc")}
                </p>
                <Button className="gap-2" onClick={() => setAddAssetOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t("propertyDetail.addFirst")}
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
                <p className="text-sm font-medium">{t("propertyDetail.addAnother")}</p>
                <p className="text-xs opacity-60">{t("propertyDetail.addAnotherHint")}</p>
              </div>
            </button>
          )}

          {/* Retired Assets */}
          <RetiredAssetsSection
            retiredAssets={retiredAssets}
            propertyId={property.id}
            onEdit={setEditAsset}
          />
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
        asset={editAsset}
        open={!!editAsset}
        onOpenChange={(open) => { if (!open) setEditAsset(null); }}
        onSaved={() => { refetchAssets(); refetchRetired(); refetchSummary(); }}
      />

      <EditPropertySheet
        property={property}
        open={editPropertyOpen}
        onOpenChange={setEditPropertyOpen}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(id!) });
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        }}
      />
    </div>
  );
}
