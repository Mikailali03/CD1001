import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useTranslation } from "react-i18next";
import { PendingInvitesModal } from "@/components/pending-invites-modal";
import {
  getListPropertiesQueryKey,
  lookupProperty,
  createProperty,
  generateStewardshipPlan,
  type PropertyLookupResult,
} from "@workspace/api-client-react";
import { apiErrorMessage } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/field-error";
import { useToast } from "@/hooks/use-toast";
import { WelcomeStep } from "@/components/onboarding/welcome-step";
import { OnboardingVerifyStep } from "@/components/onboarding/verify-step";
import { OnboardingDoneStep } from "@/components/onboarding/done-step";
import {
  EMPTY_PROPERTY_FORM,
  type PropertyForm,
  type PropertyFormErrors,
} from "@/components/add-property/verify-step";
import {
  Building2,
  Search,
  Loader2,
  Sparkles,
  MapPin,
  ChevronLeft,
  Wand2,
  ShieldCheck,
  LogOut,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Step = "welcome" | "address" | "verify" | "scouting" | "done";

/** HTTP status carried by generated-client errors; undefined for network failures. */
function errorStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

export function Onboarding({
  onFlowStart,
  onFinish,
}: {
  onFlowStart?: () => void;
  onFinish?: () => void;
} = {}) {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("welcome");
  const [addressInput, setAddressInput] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<PropertyLookupResult | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const [form, setForm] = useState<PropertyForm>(EMPTY_PROPERTY_FORM);
  const setField = (key: keyof PropertyForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const [saveBusy, setSaveBusy] = useState(false);
  const [scoutResult, setScoutResult] = useState<{ taskCount: number } | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  // Set once the POST succeeds, so a retry after a later failure (bad JSON,
  // scout error) doesn't create a second property.
  const createdPropertyIdRef = useRef<string | null>(null);
  const [errors, setErrors] = useState<PropertyFormErrors>({});
  const clearError = (key: keyof PropertyFormErrors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  async function handleLookup() {
    if (!addressInput.trim()) {
      setErrors({ addressInput: t("onboarding.errAddressRequired") });
      return;
    }
    setLookupBusy(true);
    try {
      let data: PropertyLookupResult;
      try {
        data = await lookupProperty({ address: addressInput.trim() });
      } catch (err) {
        toast({
          title: t("onboarding.addressNotFound"),
          description: apiErrorMessage(err, t("onboarding.addressNotFoundDesc")),
          variant: "destructive",
        });
        return;
      }
      setLookupResult(data);
      setForm({
        name: data.address,
        address: data.address,
        city: data.city ?? "",
        state: data.state ?? "",
        zipCode: data.zipCode ?? "",
        yearBuilt: data.yearBuilt != null ? String(data.yearBuilt) : "",
        sqft: data.sqft != null ? String(data.sqft) : "",
        bedrooms: data.bedrooms != null ? String(data.bedrooms) : "",
        bathrooms: data.bathrooms != null ? String(data.bathrooms) : "",
      });
      setLatitude(data.latitude ?? null);
      setLongitude(data.longitude ?? null);
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
    const next: PropertyFormErrors = {};
    if (!form.name.trim()) next.name = t("onboarding.errNameRequired");
    if (!form.address.trim()) next.address = t("onboarding.errStreetRequired");
    const year = form.yearBuilt ? parseInt(form.yearBuilt) : null;
    if (year != null && (year < 1600 || year > new Date().getFullYear() + 1)) next.yearBuilt = t("onboarding.errYearInvalid");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaveBusy(true);
    setStep("scouting");
    onFlowStart?.();

    try {
      let propertyId = createdPropertyIdRef.current;
      if (propertyId === null) {
        try {
          const property = await createProperty({
            name: form.name.trim(),
            address: form.address.trim(),
            city: form.city.trim() || undefined,
            state: form.state.trim() || undefined,
            zipCode: form.zipCode.trim() || undefined,
            yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : undefined,
            sqft: form.sqft ? parseInt(form.sqft) : undefined,
            bedrooms: form.bedrooms ? parseInt(form.bedrooms) : undefined,
            bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : undefined,
            latitude: latitude ?? undefined,
            longitude: longitude ?? undefined,
          });
          propertyId = property.id;
        } catch (err) {
          const status = errorStatus(err);
          if (status === undefined) throw err;
          if (status < 200 || status >= 300) {
            toast({ title: t("onboarding.couldNotSave"), variant: "destructive" });
            setStep("verify");
            return;
          }
          // 2xx but the body couldn't be read: the property exists, id unknown.
          propertyId = "";
        }

        // The property exists from here on. Remember it so a retry can never
        // POST a duplicate.
        createdPropertyIdRef.current = propertyId;

        await queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
      }

      if (!propertyId) {
        // Created, but we never learned the id. Send the user on to the
        // dashboard, which will pick the new property up from the list.
        await queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        setStep("done");
        return;
      }

      try {
        const scoutData = await generateStewardshipPlan(propertyId);
        setScoutResult({ taskCount: scoutData.taskCount });
      } catch (err) {
        // A non-2xx reply leaves the result unset; only a network failure records 0.
        if (errorStatus(err) === undefined) setScoutResult({ taskCount: 0 });
      }

      setStep("done");
    } catch {
      toast({ title: t("onboarding.somethingWentWrong"), variant: "destructive" });
      setStep("verify");
    } finally {
      setSaveBusy(false);
    }
  }

  function handleFinish() {
    queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
    setLocation("/dashboard");
    onFinish?.();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PendingInvitesModal />
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
          {t("onboarding.signOut")}
        </Button>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500"
          key={step}
        >

          {/* ── Step 1: Welcome ── */}
          {step === "welcome" && (
            <WelcomeStep firstName={user?.firstName} onStart={() => setStep("address")} />
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
                  {t("onboarding.back")}
                </button>
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-primary/10 p-2.5 rounded-xl">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{t("onboarding.addressTitle")}</h2>
                    <p className="text-muted-foreground text-sm mt-0.5">
                      {t("onboarding.addressSubtitle")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-address" className="text-sm font-medium">
                  {t("onboarding.streetAddress")} <span className="text-destructive" aria-hidden="true">*</span>
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ob-address"
                      placeholder={t("onboarding.addressPlaceholder")}
                      value={addressInput}
                      onChange={(e) => { setAddressInput(e.target.value); clearError("addressInput"); }}
                      onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                      className="pl-9"
                      autoFocus
                      required
                      aria-invalid={!!errors.addressInput}
                      aria-describedby={errors.addressInput ? "ob-address-error" : undefined}
                    />
                  </div>
                  <Button
                    onClick={handleLookup}
                    disabled={lookupBusy}
                    className="gap-2 shrink-0"
                  >
                    {lookupBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {lookupBusy ? t("onboarding.lookingUp") : t("onboarding.lookUp")}
                  </Button>
                </div>
                <FieldError id="ob-address-error" message={errors.addressInput} />
              </div>

              <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("onboarding.whatHappensNext")}
                </p>
                <div className="space-y-2">
                  {[
                    { icon: <Search className="h-3.5 w-3.5" />, textKey: "nextStep1" },
                    { icon: <Wand2 className="h-3.5 w-3.5" />,  textKey: "nextStep2" },
                    { icon: <Sparkles className="h-3.5 w-3.5" />, textKey: "nextStep3" },
                  ].map((item) => (
                    <div
                      key={item.textKey}
                      className="flex items-start gap-2.5 text-xs text-muted-foreground"
                    >
                      <span className="mt-0.5 text-primary shrink-0">{item.icon}</span>
                      <span>{t(`onboarding.${item.textKey}`)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={handleSkipToManual}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                >
                  {t("onboarding.skipToManual")}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Verify ── */}
          {step === "verify" && (
            <OnboardingVerifyStep
              form={form}
              setField={setField}
              errors={errors}
              clearError={clearError}
              lookupResult={lookupResult}
              manualMode={manualMode}
              saveBusy={saveBusy}
              onBack={() => { setManualMode(false); setStep("address"); }}
              onSave={handleSave}
            />
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
                <h2 className="text-2xl font-bold">{t("onboarding.scoutingTitle")}</h2>
                <p className="text-muted-foreground max-w-sm leading-relaxed">
                  {t("onboarding.scoutingSubtitle")}
                </p>
              </div>
              <div className="w-full max-w-xs space-y-3 pt-2">
                {(["scoutStep1", "scoutStep2", "scoutStep3"] as const).map((key) => (
                  <div key={key} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-primary" />
                    {t(`onboarding.${key}`)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {step === "done" && (
            <OnboardingDoneStep scoutResult={scoutResult} onFinish={handleFinish} />
          )}
        </div>
      </div>
    </div>
  );
}
