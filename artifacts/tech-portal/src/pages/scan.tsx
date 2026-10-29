import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { useAuth, useUser } from "@clerk/react";
import { Link, useSearch } from "wouter";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Calendar,
  Camera,
  CameraOff,
  ClipboardList,
  LogOut,
  MapPin,
  Phone,
  QrCode,
  RotateCcw,
  Search,
  User,
  Wrench,
} from "lucide-react";

// ── Types (GET /api/tech/assets/:ref) ─────────────────────────────────────────
type MyJob = {
  id: string;
  description: string;
  urgency: string;
  status: string;
  scheduledAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  contactPhone: string | null;
};
type OpenJob = {
  id: string;
  description: string;
  urgency: string;
  status: string;
  assetName: string;
  assetCategory: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  createdAt: string;
};
type ServiceRecord = {
  id: string;
  date: string;
  description: string;
  companyName: string | null;
  technicianName: string | null;
  cost: string | null;
  nextServiceDate: string | null;
  verified: boolean;
};
type ScanResult = {
  assetId: string;
  registryId: string;
  category: string;
  hasActiveJob: boolean;
  myJobs: MyJob[];
  openJobs: OpenJob[];
  asset: {
    id: string;
    name: string;
    category: string;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    installDate: string | null;
    warrantyExpiry: string | null;
    notes: string | null;
    retiredAt: string | null;
  } | null;
  serviceHistory: ServiceRecord[] | null;
};

type CameraState = "idle" | "starting" | "scanning" | "denied" | "unavailable" | "error";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  claimed: "Assigned to you",
  en_route: "On the way",
  arrived: "Arrived",
  completed: "Completed",
};

/**
 * Narrows whatever the camera or the user produced to a path-safe reference
 * for the API. Label URLs (…/a/<uuid>) are reduced to the UUID here; the
 * server also understands bare UUIDs, registry IDs and CDA|uuid|registry.
 */
function toAssetRef(raw: string): string {
  const input = raw.trim();
  const fromUrl = input.match(/\/a\/([0-9a-f-]{36})(?:[/?#]|$)/i);
  if (fromUrl) return fromUrl[1];
  return input;
}

function ScanHeader() {
  const { signOut } = useAuth();
  const { user } = useUser();
  return (
    <header className="h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-3 shrink-0 z-10">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-xs">CS</span>
        </div>
        <span className="text-sidebar-foreground font-semibold text-sm hidden sm:inline">CasaService</span>
        <span className="text-sidebar-foreground/40 text-xs font-normal hidden md:inline">Technician Portal</span>
      </div>
      <nav className="flex items-center gap-1 ml-2 sm:ml-4">
        <Link href="/map">
          <Button size="sm" variant="ghost" className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 text-xs">
            Open Jobs
          </Button>
        </Link>
        <Link href="/my-jobs">
          <Button size="sm" variant="ghost" className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 text-xs">
            My Jobs
          </Button>
        </Link>
        <Button size="sm" variant="ghost" className="text-sidebar-foreground bg-sidebar-accent h-8 text-xs font-semibold">
          Scan
        </Button>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Link href="/profile">
          <Button size="sm" variant="ghost" className="text-sidebar-foreground hover:bg-sidebar-accent h-8 gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">{user?.firstName ?? "Profile"}</span>
          </Button>
        </Link>
        <Button size="sm" variant="ghost" className="text-sidebar-foreground hover:bg-sidebar-accent h-8 gap-1.5" onClick={() => signOut()}>
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}

export default function ScanPage() {
  const { getToken } = useAuth();
  const search = useSearch();
  const initialCode = new URLSearchParams(search).get("code");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [camera, setCamera] = useState<CameraState>("idle");
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCamera((c) => (c === "scanning" || c === "starting" ? "idle" : c));
  }, []);

  const lookup = useCallback(async (raw: string) => {
    const ref = toAssetRef(raw);
    if (!ref) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/tech/assets/${encodeURIComponent(ref)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          body?.error ??
            (res.status === 404 ? "No asset matches that code." : res.status === 403 ? "Technician access required." : "Lookup failed. Please try again."),
        );
        return;
      }
      setResult(body as ScanResult);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const startCamera = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      // No camera API at all (old browser, or a non-HTTPS page).
      setCamera("unavailable");
      return;
    }
    if (!videoRef.current) return;
    setCamera("starting");
    try {
      const reader = new BrowserQRCodeReader();
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (res, _err, controls) => {
          if (res) {
            controls.stop();
            controlsRef.current = null;
            setCamera("idle");
            void lookup(res.getText());
          }
        },
      );
      setCamera("scanning");
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "SecurityError") setCamera("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") setCamera("unavailable");
      else setCamera("error");
    }
  }, [lookup]);

  // Arriving from the web app's /a/:assetId page.
  useEffect(() => {
    if (initialCode) void lookup(initialCode);
  }, [initialCode, lookup]);

  // Always release the camera when leaving the page.
  useEffect(() => () => controlsRef.current?.stop(), []);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manual.trim()) return;
    stopCamera();
    void lookup(manual);
  }

  function reset() {
    setResult(null);
    setError(null);
    setManual("");
  }

  const cameraMessage: Record<Exclude<CameraState, "idle" | "starting" | "scanning">, string> = {
    denied: "Camera access was blocked. Allow camera access in your browser settings, or enter the registry ID below.",
    unavailable: "No camera is available on this device. Enter the registry ID printed on the label instead.",
    error: "The camera couldn't be started. Enter the registry ID printed on the label instead.",
  };
  const cameraActive = camera === "scanning" || camera === "starting";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <ScanHeader />
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
            <div>
              <h1 className="text-xl font-bold text-foreground">Scan Equipment</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Scan a Casa Dossier QR label to jump straight to jobs for that unit.
              </p>
            </div>

            {/* Camera */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className={`relative bg-black aspect-[4/3] ${cameraActive ? "" : "hidden"}`}>
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-48 w-48 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
                {camera === "starting" && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">Starting camera…</div>
                )}
              </div>
              <div className="p-4 flex flex-col gap-3">
                {camera === "denied" || camera === "unavailable" || camera === "error" ? (
                  <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <CameraOff className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>{cameraMessage[camera]}</p>
                  </div>
                ) : null}
                {cameraActive ? (
                  <Button variant="outline" className="gap-2" onClick={stopCamera}>
                    <CameraOff className="h-4 w-4" /> Stop camera
                  </Button>
                ) : camera !== "unavailable" ? (
                  <Button className="gap-2" onClick={startCamera} disabled={loading}>
                    <Camera className="h-4 w-4" /> {camera === "denied" || camera === "error" ? "Try camera again" : "Scan QR code"}
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Manual fallback */}
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Registry ID, e.g. CDA-1A2B3C4D"
                className="font-mono"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
              <Button type="submit" variant="secondary" className="gap-1.5 shrink-0" disabled={!manual.trim() || loading}>
                <Search className="h-4 w-4" /> Look up
              </Button>
            </form>

            {/* Result */}
            {loading && (
              <div className="space-y-3">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-28 rounded-xl" />
              </div>
            )}

            {error && !loading && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {result && !loading && <ScanResultView result={result} onReset={reset} />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ScanResultView({ result, onReset }: { result: ScanResult; onReset: () => void }) {
  const noJobs = result.myJobs.length === 0 && result.openJobs.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <QrCode className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-mono font-bold text-foreground">{result.registryId}</p>
            <p className="text-xs text-muted-foreground truncate">
              {result.asset ? `${result.asset.name} · ${result.category}` : result.category}
            </p>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="gap-1.5 shrink-0" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" /> Scan another
        </Button>
      </div>

      {noJobs && (
        <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed rounded-xl bg-muted/30">
          <ClipboardList className="h-9 w-9 text-muted-foreground/30 mb-2" />
          <p className="text-sm font-medium text-foreground">No jobs for this asset.</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Equipment details and service history are shown once you've accepted a job on this unit.
          </p>
        </div>
      )}

      {result.myJobs.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your jobs</p>
          {result.myJobs.map((job) => (
            <div key={job.id} className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant={job.status === "completed" ? "outline" : "secondary"} className="text-xs">
                  {STATUS_LABEL[job.status] ?? job.status}
                </Badge>
                {job.scheduledAt && (
                  <span className="text-xs text-emerald-700 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(job.scheduledAt), "MMM d, h:mm a")}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground">{job.description}</p>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {(job.propertyAddress || job.propertyCity) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[job.propertyAddress, job.propertyCity, job.propertyState].filter(Boolean).join(", ")}
                  </span>
                )}
                {job.contactPhone && (
                  <a href={`tel:${job.contactPhone}`} className="flex items-center gap-1 text-primary hover:underline">
                    <Phone className="h-3 w-3" />
                    {job.contactPhone}
                  </a>
                )}
              </div>
              {job.status !== "completed" && (
                <Link href={`/my-jobs?job=${job.id}`}>
                  <Button size="sm" variant="outline" className="w-full mt-1">Open in My Jobs</Button>
                </Link>
              )}
            </div>
          ))}
        </section>
      )}

      {result.openJobs.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Open jobs</p>
          {result.openJobs.map((job) => (
            <div key={job.id} className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-xs capitalize">{job.urgency}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[job.city, job.state].filter(Boolean).join(", ")}
                </span>
              </div>
              <p className="text-sm text-foreground">{job.description}</p>
              <p className="text-xs text-muted-foreground">Full address revealed after accepting</p>
              <Link href="/map">
                <Button size="sm" className="w-full mt-1">View on Open Jobs map</Button>
              </Link>
            </div>
          ))}
        </section>
      )}

      {result.asset && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Equipment</p>
          <div className="rounded-xl border bg-card p-4 flex items-start gap-3 text-sm">
            <Wrench className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">{result.asset.name}</p>
              <p className="text-xs text-muted-foreground">
                {[result.asset.brand, result.asset.model, result.asset.category].filter(Boolean).join(" · ")}
              </p>
              {result.asset.serialNumber && <p className="text-xs text-muted-foreground">S/N: {result.asset.serialNumber}</p>}
              {result.asset.installDate && <p className="text-xs text-muted-foreground">Installed: {result.asset.installDate}</p>}
              {result.asset.warrantyExpiry && <p className="text-xs text-muted-foreground">Warranty expires: {result.asset.warrantyExpiry}</p>}
              {result.asset.notes && <p className="text-xs text-muted-foreground italic mt-1">{result.asset.notes}</p>}
            </div>
          </div>
        </section>
      )}

      {result.serviceHistory && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service history</p>
          {result.serviceHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground">No service records yet.</p>
          ) : (
            result.serviceHistory.map((r) => (
              <div key={r.id} className="bg-muted/50 rounded-lg p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-medium text-foreground">{r.description}</span>
                  <span className="text-muted-foreground shrink-0">{r.date?.slice(0, 10)}</span>
                </div>
                {(r.companyName || r.technicianName) && (
                  <p className="text-muted-foreground">{[r.companyName, r.technicianName].filter(Boolean).join(" · ")}</p>
                )}
                {r.verified && <p className="text-emerald-700 mt-0.5">Verified</p>}
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
