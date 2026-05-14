import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Search,
  Loader2,
  CheckCircle2,
  Sparkles,
  MapPin,
  Calendar,
  Maximize,
  BedDouble,
  Bath,
  TreePine,
  ArrowRight,
  ChevronLeft,
  Wand2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type LookupResult = {
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  yearBuilt: number | null;
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  lotSize: number | null;
  latitude: number | null;
  longitude: number | null;
};

type Step = "address" | "verify" | "scouting" | "done";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (propertyId: string) => void;
};

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="font-semibold text-sm leading-tight">{value}</p>
      </div>
    </div>
  );
}

export function AddPropertyDialog({ open, onOpenChange, onCreated }: Props) {
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("address");
  const [addressInput, setAddressInput] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);

  // Editable fields in verify step
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [sqft, setSqft] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [lotSize, setLotSize] = useState("");

  const [saveBusy, setSaveBusy] = useState(false);
  const [scoutResult, setScoutResult] = useState<{ taskCount: number } | null>(null);
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
  // Stored from lookup — not shown in UI, passed silently on save
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  function reset() {
    setStep("address");
    setAddressInput("");
    setLookupBusy(false);
    setLookupResult(null);
    setName(""); setAddress(""); setCity(""); setState(""); setZipCode("");
    setYearBuilt(""); setSqft(""); setBedrooms(""); setBathrooms(""); setLotSize("");
    setSaveBusy(false);
    setScoutResult(null);
    setCreatedPropertyId(null);
    setLatitude(null);
    setLongitude(null);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  // ── Step 1: address lookup ──
  async function handleLookup() {
    if (!addressInput.trim()) return;
    setLookupBusy(true);
    try {
      const res = await authFetch(`${BASE}/api/properties/lookup?address=${encodeURIComponent(addressInput.trim())}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Address not found", description: err.error ?? "Try a more complete address.", variant: "destructive" });
        return;
      }
      const data: LookupResult = await res.json();
      setLookupResult(data);

      // Pre-fill editable fields
      setAddress(data.address);
      setCity(data.city ?? "");
      setState(data.state ?? "");
      setZipCode(data.zipCode ?? "");
      setYearBuilt(data.yearBuilt != null ? String(data.yearBuilt) : "");
      setSqft(data.sqft != null ? String(data.sqft) : "");
      setBedrooms(data.bedrooms != null ? String(data.bedrooms) : "");
      setBathrooms(data.bathrooms != null ? String(data.bathrooms) : "");
      setLotSize(data.lotSize != null ? String(data.lotSize) : "");
      setLatitude(data.latitude ?? null);
      setLongitude(data.longitude ?? null);
      // Default property name to the address
      setName(data.address);

      setStep("verify");
    } finally {
      setLookupBusy(false);
    }
  }

  // ── Step 2: save property + trigger scout ──
  async function handleSave() {
    if (!name.trim() || !address.trim()) return;
    setSaveBusy(true);
    setStep("scouting");

    try {
      // Create property
      const res = await authFetch(`${BASE}/api/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          city: city.trim() || null,
          state: state.trim() || null,
          zipCode: zipCode.trim() || null,
          yearBuilt: yearBuilt ? parseInt(yearBuilt) : null,
          sqft: sqft ? parseInt(sqft) : null,
          bedrooms: bedrooms ? parseInt(bedrooms) : null,
          bathrooms: bathrooms ? parseFloat(bathrooms) : null,
          lotSize: lotSize ? parseInt(lotSize) : null,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
        }),
      });

      if (!res.ok) {
        toast({ title: "Could not save property", variant: "destructive" });
        setStep("verify");
        return;
      }

      const property = await res.json();
      setCreatedPropertyId(property.id);

      // Invalidate properties list immediately
      await queryClient.invalidateQueries({ queryKey: ["list-properties"] });
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => k === "listProperties" || k === "properties") });

      // Trigger AI scout (can take 10-20s)
      try {
        const scoutRes = await authFetch(`${BASE}/api/properties/${property.id}/scout`, { method: "POST" });
        if (scoutRes.ok) {
          const scoutData = await scoutRes.json();
          setScoutResult({ taskCount: scoutData.taskCount });
        }
      } catch {
        // Scout failure is non-fatal
        setScoutResult({ taskCount: 0 });
      }

      setStep("done");
      onCreated?.(property.id);
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
      setStep("verify");
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">

        {/* ── Step 1: Address ── */}
        {step === "address" && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-xl">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Add Your Home</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">We'll look up the details automatically.</p>
                </div>
              </div>
            </DialogHeader>
            <div className="px-6 py-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="address-input" className="text-sm font-medium">Street Address</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address-input"
                      placeholder="123 Main St, Austin, TX 78701"
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <Button onClick={handleLookup} disabled={!addressInput.trim() || lookupBusy} className="gap-2 shrink-0">
                    {lookupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {lookupBusy ? "Looking up…" : "Look Up"}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-5 space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What happens next</p>
                <div className="space-y-2">
                  {[
                    { icon: <Search className="h-3.5 w-3.5" />, text: "We fetch year built, square footage, beds & baths automatically" },
                    { icon: <Wand2 className="h-3.5 w-3.5" />, text: "You verify and edit the details before saving" },
                    { icon: <Sparkles className="h-3.5 w-3.5" />, text: "An AI Scout generates a personalized Whole-Home Stewardship Plan" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                      <span className="mt-0.5 text-primary shrink-0">{item.icon}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>Cancel</Button>
            </div>
          </>
        )}

        {/* ── Step 2: Verify ── */}
        {step === "verify" && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2.5 rounded-xl">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Verify Your Details</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">We pre-filled from public records — edit anything that's off.</p>
                </div>
              </div>
            </DialogHeader>

            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Quick-glance stat chips */}
              {lookupResult && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatBadge icon={<Calendar className="h-3.5 w-3.5" />} label="Year Built" value={lookupResult.yearBuilt} />
                  <StatBadge icon={<Maximize className="h-3.5 w-3.5" />} label="Sq Ft" value={lookupResult.sqft?.toLocaleString() ?? null} />
                  <StatBadge icon={<BedDouble className="h-3.5 w-3.5" />} label="Beds" value={lookupResult.bedrooms} />
                  <StatBadge icon={<Bath className="h-3.5 w-3.5" />} label="Baths" value={lookupResult.bathrooms} />
                </div>
              )}

              {/* Editable form */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Property Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Johnson Family Home" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Street Address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">City</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">State</Label>
                    <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} placeholder="TX" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Year Built</Label>
                    <Input value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} type="number" placeholder="1990" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Sq Ft</Label>
                    <Input value={sqft} onChange={(e) => setSqft(e.target.value)} type="number" placeholder="2000" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Beds</Label>
                    <Input value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} type="number" placeholder="3" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Baths</Label>
                    <Input value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} type="number" step="0.5" placeholder="2" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t px-6 py-4 flex items-center justify-between gap-3 bg-muted/20">
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setStep("address")}>
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  AI Scout will run after saving
                </div>
                <Button onClick={handleSave} disabled={!name.trim() || !address.trim()} className="gap-1.5">
                  Save & Generate Plan
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 3: AI Scouting ── */}
        {step === "scouting" && (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-5">
            <div className="relative">
              <div className="bg-primary/10 rounded-full p-5">
                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold">AI Scout is researching your home</h3>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Analyzing your home's age, location, and climate to generate a personalized Whole-Home Stewardship Plan…
              </p>
            </div>
            <div className="w-full max-w-xs space-y-2 pt-2">
              {["Reviewing home age & regional climate", "Identifying system-specific risks", "Generating maintenance schedule"].map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === "done" && (
          <>
            <div className="px-6 py-10 flex flex-col items-center text-center gap-5">
              <div className="bg-emerald-100 rounded-full p-5">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold">Your home is ready!</h3>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                  Property saved and your Whole-Home Stewardship Plan has been generated.
                </p>
              </div>

              {scoutResult && scoutResult.taskCount > 0 && (
                <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-emerald-800">
                      {scoutResult.taskCount} maintenance tasks generated
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Added to your Home Stewardship asset with due dates and DIY instructions.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 w-full text-xs text-muted-foreground">
                {[
                  { icon: <Building2 className="h-3.5 w-3.5" />, text: "Property saved to your account" },
                  { icon: <Wand2 className="h-3.5 w-3.5" />, text: "AI-generated stewardship plan" },
                  { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Home Stewardship asset created" },
                  { icon: <TreePine className="h-3.5 w-3.5" />, text: "Seasonal tasks scheduled" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-emerald-600">{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-end">
              <Button onClick={() => handleClose(false)} className="gap-1.5">
                View Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
