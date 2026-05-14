import { Wrench, CheckCircle2, FileText, Phone, Hash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useListAdminTechnicians, getListAdminTechniciansQueryKey, type AdminTechnician } from "@workspace/api-client-react";

function TechnicianCard({ tech }: { tech: AdminTechnician }) {
  const displayName = `${tech.firstName} ${tech.lastName}`.trim() || "Unknown";
  const joined = new Date(tech.createdAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <Card className="hover-elevate transition-shadow">
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">
              {tech.firstName?.[0]?.toUpperCase() ?? "T"}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold">{displayName}</p>
              <Badge variant="outline" className="text-[10px] font-medium shrink-0">
                Joined {joined}
              </Badge>
            </div>

            {tech.email && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{tech.email}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-2">
              {tech.technicianNumber && (
                <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                  <Hash className="h-3 w-3" />
                  {tech.technicianNumber}
                </span>
              )}
              {tech.phone && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {tech.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-green-500/10">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            </div>
            <div>
              <p className="text-base font-bold leading-none">{tech.completedJobs}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Jobs Completed</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-blue-500/10">
              <FileText className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-base font-bold leading-none">{tech.totalServiceRecords}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Service Records</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TechniciansTab() {
  const { data: technicians = [], isLoading } = useListAdminTechnicians({
    query: { queryKey: getListAdminTechniciansQueryKey() },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Registered Technicians</h3>
          <p className="text-sm text-muted-foreground">
            All technicians on the platform with their job and service record stats.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {technicians.length} total
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : technicians.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Wrench className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No technicians registered yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {technicians.map((t) => (
            <TechnicianCard key={t.userId} tech={t} />
          ))}
        </div>
      )}
    </div>
  );
}
