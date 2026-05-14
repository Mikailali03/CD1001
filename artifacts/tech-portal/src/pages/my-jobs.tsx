import { useState } from "react";
import {
  useListAssignedJobs,
  useGetMarketplaceJobDetails,
  useScheduleMarketplaceJob,
  useCompleteMarketplaceJob,
  getGetMarketplaceJobDetailsQueryKey,
  useGetUserProfile,
  getGetUserProfileQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Briefcase,
  ClipboardCheck,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";

const urgencyConfig: Record<string, { label: string; textColor: string; borderColor: string; icon: React.ReactNode }> = {
  emergency: { label: "Emergency", textColor: "text-red-700",    borderColor: "border-l-red-500",    icon: <AlertCircle className="h-3.5 w-3.5 text-red-600" /> },
  high:      { label: "High",      textColor: "text-orange-700", borderColor: "border-l-orange-500", icon: <AlertCircle className="h-3.5 w-3.5 text-orange-500" /> },
  medium:    { label: "Medium",    textColor: "text-yellow-700", borderColor: "border-l-yellow-400", icon: <Clock className="h-3.5 w-3.5 text-yellow-600" /> },
  low:       { label: "Low",       textColor: "text-gray-600",   borderColor: "border-l-gray-300",   icon: <Clock className="h-3.5 w-3.5 text-gray-400" /> },
};

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function MyJobsPage() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { data: profile } = useGetUserProfile({ query: { queryKey: getGetUserProfileQueryKey(), retry: false } });
  const { data: assignedJobs = [], isLoading } = useListAssignedJobs();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Schedule state
  const [schedulingValue, setSchedulingValue] = useState("");

  // Completion form state
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [workSummary, setWorkSummary] = useState("");
  const [costValue, setCostValue] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: jobDetail, isLoading: detailLoading, isError: detailError } = useGetMarketplaceJobDetails(
    selectedJobId ?? "",
    { query: { queryKey: getGetMarketplaceJobDetailsQueryKey(selectedJobId ?? ""), enabled: !!selectedJobId, retry: 1 } }
  );

  const scheduleMutation = useScheduleMarketplaceJob({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetMarketplaceJobDetailsQueryKey(selectedJobId ?? "") });
        queryClient.invalidateQueries({ queryKey: ["listAssignedJobs"] });
        const iso = (data as any)?.scheduledAt;
        const friendly = iso ? format(new Date(iso), "MMM d, yyyy 'at' h:mm a") : "confirmed";
        toast({ title: "Service date set", description: `Scheduled for ${friendly}.` });
      },
      onError: () => toast({ title: "Could not save schedule", variant: "destructive" }),
    },
  });

  const completeMutation = useCompleteMarketplaceJob({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["listAssignedJobs"] });
        queryClient.invalidateQueries({ queryKey: getGetMarketplaceJobDetailsQueryKey(selectedJobId ?? "") });
        toast({
          title: "Job marked complete",
          description: "A verified service record has been added to the homeowner's asset history.",
        });
        setSheetOpen(false);
        setShowCompletionForm(false);
        setWorkSummary("");
        setCostValue("");
        setNextServiceDate("");
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Could not complete job. Make sure a service date is set.";
        toast({ title: "Error", description: msg, variant: "destructive" });
      },
    },
  });

  function openJob(jobId: string) {
    setSelectedJobId(jobId);
    setSheetOpen(true);
    setShowCompletionForm(false);
    setWorkSummary("");
    setCostValue("");
    setNextServiceDate("");
    const job = assignedJobs.find((j) => j.id === jobId);
    setSchedulingValue(job?.scheduledAt ? toDatetimeLocal(job.scheduledAt as string) : "");
  }

  function handleSaveSchedule() {
    if (!selectedJobId || !schedulingValue) return;
    scheduleMutation.mutate({
      jobId: selectedJobId,
      data: { scheduledAt: new Date(schedulingValue).toISOString() },
    });
  }

  function handleComplete() {
    if (!selectedJobId || !workSummary.trim()) return;
    completeMutation.mutate({
      jobId: selectedJobId,
      data: {
        workSummary: workSummary.trim(),
        cost: costValue ? parseFloat(costValue) : undefined,
        nextServiceDate: nextServiceDate || undefined,
      },
    });
  }

  const jobHasSchedule = !!(jobDetail as any)?.scheduledAt;

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
        <nav className="flex items-center gap-1 ml-4">
          <Link href="/map">
            <Button size="sm" variant="ghost" className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 text-xs">
              Open Jobs
            </Button>
          </Link>
          <Button size="sm" variant="ghost" className="text-sidebar-foreground bg-sidebar-accent h-8 text-xs font-semibold">
            My Jobs
          </Button>
        </nav>
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

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">My Assigned Jobs</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Jobs you've claimed — set service dates and log completion to update the homeowner's report.</p>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
              </div>
            ) : assignedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-xl bg-muted/30">
                <Briefcase className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">No jobs assigned yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  When you accept a job from the map, it will appear here.
                </p>
                <Link href="/map">
                  <Button size="sm" variant="outline" className="mt-4">Browse Open Jobs</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedJobs.map((job) => {
                  const uc = urgencyConfig[(job as any).urgency] ?? urgencyConfig.medium;
                  const hasSchedule = !!(job as any).scheduledAt;
                  return (
                    <button
                      key={job.id}
                      onClick={() => openJob(job.id)}
                      className={`w-full text-left rounded-xl border border-l-4 ${uc.borderColor} bg-card hover:shadow-md hover:-translate-y-0.5 transition-all p-4 space-y-3`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          {uc.icon}
                          <span className="text-xs font-semibold text-foreground truncate">{(job as any).assetName}</span>
                          {(job as any).assetBrand && (
                            <span className="text-xs text-muted-foreground truncate">— {(job as any).assetBrand}</span>
                          )}
                        </div>
                        {hasSchedule ? (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date((job as any).scheduledAt!), "MMM d")}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">
                            Schedule needed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{(job as any).description}</p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[(job as any).propertyAddress, (job as any).propertyCity, (job as any).propertyState]
                            .filter(Boolean).join(", ")}
                        </span>
                        {(job as any).contactPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {(job as any).contactPhone}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Job detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) setShowCompletionForm(false); }}>
        <SheetContent side="right" className="w-full sm:w-[460px] overflow-y-auto p-0">
          {detailError ? (
            <div className="p-6 flex flex-col items-center justify-center gap-3 text-center h-full">
              <AlertCircle className="h-8 w-8 text-destructive/60" />
              <p className="text-sm font-medium">Could not load job details</p>
              <p className="text-xs text-muted-foreground">Please try again or contact support.</p>
            </div>
          ) : detailLoading || !jobDetail ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
                {(() => {
                  const uc = urgencyConfig[(jobDetail as any).urgency] ?? urgencyConfig.medium;
                  return (
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`${uc.textColor} text-xs`}>
                        {uc.icon}<span className="ml-1">{uc.label}</span>
                      </Badge>
                      <Badge variant="secondary" className="text-xs">Assigned to you</Badge>
                    </div>
                  );
                })()}
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
                          .filter(Boolean).join(" · ")}
                      </p>
                      {(jobDetail as any).assetSerialNumber && (
                        <p className="text-muted-foreground text-xs">S/N: {(jobDetail as any).assetSerialNumber}</p>
                      )}
                      {(jobDetail as any).assetInstallDate && (
                        <p className="text-muted-foreground text-xs">Installed: {(jobDetail as any).assetInstallDate}</p>
                      )}
                      {(jobDetail as any).assetWarrantyExpiry && (
                        <p className="text-muted-foreground text-xs">Warranty expires: {(jobDetail as any).assetWarrantyExpiry}</p>
                      )}
                      {(jobDetail as any).assetNotes && (
                        <p className="text-muted-foreground text-xs mt-1 italic">{(jobDetail as any).assetNotes}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Full address */}
                {(jobDetail as any).propertyAddress && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">{(jobDetail as any).propertyAddress}</p>
                      <p className="text-xs text-muted-foreground">
                        {[(jobDetail as any).propertyCity, (jobDetail as any).propertyState, (jobDetail as any).propertyZipCode]
                          .filter(Boolean).join(", ")}
                      </p>
                      {(jobDetail as any).propertyYearBuilt && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Home className="h-3 w-3" />Built {(jobDetail as any).propertyYearBuilt}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Contact phone */}
                {(jobDetail as any).contactPhone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Homeowner contact</p>
                      <a href={`tel:${(jobDetail as any).contactPhone}`} className="font-semibold text-primary hover:underline">
                        {(jobDetail as any).contactPhone}
                      </a>
                    </div>
                  </div>
                )}

                {/* Service history */}
                {(jobDetail as any).serviceHistory?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service History</p>
                    <div className="space-y-2">
                      {(jobDetail as any).serviceHistory.slice(0, 4).map((r: any, i: number) => (
                        <div key={i} className="bg-muted/50 rounded-lg p-2.5 text-xs">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-medium text-foreground">{r.description}</span>
                            <span className="text-muted-foreground">{r.date?.slice(0, 10)}</span>
                          </div>
                          {r.companyName && <p className="text-muted-foreground">{r.companyName}</p>}
                          {r.cost && Number(r.cost) > 0 && (
                            <p className="font-semibold mt-0.5">${Number(r.cost).toLocaleString()}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(jobDetail as any).acceptedAt && (
                  <p className="text-xs text-muted-foreground">
                    Accepted {format(new Date((jobDetail as any).acceptedAt), "MMM d, yyyy")}
                  </p>
                )}
              </div>

              {/* ── Schedule section ── */}
              <div className="px-6 pb-4 pt-2 border-t border-border space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">Service Date &amp; Time</p>
                  <p className="text-xs text-muted-foreground">
                    {jobHasSchedule
                      ? `Scheduled: ${format(new Date((jobDetail as any).scheduledAt), "EEEE, MMM d, yyyy 'at' h:mm a")}`
                      : "Confirm with the homeowner, then enter the date below."}
                  </p>
                </div>
                <input
                  type="datetime-local"
                  value={schedulingValue}
                  onChange={(e) => setSchedulingValue(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button
                  variant={jobHasSchedule ? "outline" : "default"}
                  className="w-full gap-2"
                  disabled={!schedulingValue || scheduleMutation.isPending}
                  onClick={handleSaveSchedule}
                >
                  <Calendar className="h-4 w-4" />
                  {scheduleMutation.isPending ? "Saving…" : jobHasSchedule ? "Update Date" : "Set Service Date"}
                </Button>
              </div>

              {/* ── Completion section — only shown once a date is set ── */}
              {jobHasSchedule && (
                <div className="px-6 pb-6 pt-2 border-t border-border space-y-3">
                  {!showCompletionForm ? (
                    <Button
                      className="w-full gap-2"
                      onClick={() => setShowCompletionForm(true)}
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      Mark Job Complete
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-primary shrink-0" />
                        <p className="text-sm font-semibold text-foreground">Log Completed Work</p>
                      </div>
                      <p className="text-xs text-muted-foreground -mt-1">
                        This creates a verified service record in the homeowner's asset history and updates their home report.
                      </p>

                      <div className="space-y-1.5">
                        <Label htmlFor="work-summary" className="text-xs font-medium">
                          What was done <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                          id="work-summary"
                          placeholder="e.g. Replaced capacitor and recharged refrigerant. Unit cooling normally. Checked electrical connections — all secure."
                          value={workSummary}
                          onChange={(e) => setWorkSummary(e.target.value)}
                          className="resize-none text-sm"
                          rows={4}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="cost-input" className="text-xs font-medium flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Total cost charged
                          </Label>
                          <Input
                            id="cost-input"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={costValue}
                            onChange={(e) => setCostValue(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="next-service" className="text-xs font-medium flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Next service (optional)
                          </Label>
                          <Input
                            id="next-service"
                            type="date"
                            value={nextServiceDate}
                            onChange={(e) => setNextServiceDate(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setShowCompletionForm(false)}
                          disabled={completeMutation.isPending}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1 gap-2"
                          disabled={!workSummary.trim() || completeMutation.isPending}
                          onClick={handleComplete}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {completeMutation.isPending ? "Completing…" : "Submit & Complete"}
                        </Button>
                      </div>

                      <p className="text-[11px] text-muted-foreground text-center">
                        This action cannot be undone. The homeowner will see this entry on their home report.
      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
