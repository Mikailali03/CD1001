import { useState } from "react";
import { useListProperties } from "@workspace/api-client-react";
import { AddPropertyDialog } from "@/components/add-property-dialog";
import { useSubscription } from "@/contexts/subscription-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Plus, BedDouble, Bath, Maximize, Calendar, Lock } from "lucide-react";
import { Link } from "wouter";
import { HealthScoreBadge, PropertyHealthModal } from "@/components/property-health-modal";

function useAddPropertyGate() {
  const { subscription, openUpgradeModal } = useSubscription();
  const { data: properties } = useListProperties();
  const count = properties?.length ?? 0;
  const limit = subscription?.propertyLimit ?? 1;
  const atLimit = count >= limit;

  function tryOpen(openDialog: () => void) {
    if (atLimit) {
      openUpgradeModal();
    } else {
      openDialog();
    }
  }

  return { atLimit, limit, count, tryOpen };
}

export default function Properties() {
  const { data: properties, isLoading } = useListProperties();
  const [addOpen, setAddOpen] = useState(false);
  const { atLimit, tryOpen } = useAddPropertyGate();
  const [healthModalId, setHealthModalId] = useState<string | null>(null);

  const activeHealthProperty = properties?.find((p) => p.id === healthModalId) ?? null;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">My Properties</h1>
          <p className="text-muted-foreground">Manage your homes and track their health.</p>
        </div>
        <Button
          className="shrink-0 gap-2"
          onClick={() => tryOpen(() => setAddOpen(true))}
        >
          {atLimit ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          Add Property
        </Button>
      </div>

      {properties && properties.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Link key={property.id} href={`/properties/${property.id}`}>
              <Card className="h-full flex flex-col hover:shadow-md cursor-pointer transition-shadow">
                {property.photoUrl ? (
                  <div className="h-40 w-full overflow-hidden rounded-t-xl bg-muted">
                    <img
                      src={property.photoUrl}
                      alt={property.name}
                      className="h-full w-full object-cover transition-transform hover:scale-105 duration-500"
                    />
                  </div>
                ) : (
                  <div className="h-40 w-full bg-gradient-to-br from-muted to-muted/60 rounded-t-xl flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}

                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-1">{property.name}</CardTitle>
                    <HealthScoreBadge
                      propertyId={property.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHealthModalId(property.id);
                      }}
                    />
                  </div>
                  <CardDescription className="flex items-center gap-1.5 text-xs line-clamp-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {[property.address, property.city, property.state].filter(Boolean).join(", ")}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 pb-3 space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {property.yearBuilt && (
                      <Badge variant="secondary" className="gap-1 font-normal text-xs">
                        <Calendar className="h-3 w-3" />
                        Built {property.yearBuilt}
                      </Badge>
                    )}
                    {property.sqft && (
                      <Badge variant="secondary" className="gap-1 font-normal text-xs">
                        <Maximize className="h-3 w-3" />
                        {property.sqft.toLocaleString()} sqft
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {property.bedrooms && (
                      <Badge variant="secondary" className="gap-1 font-normal text-xs">
                        <BedDouble className="h-3 w-3" />
                        {property.bedrooms} bd
                      </Badge>
                    )}
                    {property.bathrooms && (
                      <Badge variant="secondary" className="gap-1 font-normal text-xs">
                        <Bath className="h-3 w-3" />
                        {property.bathrooms} ba
                      </Badge>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t text-sm text-muted-foreground flex justify-between">
                  <span>View Details</span>
                  <span className="text-primary font-medium">&rarr;</span>
                </CardFooter>
              </Card>
            </Link>
          ))}

          {/* Add property card */}
          <button
            onClick={() => tryOpen(() => setAddOpen(true))}
            className={`h-full min-h-[260px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
              atLimit
                ? "border-amber-300/50 text-amber-600 hover:border-amber-400 hover:bg-amber-50/50"
                : "border-muted-foreground/20 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5"
            }`}
          >
            <div className={`rounded-full p-3 ${atLimit ? "bg-amber-100" : "bg-muted"}`}>
              {atLimit ? <Lock className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {atLimit ? "Upgrade to Add More" : "Add Another Property"}
              </p>
              <p className="text-xs opacity-60 mt-0.5">
                {atLimit ? "Your plan limit has been reached" : "AI-powered setup in minutes"}
              </p>
            </div>
          </button>
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground">No properties yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2 mb-6 text-sm">
            Add your home to get a personalized maintenance plan generated by AI in seconds.
          </p>
          <Button className="gap-2" onClick={() => tryOpen(() => setAddOpen(true))}>
            <Plus className="h-4 w-4" />
            Add Your First Home
          </Button>
        </div>
      )}

      <AddPropertyDialog
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {activeHealthProperty && (
        <PropertyHealthModal
          propertyId={activeHealthProperty.id}
          propertyName={activeHealthProperty.name}
          open={healthModalId === activeHealthProperty.id}
          onClose={() => setHealthModalId(null)}
        />
      )}
    </div>
  );
}
