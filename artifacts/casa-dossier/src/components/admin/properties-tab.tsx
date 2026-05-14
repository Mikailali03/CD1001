import { useState } from "react";
import { Search, Building2, MapPin, Calendar, Layers, RefreshCw, CheckCircle2, AlertCircle, Navigation } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useListAdminProperties,
  getListAdminPropertiesQueryKey,
  useBackfillProperties,
  type AdminProperty,
  type BackfillResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

function PropertyRow({ property }: { property: AdminProperty }) {
  const location = [property.city, property.state].filter(Boolean).join(", ");
  const added = new Date(property.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex items-start gap-4 py-3 px-4 rounded-lg hover:bg-muted/40 transition-colors">
      <div className="h-12 w-16 rounded-md overflow-hidden shrink-0 bg-muted flex items-center justify-center border">
        {property.photoUrl ? (
          <img src={property.photoUrl} alt={property.name} className="h-full w-full object-cover" />
        ) : (
          <Building2 className="h-5 w-5 text-muted-foreground/50" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{property.name || property.address}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{property.address}{location ? `, ${location}` : ""}</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          {property.ownerName && (
            <span className="text-xs text-muted-foreground">
              Owner: <span className="text-foreground font-medium">{property.ownerName}</span>
            </span>
          )}
          {property.ownerEmail && (
            <span className="text-xs text-muted-foreground truncate">{property.ownerEmail}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant="secondary" className="text-[10px] gap-1 px-1.5">
            <Layers className="h-2.5 w-2.5" />
            {property.assetCount} asset{property.assetCount !== 1 ? "s" : ""}
          </Badge>
          {property.yearBuilt && (
            <Badge variant="outline" className="text-[10px] gap-1 px-1.5">
              <Calendar className="h-2.5 w-2.5" />
              {property.yearBuilt}
            </Badge>
          )}
          {(property as any).latitude && (
            <Badge variant="outline" className="text-[10px] gap-1 px-1.5 text-green-600 border-green-200">
              <Navigation className="h-2.5 w-2.5" />
              Geocoded
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">Added {added}</span>
      </div>
    </div>
  );
}

function BackfillResultCard({ result }: { result: BackfillResult }) {
  const allGood = result.errors === 0;
  return (
    <Card className={`border ${allGood ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {allGood ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold mb-2">
              {allGood ? "Backfill completed successfully" : "Backfill completed with some issues"}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="font-medium">{result.total}</span>
                <span className="text-muted-foreground">total properties</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-medium text-blue-600">{result.ownerEmailUpdated}</span>
                <span className="text-muted-foreground">with owner email</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-medium text-green-600">{result.latLngUpdated}</span>
                <span className="text-muted-foreground">geocoded</span>
              </span>
              {result.errors > 0 && (
                <span className="flex items-center gap-1">
                  <span className="font-medium text-amber-600">{result.errors}</span>
                  <span className="text-muted-foreground">errors</span>
                </span>
              )}
            </div>
            {result.errors > 0 && (
              <div className="mt-3 space-y-1">
                {result.rows
                  .filter((r) => r.error)
                  .map((r) => (
                    <p key={r.id} className="text-[11px] text-amber-700">
                      <span className="font-medium">{r.address}:</span> {r.error}
                    </p>
                  ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PropertiesTab() {
  const [search, setSearch] = useState("");
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const queryClient = useQueryClient();

  const { data: properties = [], isLoading } = useListAdminProperties(
    { search: search || undefined },
    { query: { queryKey: getListAdminPropertiesQueryKey({ search }) } },
  );

  const { mutate: runBackfill, isPending: isBackfilling } = useBackfillProperties({
    mutation: {
      onSuccess: (data) => {
        setBackfillResult(data);
        queryClient.invalidateQueries({ queryKey: getListAdminPropertiesQueryKey({}) });
      },
    },
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by address, name, or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => runBackfill()}
          disabled={isBackfilling}
        >
          <RefreshCw className={`h-4 w-4 ${isBackfilling ? "animate-spin" : ""}`} />
          {isBackfilling ? "Running…" : "Backfill Data"}
        </Button>
      </div>

      {/* Backfill result */}
      {backfillResult && <BackfillResultCard result={backfillResult} />}

      {/* Property list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : properties.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No properties found.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50 p-2">
              {properties.map((p) => (
                <PropertyRow key={p.id} property={p} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-right">
        {properties.length} propert{properties.length !== 1 ? "ies" : "y"} shown
      </p>
    </div>
  );
}
