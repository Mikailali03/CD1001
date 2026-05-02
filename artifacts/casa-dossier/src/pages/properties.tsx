import { useListProperties } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Plus } from "lucide-react";
import { Link } from "wouter";

export default function Properties() {
  const { data: properties, isLoading } = useListProperties();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Properties</h1>
          <p className="text-muted-foreground">Manage your real estate portfolio and track asset health.</p>
        </div>
        <Button className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Add Property
        </Button>
      </div>

      {properties && properties.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map(property => (
            <Link key={property.id} href={`/properties/${property.id}`}>
              <Card className="h-full flex flex-col hover-elevate cursor-pointer transition-shadow">
                {property.photoUrl ? (
                  <div className="h-40 w-full overflow-hidden rounded-t-xl bg-muted">
                    <img 
                      src={property.photoUrl} 
                      alt={property.name} 
                      className="h-full w-full object-cover transition-transform hover:scale-105 duration-500"
                    />
                  </div>
                ) : (
                  <div className="h-40 w-full bg-muted/50 rounded-t-xl flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}
                
                <CardHeader>
                  <CardTitle className="line-clamp-1">{property.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5 text-xs line-clamp-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {property.address}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    {property.sqft && (
                      <Badge variant="secondary" className="font-normal">
                        {property.sqft.toLocaleString()} sqft
                      </Badge>
                    )}
                    {property.yearBuilt && (
                      <Badge variant="secondary" className="font-normal">
                        Built {property.yearBuilt}
                      </Badge>
                    )}
                  </div>
                </CardContent>
                
                <CardFooter className="pt-4 border-t text-sm text-muted-foreground flex justify-between">
                  <span>View Details</span>
                  <span className="text-primary font-medium">&rarr;</span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground">No properties found</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2 mb-6">
            Get started by adding your first property to begin tracking assets and maintenance.
          </p>
          <Button gap-2>
            <Plus className="h-4 w-4" />
            Add Your First Property
          </Button>
        </div>
      )}
    </div>
  );
}
