import { useTranslation } from "react-i18next";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/field-error";
import { Building2, Search, Loader2, Sparkles, MapPin, Wand2 } from "lucide-react";

export function AddressStep({
  addressInput,
  onAddressChange,
  error,
  lookupBusy,
  onLookup,
  onCancel,
}: {
  addressInput: string;
  onAddressChange: (v: string) => void;
  error?: string;
  lookupBusy: boolean;
  onLookup: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <DialogTitle className="text-lg">{t("addProperty.title")}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{t("addProperty.subtitle")}</p>
          </div>
        </div>
      </DialogHeader>
      <div className="px-6 py-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="address-input" className="text-sm font-medium">{t("onboarding.streetAddress")} <span className="text-destructive" aria-hidden="true">*</span></Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="address-input"
                placeholder={t("onboarding.addressPlaceholder")}
                value={addressInput}
                onChange={(e) => onAddressChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onLookup()}
                className="pl-9"
                autoFocus
                required
                aria-invalid={!!error}
                aria-describedby={error ? "address-input-error" : undefined}
              />
            </div>
            <Button onClick={onLookup} disabled={lookupBusy} className="gap-2 shrink-0">
              {lookupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {lookupBusy ? t("onboarding.lookingUp") : t("onboarding.lookUp")}
            </Button>
          </div>
          <FieldError id="address-input-error" message={error} />
        </div>

        <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-5 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("onboarding.whatHappensNext")}</p>
          <div className="space-y-2">
            {[
              { icon: <Search className="h-3.5 w-3.5" />, text: t("onboarding.nextStep1") },
              { icon: <Wand2 className="h-3.5 w-3.5" />, text: t("onboarding.nextStep2") },
              { icon: <Sparkles className="h-3.5 w-3.5" />, text: t("onboarding.nextStep3") },
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
        <Button variant="ghost" size="sm" onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
    </>
  );
}
