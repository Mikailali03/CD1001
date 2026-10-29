import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, ShieldCheck, ClipboardList, Hammer } from "lucide-react";

export function WelcomeStep({ firstName, onStart }: { firstName: string | null | undefined; onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="text-center space-y-8">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 bg-primary/8 text-primary text-sm font-medium px-4 py-1.5 rounded-full">
          <Sparkles className="h-3.5 w-3.5" />
          {t("onboarding.welcomeBadge")}
        </div>
        <h1 className="text-4xl font-bold tracking-tight leading-tight">
          {firstName ? t("onboarding.welcomeTitle", { name: firstName }) : t("onboarding.welcomeTitleNoName")}
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
          {t("onboarding.welcomeSubtitle")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {([
          { icon: ClipboardList, titleKey: "card1Title", descKey: "card1Desc" },
          { icon: Hammer,        titleKey: "card2Title", descKey: "card2Desc" },
          { icon: ShieldCheck,   titleKey: "card3Title", descKey: "card3Desc" },
        ] as const).map(({ icon: Icon, titleKey, descKey }) => (
          <div
            key={titleKey}
            className="rounded-xl border bg-card p-4 text-left space-y-2"
          >
            <div className="bg-primary/10 w-fit rounded-lg p-2">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold leading-tight">{t(`onboarding.${titleKey}`)}</p>
            <p className="text-xs text-muted-foreground leading-snug">{t(`onboarding.${descKey}`)}</p>
          </div>
        ))}
      </div>

      <Button
        size="lg"
        className="gap-2 px-8 text-base"
        onClick={onStart}
      >
        {t("onboarding.addMyHome")}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
