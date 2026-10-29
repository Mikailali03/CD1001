import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FolderOpen, Images, FolderIcon, Lock, Sparkles, ShieldCheck } from "lucide-react";

/** Blurred preview of the locker with an upgrade prompt, for plans without locker access. */
export function LockerUpgradeGate({ onUpgrade }: { onUpgrade: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      {/* Blurred fake page underneath */}
      <div className="blur-sm pointer-events-none select-none opacity-60 flex h-full" aria-hidden>
        <aside className="w-56 shrink-0 border-r bg-muted/30 flex flex-col">
          <div className="px-4 pt-5 pb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">{t("locker.title")}</p>
          </div>
          <nav className="flex-1 px-2 space-y-0.5">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
              <Images className="h-4 w-4 shrink-0" /> {t("locker.allPhotos")}
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-foreground">
              <FolderOpen className="h-4 w-4 shrink-0" /> {t("locker.unorganized")}
            </div>
            {(["sampleFolder1", "sampleFolder2", "sampleFolder3"] as const).map((key) => (
              <div key={key} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-foreground">
                <FolderIcon className="h-4 w-4 shrink-0" /> {t(`locker.${key}`)}
              </div>
            ))}
          </nav>
          <div className="p-3 border-t">
            <div className="h-8 rounded-lg border bg-muted w-full" />
          </div>
        </aside>
        <main className="flex-1 flex flex-col">
          <div className="border-b px-6 py-4 flex items-center justify-between gap-3">
            <div>
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded mt-1.5" />
            </div>
            <div className="h-8 w-32 rounded-lg bg-muted" />
          </div>
          <div className="flex-1 p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-muted border" />
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Upgrade overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="bg-background/95 backdrop-blur-sm rounded-2xl border shadow-xl p-8 w-full max-w-md text-center space-y-5">
          <div className="flex justify-center">
            <div className="bg-primary/10 rounded-full p-5">
              <Lock className="h-10 w-10 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">{t("locker.gateTitle")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("locker.gateDesc")}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50">
              <Images className="h-5 w-5 text-primary" />
              <span className="leading-snug text-center font-medium">{t("locker.perkStorage")}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50">
              <FolderIcon className="h-5 w-5 text-primary" />
              <span className="leading-snug text-center font-medium">{t("locker.perkFolders")}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="leading-snug text-center font-medium">{t("locker.perkSecure")}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 pt-1">
            <Button onClick={onUpgrade} className="w-full gap-2 h-11">
              <Sparkles className="h-4 w-4" />
              {t("locker.gateCta")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("locker.gateFootnote")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
