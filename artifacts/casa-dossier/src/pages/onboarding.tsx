import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser, useClerk } from "@clerk/react";
import { PendingInvitesModal } from "@/components/pending-invites-modal";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
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
  ArrowRight,
  ChevronLeft,
  Wand2,
  ShieldCheck,
  ClipboardList,
  Hammer,
  LogOut,
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

type Step = "welcome" | "address" | "verify" | "scouting" | "done";

function StatBadge({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | null;
}) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className="font-semibold text-sm leading-tight">{value}</p>
      </div>
    </div>
  );
}

export function Onboarding() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const authFetch = useAuthFetch();
  const firstName = user?.firstName ?? "there";

  const [step, setStep] = useState<Step>("welcome");
  const [addressInput, setAddressInput] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [sqft, setSqft] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");

  const [saveBusy, setSaveBusy] = useState(false);
  const [scoutResult, setScoutResult] = useState<{ taskCount: number } | null>(null);
  // Stored from lookup — not shown in UI, passed silently on save
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  async function handleLookup() {
    if (!addressInput.trim()) return;
    setLookupBusy(true);
    try {
      const res = await authFetch(
        `${BASE}/api/properties/lookup?address=${encodeURIComponent(addressInput.trim())}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Address not found",
          description: err.error ?? "Try a more complete address.",
          variant: "destructive",
        });
        return;
      }
      const data: LookupResult = await res.json();
      setLookupResult(data);
      setAddress(data.address);
      setCity(data.city ?? "");
      setState(data.state ?? "");
      setZipCode(data.zipCode ?? "");
      setYearBuilt(data.yearBuilt != null ? String(data.yearBuilt) : "");
      setSqft(data.sqft != null ? String(data.sqft) : "");
      setBedrooms(data.bedrooms != null ? String(data.bedrooms) : "");
      setBathrooms(data.bathrooms != null ? String(data.bathrooms) : "");
      setLatitude(data.latitude ?? null);
      setLongitude(data.longitude ?? null);
      setName(data.address);
      setStep("verify");
    } finally {
      setLookupBusy(false);
    }
  }

  function handleSkipToManual() {
    setManualMode(true);
    setStep("verify");
  }

  async function handleSave() {
    if (!name.trim() || !address.trim()) return;
    setSaveBusy(true);
    setStep("scouting");

    try {
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

      await queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      await queryClient.refetchQueries({ queryKey: ["/api/properties"] });

      try {
        const scoutRes = await authFetch(
          `${BASE}/api/properties/${property.id}/scout`,
          { method: "POST" }
        );
        if (scoutRes.ok) {
          const scoutData = await scoutRes.json();
          setScoutResult({ taskCount: scoutData.taskCount });
        }
      } catch {
        setScoutResult({ taskCount: 0 });
      }

      setStep("done");
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
      setStep("verify");
    } finally {
      setSaveBusy(false);
    }
  }

  function handleFinish() {
    queryClient.refetchQueries({ queryKey: ["/api/properties"] });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PendingInvitesModal />
      {/* Minimal top bar */}
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary rounded-lg p-1.5">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">Casa Dossier</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => signOut({ redirectUrl: `${BASE}/` })}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500"
          key={step}
        >

          {/* ── Step 1: Welcome ── */}
          {step === "welcome" && (
            <div className="text-center space-y-8">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 bg-primary/8 text-primary text-sm font-medium px-4 py-1.5 rounded-full">
                  <Sparkles className="h-3.5 w-3.5" />
                  Welcome to Casa Dossier
                </div>
                <h1 className="text-4xl font-bold tracking-tight leading-tight">
                  Hey {firstName}, let's set up<br />your home's dossier.
                </h1>
                <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
                  In just 2 minutes you'll have a living record of every system, appliance, and repair — all in one place.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    icon: ClipboardList,
                    title: "Full History",
                    desc: "Every repair, upgrade, and service visit logged",
                  },
                  {
                    icon: Hammer,
                    title: "Smart Plan",
                    desc: "AI-generated maintenance schedule for your home",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Transfer Ready",
                    desc: "Complete dossier to hand off when you sell",
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="rounded-xl border bg-card p-4 text-left space-y-2"
                  >
                    <div className="bg-primary/10 w-fit rounded-lg p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-semibold leading-tight">{title}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                className="gap-2 px-8 text-base"
                onClick={() => setStep("address")}
              >
                Add My Home
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* ── Step 2: Address Lookup ── */}
          {step === "address" && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <button
                  onClick={() => setStep("welcome")}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-primary/10 p-2.5 rounded-xl">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">What's your address?</h2>
                    <p className="text-muted-foreground text-sm mt-0.5">
                      We'll look up year built, square footage, and more automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-address" className="text-sm font-medium">
                  Street Address
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ob-address"
                      placeholder="123 Main St, Austin, TX 78701"
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <Button
                    onClick={handleLookup}
                    disabled={!addressInput.trim() || lookupBusy}
                    className="gap-2 shrink-0"
                  >
                    {lookupBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {lookupBusy ? "Looking up…" : "Look Up"}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  What happens next
                </p>
                <div className="space-y-2">
                  {[
                    { icon: <Search className="h-3.5 w-3.5" />, text: "We fetch public records: year built, sq ft, beds & baths" },
                    { icon: <Wand2 className="h-3.5 w-3.5" />, text: "You verify and edit the details before we save" },
                    { icon: <Sparkles className="h-3.5 w-3.5" />, text: "AI Scout generates your personalized Whole-Home Stewardship Plan" },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 text-xs text-muted-foreground"
                    >
                      <span className="mt-0.5 text-primary shrink-0">{item.icon}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={handleSkipToManual}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                >
                  Skip lookup — I'll enter details manually
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Verify ── */}
          {step === "verify" && (
            <div className="space-y-5">
              <div>
                <button
                  onClick={() => { setManualMode(false); setStep("address"); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                <div className="flex items-center gap-3 mb-1">
                  <div className="bg-emerald-100 p-2.5 rounded-xl">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {manualMode ? "Enter your home's details" : "Verify your details"}
                    </h2>
                    <p className="text-muted-foreground text-sm mt-0.5">
                      {manualMode
                        ? "Fill in what you know — you can always update this later."
                        : "We pre-filled from public records — edit anything that's off."}
                    </p>
                  </div>
                </div>
              </div>

              {lookupResult && !manualMode && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatBadge icon={<Calendar className="h-3.5 w-3.5" />} label="Year Built" value={lookupResult.yearBuilt} />
                  <StatBadge icon={<Maximize className="h-3.5 w-3.5" />} label="Sq Ft" value={lookupResult.sqft?.toLocaleString() ?? null} />
                  <StatBadge icon={<BedDouble className="h-3.5 w-3.5" />} label="Beds" value={lookupResult.bedrooms} />
                  <StatBadge icon={<Bath className="h-3.5 w-3.5" />} label="Baths" value={lookupResult.bathrooms} />
                </div>
              )}

              <div className="space-y-3 rounded-xl border bg-card p-5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Property Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. The Johnson Family Home"
                    autoFocus={manualMode}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Street Address</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">City</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" />
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

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  AI Scout runs after saving (~20s)
                </div>
                <Button
                  onClick={handleSave}
                  disabled={!name.trim() || !address.trim() || saveBusy}
                  className="gap-1.5"
                >
                  Save & Generate Plan
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 4: AI Scouting ── */}
          {step === "scouting" && (
            <div className="flex flex-col items-center text-center gap-6 py-8">
              <div className="relative">
                <div className="bg-primary/10 rounded-full p-6">
                  <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">AI Scout is on it</h2>
                <p className="text-muted-foreground max-w-sm leading-relaxed">
                  Analyzing your home's age, location, and climate to build a personalized Whole-Home Stewardship Plan…
                </p>
              </div>
              <div className="w-full max-w-xs space-y-3 pt-2">
                {[
                  "Reviewing home age & regional climate",
                  "Identifying system-specific risks",
                  "Generating your maintenance schedule",
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-primary" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {step === "done" && (
            <div className="space-y-6 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="bg-emerald-100 rounded-full p-5">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold">Your home is ready!</h2>
                  <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Property saved and your Whole-Home Stewardship Plan has been generated.
                  </p>
                </div>
              </div>

              {scoutResult && scoutResult.taskCount > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3 text-left">
                  <Sparkles className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">
                      {scoutResult.taskCount} maintenance tasks generated
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Added to your Home Stewardship asset with due dates and DIY tips.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Building2, label: "Property saved" },
                  { icon: Wand2, label: "AI plan created" },
                  { icon: ClipboardList, label: "Tasks scheduled" },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="rounded-xl border bg-card p-4 flex flex-col items-center gap-2"
                  >
                    <div className="bg-emerald-100 rounded-lg p-2">
                      <Icon className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="text-xs font-medium text-center leading-tight">{label}</p>
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                className="gap-2 px-8 w-full"
                onClick={handleFinish}
              >
                Go to My Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
