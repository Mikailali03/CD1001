import { useState } from "react";
import {
  useGetProperty,
  getGetPropertyQueryKey,
  useGetPropertySummary,
  getGetPropertySummaryQueryKey,
  useListAssets,
  useCreateAsset,
  getListAssetsQueryKey,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { format } from "date-fns";

function AddAssetDialog({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("HVAC");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");

  const queryClient = useQueryClient();
  const createAsset = useCreateAsset();
  const { toast } = useToast();

  function handleSubmit() {
    if (!name.trim()) return;
    createAsset.mutate(
      {
        propertyId,
        data: { name, category: category as any, brand: brand || undefined, model: model || undefined, serialNumber: serialNumber || undefined },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey(propertyId) });
          queryClient.invalidateQueries({ queryKey: getGetPropertySummaryQueryKey(propertyId) });
          toast({ title: "Asset added", description: `${name} has been added to your dossier.` });
          setOpen(false);
          setName(""); setCategory("HVAC"); setBrand(""); setModel(""); setSerialNumber("");
        },
        onError: () => {
          toast({ title: "Error", description: "Could not add asset. Please try again.", variant: "destructive" });
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shrink-0 gap-2" data-testid="button-add-asset">
          <Plus className="h-4 w-4" />
          Add Asset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an Asset</DialogTitle>
          <DialogDescription>
            Log a home system or appliance to start tracking its service history and maintenance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="asset-name">What is it? <span className="text-destructive">*</span></Label>
            <Input
              id="asset-name"
              data-testid="input-asset-name"
              placeholder="e.g. Central Air Conditioner, Water Heater"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="asset-category" data-testid="select-asset-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="asset-brand">Brand / Make</Label>
              <Input id="asset-brand" data-testid="input-asset-brand" placeholder="e.g. Carrier" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-model">Model Number</Label>
              <Input id="asset-model" data-testid="input-asset-model" placeholder="Optional" value={model} onChange={(e) => setModel(e.target.value)} className="font-mono" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-serial">Serial Number</Label>
            <Input id="asset-serial" data-testid="input-asset-serial" placeholder="Optional — found on the unit's label" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="font-mono" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || createAsset.isPending} data-testid="button-submit-asset">
            {createAsset.isPending ? "Adding..." : "Add to Dossier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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

  const { data: property, isLoading: propertyLoading } = useGetProperty(id!, {
    query: { enabled: !!id, queryKey: getGetPropertyQueryKey(id!) },
  });
  const { data: summary, isLoading: summaryLoading } = useGetPropertySummary(id!, {
    query: { enabled: !!id, queryKey: getGetPropertySummaryQueryKey(id!) },
  });
  const { data: assets, isLoading: assetsLoading } = useListAssets(id!, undefined, {
    query: { enabled: !!id, queryKey: getListAssetsQueryKey(id!) },
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

  // Group assets by category
  const grouped = (assets ?? []).reduce<Record<string, typeof assets>>((acc, a) => {
    if (!acc[a!.category]) acc[a!.category] = [];
    acc[a!.category]!.push(a);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <Link href="/properties" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground gap-1.5 mb-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Properties
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">{property.name}</h1>
          <p className="text-muted-foreground flex items-center gap-1.5 mt-1 text-sm">
            <MapPin className="h-3.5 w-3.5" />
            {[property.address, property.city, property.state].filter(Boolean).join(", ")}
          </p>
        </div>
        {id && <AddAssetDialog propertyId={id} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — Property Summary Card */}
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

              {(property.yearBuilt || property.sqft) && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t text-sm">
                  {property.yearBuilt && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>Built {property.yearBuilt}</span>
                    </div>
                  )}
                  {property.sqft && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Ruler className="h-3.5 w-3.5" />
                      <span>{property.sqft.toLocaleString()} sqft</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

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
                      <Link key={asset!.id} href={`/properties/${property.id}/assets/${asset!.id}`}>
                        <div
                          data-testid={`asset-row-${asset!.id}`}
                          className="flex items-center justify-between py-3.5 -mx-6 px-6 hover:bg-muted/40 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-secondary p-2 rounded-lg group-hover:bg-background transition-colors shrink-0">
                              {statusIcon[asset!.status as keyof typeof statusIcon] ?? statusIcon.unverified}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{asset!.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {[asset!.brand, asset!.model].filter(Boolean).join(" · ") || "No specs on file"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {asset!.installDate && (
                              <span className="hidden sm:block text-xs text-muted-foreground">
                                {format(new Date(asset!.installDate), "yyyy")}
                              </span>
                            )}
                            {statusBadge[asset!.status as keyof typeof statusBadge] ?? statusBadge.unverified}
                          </div>
                        </div>
                      </Link>
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
                {id && <AddAssetDialog propertyId={id} />}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
