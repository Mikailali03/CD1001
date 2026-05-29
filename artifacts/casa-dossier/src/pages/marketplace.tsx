import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useListMarketplaceJobs,
  useCreateMarketplaceJob,
  useListProperties,
  useListAssets,
  getListMarketplaceJobsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  UserSearch,
  MapPin,
  Wrench,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  TriangleAlert,
  Phone,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

// ── Service area check ────────────────────────────────────────────────────────
// CasaService currently serves the Atlanta metro within a 50-mile radius.
// We approximate this using state + the first 3 digits of the zip code.
// Valid prefixes: 300, 301, 302, 303 cover essentially all of metro Atlanta
// and its surrounding counties (Fulton, DeKalb, Cobb, Gwinnett, Clayton, etc.)
const ATLANTA_METRO_ZIP_PREFIXES = ["300", "301", "302", "303"];

function isInAtlantaServiceArea(property: {
  state?: string | null;
  zipCode?: string | null;
}): boolean {
  const state = property.state?.trim().toUpperCase();
  // If no state info, give benefit of the doubt
  if (!state) return true;
  if (state !== "GA" && state !== "GEORGIA") return false;
  const zip = property.zipCode?.trim() ?? "";
  // In GA but no zip — allow
  if (!zip) return true;
  return ATLANTA_METRO_ZIP_PREFIXES.includes(zip.slice(0, 3));
}

type PostJobDialogProps = {
  initialOpen?: boolean;
  initialPropertyId?: string;
  initialAssetId?: string;
  trigger?: React.ReactNode;
};

function PostJobDialog({ initialOpen = false, initialPropertyId = "", initialAssetId = "", trigger }: PostJobDialogProps) {
  const [open, setOpen] = useState(initialOpen);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [assetId, setAssetId] = useState(initialAssetId);
  const [urgency, setUrgency] = useState("medium");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const { t } = useTranslation();

  // If initial values arrive after mount (e.g. data race), sync them in
  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);

  useEffect(() => {
    if (initialPropertyId) setPropertyId(initialPropertyId);
  }, [initialPropertyId]);

  useEffect(() => {
    if (initialAssetId) setAssetId(initialAssetId);
  }, [initialAssetId]);

  const { data: properties } = useListProperties();
  const { data: assets } = useListAssets(propertyId, undefined, {
    query: { enabled: !!propertyId, queryKey: ["assets", propertyId] },
  });

  const queryClient = useQueryClient();
  const createJob = useCreateMarketplaceJob();
  const { toast } = useToast();

  function handleSubmit() {
    if (!assetId || !description.trim()) return;
    createJob.mutate(
      { data: { assetId, description, urgency: urgency as "low" | "medium" | "high" | "emergency", contactPhone: contactPhone.trim() || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMarketplaceJobsQueryKey() });
          toast({ title: t("marketplace.requestPosted"), description: t("marketplace.requestPostedDesc") });
          setOpen(false);
          setPropertyId("");
          setAssetId("");
          setDescription("");
          setUrgency("medium");
          setContactPhone("");
        },
        onError: () => {
          toast({ title: "Error", description: "Could not post your request. Please try again.", variant: "destructive" });
        },
      }
    );
  }

  // Find selected asset name for dialog subtitle
  const selectedAsset = assets?.find((a) => a.id === assetId);
  const selectedProperty = properties?.find((p) => p.id === propertyId);

  // Service area gate — checked whenever a property is selected
  const inServiceArea = selectedProperty ? isInAtlantaServiceArea(selectedProperty) : true;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="cursor-pointer">{trigger}</span>
      ) : (
        <Button className="gap-2" data-testid="button-post-job" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("marketplace.postRequest")}
        </Button>
      )}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("marketplace.postServiceRequest")}</DialogTitle>
          <DialogDescription>
            {selectedAsset
              ? `${t("marketplace.postRequest")}: ${selectedAsset.name}${selectedProperty ? ` — ${selectedProperty.name}` : ""}. ${t("marketplace.subtitle")}`
              : t("marketplace.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="property-select">Property</Label>
            <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); setAssetId(""); }}>
              <SelectTrigger id="property-select" data-testid="select-property" className="h-auto min-h-10 whitespace-normal [&>span]:whitespace-normal [&>span]:break-words [&>span]:text-left">
                <SelectValue placeholder="Choose a property..." />
              </SelectTrigger>
              <SelectContent>
                {properties?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-select">Which item needs service?</Label>
            <Select value={assetId} onValueChange={setAssetId} disabled={!propertyId}>
              <SelectTrigger id="asset-select" data-testid="select-asset" className="h-auto min-h-10 whitespace-normal [&>span]:whitespace-normal [&>span]:break-words [&>span]:text-left">
                <SelectValue placeholder={propertyId ? "Choose an asset..." : "Select a property first"} />
              </SelectTrigger>
              <SelectContent>
                {assets?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} {a.brand ? `— ${a.brand}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="urgency-select">How urgent is this?</Label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger id="urgency-select" data-testid="select-urgency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Not urgent — just planning ahead</SelectItem>
                <SelectItem value="medium">Moderate — within the next few weeks</SelectItem>
                <SelectItem value="high">Soon — within the next few days</SelectItem>
                <SelectItem value="emergency">Emergency — needs immediate attention</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone-input">Your contact phone <span className="text-muted-foreground font-normal">(shown to the pro after they accept)</span></Label>
            <Input
              id="phone-input"
              type="tel"
              placeholder="e.g. (555) 123-4567"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description-input">Describe what's going on</Label>
            <Textarea
              id="description-input"
              data-testid="textarea-description"
              placeholder="e.g. My AC unit stopped cooling. It runs but only blows warm air."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={4}
            />
          </div>
        </div>

        {selectedProperty && !inServiceArea && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold">Outside our service area</p>
              <p className="text-xs mt-0.5 text-amber-700">
                CasaService currently serves the Atlanta metro area (within 50 miles of Atlanta, GA).
                We're not yet available at this property's location. We'll let you know when we expand!
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("marketplace.cancelRequest")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={!assetId || !description.trim() || createJob.isPending || !inServiceArea}
            data-testid="button-submit-job"
          >
            {createJob.isPending ? t("marketplace.submitting") : t("marketplace.postRequest")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const urgencyConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  emergency: { label: "Emergency", className: "border-l-destructive", icon: <AlertCircle className="h-3.5 w-3.5 text-destructive" /> },
  high:      { label: "High",      className: "border-l-orange-500",  icon: <AlertCircle className="h-3.5 w-3.5 text-orange-500" /> },
  medium:    { label: "Medium",    className: "border-l-chart-3",     icon: <Clock className="h-3.5 w-3.5 text-chart-3" /> },
  low:       { label: "Low",       className: "border-l-muted-foreground/30", icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" /> },
};

export default function Marketplace() {
  const { data: jobs, isLoading } = useListMarketplaceJobs();
  const { t } = useTranslation();

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline"; className?: string }> = {
    open:      { label: t("marketplace.awaitingPro"), variant: "secondary" },
    claimed:   { label: t("marketplace.proAssigned"), variant: "default" },
    en_route:  { label: t("marketplace.onTheWay"),   variant: "default",  className: "bg-blue-500 hover:bg-blue-500 text-white" },
    arrived:   { label: t("marketplace.arrived"),    variant: "default",  className: "bg-emerald-500 hover:bg-emerald-500 text-white" },
    completed: { label: t("marketplace.completed"),  variant: "outline" },
  };

  // Read pre-fill params from URL (e.g. ?propertyId=X&assetId=Y)
  const params = new URLSearchParams(window.location.search);
  const prePropertyId = params.get("propertyId") ?? "";
  const preAssetId = params.get("assetId") ?? "";
  const hasPreFill = !!preAssetId;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">{t("marketplace.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("marketplace.subtitle")}
          </p>
        </div>
        <PostJobDialog
          initialOpen={hasPreFill}
          initialPropertyId={prePropertyId}
          initialAssetId={preAssetId}
        />
      </div>

      {jobs && jobs.length > 0 ? (
        <div className="space-y-4">
          {jobs.map((job) => {
            const urgency = urgencyConfig[job.urgency ?? "medium"] ?? urgencyConfig.medium;
            const status = statusConfig[job.status ?? "open"] ?? statusConfig.open;

            return (
              <Card
                key={job.id}
                data-testid={`card-job-${job.id}`}
                className={`border-l-4 ${urgency.className} hover-elevate transition-all`}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={status.variant} className={status.className}>{status.label}</Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {urgency.icon}
                        {urgency.label} {t("marketplace.priority")}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t("marketplace.posted")} {format(new Date(job.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed">{job.description}</p>

                  <div className="bg-muted/40 rounded-lg p-3.5 border border-dashed flex gap-4 items-start">
                    <div className="bg-background p-2 rounded-md shadow-sm shrink-0">
                      <Wrench className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                        {t("marketplace.assetOnFile")}
                      </p>
                      <p className="font-medium text-sm">{job.assetName}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {[job.assetBrand, job.assetModel, job.assetSerialNumber && `S/N ${job.assetSerialNumber}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {(job.city || job.state) && (
                      <div className="ml-auto shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[job.city, job.state].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>

                  {(job.status === "claimed" || (job.status as string) === "en_route" || (job.status as string) === "arrived") && (
                    <div className="rounded-lg border border-dashed bg-muted/30 p-3.5 space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("marketplace.assignedPro")}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                        <span className="font-medium text-foreground">{job.technicianName ?? "Pro assigned"}</span>
                        {job.technicianPhone ? (
                          <a
                            href={`tel:${job.technicianPhone}`}
                            className="flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                          >
                            <Phone className="h-3 w-3" />
                            {job.technicianPhone}
                          </a>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {job.scheduledAt ? (
                          <span className="font-medium text-foreground">
                            {t("marketplace.serviceScheduledFor")} {format(new Date(job.scheduledAt), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                          </span>
                        ) : (
                          <span className="italic">{t("marketplace.serviceDatePending")}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {job.status === "completed" && (
                    <div className="flex items-center gap-2 text-sm text-chart-1 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      {t("marketplace.serviceComplete")}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-24 bg-muted/30 rounded-xl border border-dashed">
          <UserSearch className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">{t("marketplace.noRequestsTitle")}</h3>
          <p className="text-muted-foreground max-w-xs mx-auto mt-2 text-sm">
            {t("marketplace.noRequestsDesc")}
          </p>
          <div className="mt-6">
            <PostJobDialog />
          </div>
        </div>
      )}

      <div className="rounded-xl bg-accent/50 border border-accent p-5 flex gap-4">
        <FileText className="h-5 w-5 text-accent-foreground shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-sm text-accent-foreground">{t("marketplace.whyDataMatters")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("marketplace.whyDataMattersDesc")}
          </p>
        </div>
      </div>
    </div>
  );
}
