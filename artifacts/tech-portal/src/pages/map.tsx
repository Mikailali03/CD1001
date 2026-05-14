import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  useListOpenMarketplaceJobs,
  useGetMarketplaceJobDetails,
  useAcceptMarketplaceJob,
  useGetUserProfile,
  getGetUserProfileQueryKey,
  getGetMarketplaceJobDetailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertCircle,
  Clock,
  MapPin,
  Phone,
  Wrench,
  CheckCircle2,
  LogOut,
  User,
  Home,
  Calendar,
  DollarSign,
} from "lucide-react";

// Fix Leaflet default icon paths broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const urgencyConfig: Record<string, { label: string; color: string; textColor: string; icon: React.ReactNode }> = {
  emergency: { label: "Emergency", color: "bg-red-100 border-red-400", textColor: "text-red-700", icon: <AlertCircle className="h-3.5 w-3.5 text-red-600" /> },
  high:      { label: "High",      color: "bg-orange-100 border-orange-400", textColor: "text-orange-700", icon: <AlertCircle className="h-3.5 w-3.5 text-orange-500" /> },
  medium:    { label: "Medium",    color: "bg-yellow-50 border-yellow-300",  textColor: "text-yellow-700", icon: <Clock className="h-3.5 w-3.5 text-yellow-600" /> },
  low:       { label: "Low",       color: "bg-gray-50 border-gray-200",      textColor: "text-gray-600",   icon: <Clock className="h-3.5 w-3.5 text-gray-400" /> },
};

function urgencyMarkerColor(urgency: string): string {
  const map: Record<string, string> = {
    emergency: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#6b7280",
  };
  return map[urgency] ?? "#6b7280";
}

function createUrgencyIcon(urgency: string) {
  const color = urgencyMarkerColor(urgency);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="7" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
    className: "",
  });
}

export default function MapPage() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { data: jobs = [], isLoading: jobsLoading } = useListOpenMarketplaceJobs();
  const { data: profile } = useGetUserProfile({ query: { queryKey: getGetUserProfileQueryKey(), retry: false } });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: jobDetail, isLoading: detailLoading } = useGetMarketplaceJobDetails(
    selectedJobId ?? "",
    { query: { queryKey: getGetMarketplaceJobDetailsQueryKey(selectedJobId ?? ""), enabled: !!selectedJobId } }
  );

  const acceptMutation = useAcceptMarketplaceJob({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["listOpenMarketplaceJobs"] });
        toast({
          title: "Job accepted!",
          description: `Contact the homeowner at ${(data as any).contactPhone ?? "the number below"}.`,
        });
      },
      onError: () => {
        toast({ title: "Could not accept job", description: "It may have already been claimed.", variant: "destructive" });
      },
    },
  });

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { center: [39.5, -98.35], zoom: 4 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const validJobs = jobs.filter((j) => j.latitude != null && j.longitude != null);

    if (validJobs.length > 0) {
      const bounds = L.latLngBounds(validJobs.map((j) => [j.latitude!, j.longitude!] as [number, number]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
    }

    validJobs.forEach((job) => {
      const marker = L.marker([job.latitude!, job.longitude!], {
        icon: createUrgencyIcon(job.urgency),
      });
      marker.addTo(map);
      marker.on("click", () => {
        setSelectedJobId(job.id);
        setSheetOpen(true);
      });
      marker.bindTooltip(job.assetCategory ?? job.description.slice(0, 40), { direction: "top", offset: [0, -30] });
      markersRef.current.set(job.id, marker);
    });
  }, [jobs]);

  function handleJobClick(jobId: string) {
    setSelectedJobId(jobId);
    setSheetOpen(true);
    const marker = markersRef.current.get(jobId);
    if (marker && mapInstanceRef.current) {
      mapInstanceRef.current.setView(marker.getLatLng(), 13, { animate: true });
    }
  }

  const isAccepted = jobDetail && (jobDetail as any).status === "claimed" && (jobDetail as any).technicianId;
  const isMine = isAccepted && (jobDetail as any).technicianId === (profile as any)?.userId;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-3 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">CS</span>
          </div>
          <span className="text-sidebar-foreground font-semibold text-sm">CasaService</span>
          <span className="text-sidebar-foreground/40 text-xs font-normal">Technician Portal</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {profile && (
            <span className="text-xs text-sidebar-foreground/60 font-mono hidden sm:block">
              {(profile as any).technicianNumber}
            </span>
          )}
          <Link href="/profile">
            <Button size="sm" variant="ghost" className="text-sidebar-foreground hover:bg-sidebar-accent h-8 gap-1.5">
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">{user?.firstName ?? "Profile"}</span>
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="text-sidebar-foreground hover:bg-sidebar-accent h-8 gap-1.5"
            onClick={() => signOut()}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar job list */}
        <aside className="w-80 shrink-0 bg-card border-r border-border flex flex-col overflow-hidden hidden sm:flex">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">
              Open Jobs
              {!jobsLoading && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {jobs.length} {jobs.length === 1 ? "request" : "requests"}
                </span>
              )}
            </h2>
          </div>
          <ScrollArea className="flex-1">
            {jobsLoading ? (
              <div className="p-3 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No open jobs right now.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Check back soon!</p>
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {jobs.map((job) => {
                  const uc = urgencyConfig[job.urgency] ?? urgencyConfig.medium;
                  return (
                    <button
                      key={job.id}
                      onClick={() => handleJobClick(job.id)}
                      className={`w-full text-left p-3 rounded-lg border-l-2 bg-background hover:bg-accent/60 transition-colors cursor-pointer ${selectedJobId === job.id ? "ring-1 ring-primary" : ""} ${uc.color}`}
                    >
                      <div className="flex items-start gap-2 mb-1.5">
                        {uc.icon}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {job.assetCategory ?? "General Service"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{job.city ?? "Location pending"}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${uc.textColor}`}>
                          {uc.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 ml-5">{job.description}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </aside>

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="absolute inset-0" />
          {jobs.filter((j) => j.latitude == null).length > 0 && (
            <div className="absolute bottom-4 right-4 bg-card border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground shadow-sm z-10">
              {jobs.filter((j) => j.latitude == null).length} job(s) have no location data
            </div>
          )}
        </div>
      </div>

      {/* Job detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:w-[420px] overflow-y-auto p-0">
          {detailLoading || !jobDetail ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
                <div className="flex items-center gap-2 mb-1">
                  {(() => {
                    const uc = urgencyConfig[(jobDetail as any).urgency] ?? urgencyConfig.medium;
                    return (
                      <Badge variant="outline" className={`${uc.textColor} text-xs`}>
                        {uc.icon} <span className="ml-1">{uc.label}</span>
                      </Badge>
                    );
                  })()}
                  <Badge variant="secondary" className="text-xs capitalize">{(jobDetail as any).status}</Badge>
                </div>
                <SheetTitle className="text-base leading-tight">{(jobDetail as any).assetName ?? "Service Request"}</SheetTitle>
                <SheetDescription className="text-sm">{(jobDetail as any).description}</SheetDescription>
              </SheetHeader>

              <div className="px-6 py-4 space-y-4">
                {/* Asset info */}
                {(jobDetail as any).assetCategory && (
                  <div className="flex items-start gap-3 text-sm">
                    <Wrench className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">{(jobDetail as any).assetName}</p>
                      <p className="text-muted-foreground text-xs">
                        {[(jobDetail as any).assetBrand, (jobDetail as any).assetModel, (jobDetail as any).assetCategory]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {(jobDetail as any).assetInstallYear && (
                        <p className="text-muted-foreground text-xs">Installed {(jobDetail as any).assetInstallYear}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Location */}
                {(jobDetail as any).city && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">
                        {isMine && (jobDetail as any).propertyAddress
                          ? (jobDetail as any).propertyAddress
                          : `${(jobDetail as any).city}, ${(jobDetail as any).state ?? ""}`}
                      </p>
                      {!isMine && <p className="text-xs text-muted-foreground">Full address revealed after accepting</p>}
                    </div>
                  </div>
                )}

                {/* Contact phone — only shown if accepted by this tech */}
                {isMine && (jobDetail as any).contactPhone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={`tel:${(jobDetail as any).contactPhone}`} className="font-medium text-primary hover:underline">
                      {(jobDetail as any).contactPhone}
                    </a>
                  </div>
                )}

                {/* Property & home info */}
                {(jobDetail as any).propertyType && (
                  <div className="flex items-center gap-3 text-sm">
                    <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground capitalize">{(jobDetail as any).propertyType?.replace(/_/g, " ")}</span>
                  </div>
                )}

                {/* Service history */}
                {(jobDetail as any).recentServiceRecords && (jobDetail as any).recentServiceRecords.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service History</p>
                    <div className="space-y-2">
                      {(jobDetail as any).recentServiceRecords.slice(0, 3).map((r: any, i: number) => (
                        <div key={i} className="bg-muted/50 rounded-lg p-2.5 text-xs">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-medium text-foreground">{r.description}</span>
                            <span className="text-muted-foreground">{r.date?.slice(0, 10)}</span>
                          </div>
                          {r.companyName && <p className="text-muted-foreground">{r.companyName}</p>}
                          {r.cost && Number(r.cost) > 0 && (
                            <p className="text-foreground font-semibold mt-0.5">${Number(r.cost).toLocaleString()}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Budget estimate if available */}
                {(jobDetail as any).budgetCents && (
                  <div className="flex items-center gap-3 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground">Budget: ${((jobDetail as any).budgetCents / 100).toLocaleString()}</span>
                  </div>
                )}

                {/* Posted date */}
                {(jobDetail as any).createdAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">
                      Posted {new Date((jobDetail as any).createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Accept / Already accepted footer */}
              <div className="px-6 pb-6 pt-2 border-t border-border mt-2">
                {!profile?.role || profile.role !== "technician" ? (
                  <div className="text-center text-sm text-muted-foreground">
                    <p>Complete your <Link href="/profile" className="text-primary underline">technician profile</Link> to accept jobs.</p>
                  </div>
                ) : isMine ? (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">You've accepted this job</p>
                      {(jobDetail as any).contactPhone && (
                        <p className="text-xs mt-0.5">Call homeowner: {(jobDetail as any).contactPhone}</p>
                      )}
                    </div>
                  </div>
                ) : isAccepted ? (
                  <div className="text-sm text-muted-foreground bg-muted rounded-lg px-4 py-3 text-center">
                    This job has been claimed by another technician.
                  </div>
                ) : (
                  <Button
                    className="w-full gap-2"
                    disabled={acceptMutation.isPending}
                    onClick={() => acceptMutation.mutate({ jobId: selectedJobId! })}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {acceptMutation.isPending ? "Accepting..." : "Accept This Job"}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
