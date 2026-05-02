import { useGetProperty, getGetPropertyQueryKey, useGetPropertySummary, useListAssets } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Building2, MapPin, Plus, ShieldCheck, ShieldAlert, AlertTriangle, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  
  const { data: property, isLoading: isPropertyLoading } = useGetProperty(id!, {
    query: { enabled: !!id, queryKey: getGetPropertyQueryKey(id!) }
  });
  
  const { data: summary, isLoading: isSummaryLoading } = useGetPropertySummary(id!, {
    query: { enabled: !!id, queryKey: getGetPropertyQueryKey(id!) } // Note: using property key as fallback since summary key generator has a bug in some Orval versions
  });

  const { data: assets, isLoading: isAssetsLoading } = useListAssets(id!, undefined, {
    query: { enabled: !!id, queryKey: ['assets', id!] }
  });

  if (isPropertyLoading || isSummaryLoading || isAssetsLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-24 mb-6" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[400px] rounded-xl lg:col-span-1" />
          <Skeleton className="h-[400px] rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!property) return <div className="p-6 text-center">Property not found</div>;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <ShieldCheck className="h-4 w-4 text-chart-1" />;
      case 'needs_attention': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: return <ShieldAlert className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified': return <Badge className="bg-chart-1/10 text-chart-1 hover:bg-chart-1/20 border-chart-1/20">Verified</Badge>;
      case 'needs_attention': return <Badge variant="destructive">Needs Attention</Badge>;
      default: return <Badge variant="secondary">Unverified</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <Link href="/properties" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Properties
      </Link>
      
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">{property.name}</h1>
          <p className="text-muted-foreground flex items-center gap-1.5 mt-1">
            <MapPin className="h-4 w-4" />
            {property.address}{property.city ? `, ${property.city}` : ''}{property.state ? `, ${property.state}` : ''}
          </p>
        </div>
        <Link href={`/intake?propertyId=${property.id}`}>
          <Button className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Quick Add Asset
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Summary */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            {property.photoUrl ? (
              <div className="h-48 w-full overflow-hidden rounded-t-xl">
                <img src={property.photoUrl} alt={property.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-32 w-full bg-muted/50 rounded-t-xl flex items-center justify-center">
                <Building2 className="h-10 w-10 text-muted-foreground/30" />
              </div>
            )}
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Health Score</span>
                    <span className="font-bold">{summary?.healthScore || 0}/100</span>
                  </div>
                  <Progress value={summary?.healthScore || 0} className="h-2" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Assets</p>
                    <p className="text-lg font-bold">{summary?.totalAssets || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Verified</p>
                    <p className="text-lg font-bold text-chart-1">{summary?.verifiedAssets || 0}</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Asset Breakdown</h4>
                  <div className="space-y-2">
                    {summary?.assetsByCategory && summary.assetsByCategory.map((cat, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{cat.category}</span>
                        <span className="font-medium">{cat.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Assets */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Inventory</CardTitle>
              <CardDescription>All tracked equipment and structural elements.</CardDescription>
            </CardHeader>
            <CardContent>
              {assets && assets.length > 0 ? (
                <div className="divide-y">
                  {assets.map(asset => (
                    <Link key={asset.id} href={`/properties/${property.id}/assets/${asset.id}`}>
                      <div className="flex items-center justify-between py-4 hover:bg-muted/50 -mx-6 px-6 cursor-pointer transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="bg-secondary p-2.5 rounded-lg group-hover:bg-background transition-colors">
                            {getStatusIcon(asset.status)}
                          </div>
                          <div>
                            <p className="font-medium">{asset.name}</p>
                            <p className="text-sm text-muted-foreground flex gap-2">
                              <span>{asset.category}</span>
                              {asset.brand && <span>• {asset.brand}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="hidden sm:block text-right">
                            {asset.installDate && (
                              <p className="text-xs text-muted-foreground">Installed: {format(new Date(asset.installDate), 'yyyy')}</p>
                            )}
                          </div>
                          {getStatusBadge(asset.status)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Wrench className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                  <h3 className="text-lg font-medium">No assets tracked yet</h3>
                  <p className="text-muted-foreground text-sm mt-1 mb-4">Start building your dossier by adding key home systems.</p>
                  <Link href={`/intake?propertyId=${property.id}`}>
                    <Button variant="outline" size="sm">Add First Asset</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
