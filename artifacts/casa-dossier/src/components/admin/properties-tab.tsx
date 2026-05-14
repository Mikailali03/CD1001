import { useState } from "react";
import { Search, Building2, MapPin, Calendar, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useListAdminProperties, getListAdminPropertiesQueryKey, type AdminProperty } from "@workspace/api-client-react";

function PropertyRow({ property }: { property: AdminProperty }) {
  const location = [property.city, property.state].filter(Boolean).join(", ");
  const added = new Date(property.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex items-start gap-4 py-3 px-4 rounded-lg hover:bg-muted/40 transition-colors">
      {/* Thumbnail */}
      <div className="h-12 w-16 rounded-md overflow-hidden shrink-0 bg-muted flex items-center justify-center border">
        {property.photoUrl ? (
          <img src={property.photoUrl} alt={property.name} className="h-full w-full object-cover" />
        ) : (
          <Building2 className="h-5 w-5 text-muted-foreground/50" />
        )}
      </div>

      {/* Main info */}
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
          {property.ownerEmail && !property.ownerName && (
            <span className="text-xs text-muted-foreground truncate">{property.ownerEmail}</span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
        <div className="flex items-center gap-2">
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
        </div>
        <span className="text-[11px] text-muted-foreground">Added {added}</span>
      </div>
    </div>
  );
}

export function PropertiesTab() {
  const [search, setSearch] = useState("");

  const { data: properties = [], isLoading } = useListAdminProperties(
    { search: search || undefined },
    { query: { queryKey: getListAdminPropertiesQueryKey({ search }) } },
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by address, name, or city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

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
