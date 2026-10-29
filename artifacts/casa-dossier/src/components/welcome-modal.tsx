import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Hammer,
  ClipboardList,
  Sparkles,
  FileText,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

const SLIDE_META = [
  { icon: LayoutDashboard, iconBg: "bg-blue-100", iconColor: "text-blue-600", accent: "from-blue-50 to-slate-50" },
  { icon: Hammer,          iconBg: "bg-amber-100", iconColor: "text-amber-600", accent: "from-amber-50 to-orange-50" },
  { icon: ClipboardList,   iconBg: "bg-emerald-100", iconColor: "text-emerald-600", accent: "from-emerald-50 to-teal-50" },
  { icon: Sparkles,        iconBg: "bg-violet-100", iconColor: "text-violet-600", accent: "from-violet-50 to-purple-50" },
  { icon: FileText,        iconBg: "bg-rose-100", iconColor: "text-rose-600", accent: "from-rose-50 to-pink-50" },
] as const;

function SlideContent({
  meta,
  title,
  body,
  tip,
  tipLabel,
  animKey,
}: {
  meta: typeof SLIDE_META[number];
  title: string;
  body: string;
  tip: string;
  tipLabel: string;
  animKey: number;
}) {
  const Icon = meta.icon;
  return (
    <div
      key={animKey}
      className={`bg-gradient-to-br ${meta.accent} rounded-xl p-6 flex flex-col items-center text-center gap-4`}
      style={{ animation: "wFadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      <div className={`${meta.iconBg} rounded-2xl p-4 shadow-sm`}>
        <Icon className={`h-8 w-8 ${meta.iconColor}`} strokeWidth={1.5} />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">{body}</p>
      </div>
      <div className="rounded-lg border border-dashed bg-background/60 px-4 py-2.5 text-xs text-muted-foreground max-w-xs">
        <span className="font-semibold text-foreground">{tipLabel}</span>
        {tip}
      </div>
    </div>
  );
}

export function WelcomeModal({ forceOpen = false }: { forceOpen?: boolean }) {
  const { user } = useUser();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const storageKey = user?.id ? `casa_welcome_seen_${user.id}` : null;

  useEffect(() => {
    if (!forceOpen) return;
    setCurrentIdx(0);
    setAnimKey(0);
    const timer = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(timer);
  }, [forceOpen]);

  useEffect(() => {
    if (forceOpen || !storageKey || localStorage.getItem(storageKey)) return;
    const timer = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(timer);
  }, [storageKey, forceOpen]);

  function dismiss() {
    if (storageKey) localStorage.setItem(storageKey, "1");
    setOpen(false);
  }

  function goTo(idx: number) {
    setCurrentIdx(idx);
    setAnimKey((k) => k + 1);
  }

  function prev() {
    if (currentIdx > 0) goTo(currentIdx - 1);
  }

  function next() {
    if (currentIdx < SLIDE_META.length - 1) goTo(currentIdx + 1);
  }

  function handleAddAsset() {
    dismiss();
    setLocation("/assets?add=1");
  }

  const isLast = currentIdx === SLIDE_META.length - 1;
  const meta = SLIDE_META[currentIdx]!;
  const n = currentIdx + 1;

  return (
    <>
      <style>{`
        @keyframes wFadeUp {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>

      <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden" hideCloseButton>
          <DialogTitle className="sr-only">{t("welcome.heading")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("welcome.progress", { current: n, total: SLIDE_META.length })}
          </DialogDescription>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("welcome.heading")}
              </p>
              <h2 className="text-sm font-medium text-foreground mt-0.5">
                {t("welcome.progress", { current: n, total: SLIDE_META.length })}
              </h2>
            </div>
            <button
              onClick={dismiss}
              className="rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Slide */}
          <div className="px-5">
            <SlideContent
              meta={meta}
              title={t(`welcome.slide${n}Title`)}
              body={t(`welcome.slide${n}Body`)}
              tip={t(`welcome.slide${n}Tip`)}
              tipLabel={t("welcome.tip")}
              animKey={animKey}
            />
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-1.5 py-4">
            {SLIDE_META.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === currentIdx
                    ? "w-5 h-2 bg-primary"
                    : "w-2 h-2 bg-muted-foreground/25 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Footer nav */}
          <div className="border-t px-5 py-4 flex items-center justify-between gap-3 bg-muted/20">
            <Button
              variant="ghost"
              size="sm"
              onClick={prev}
              disabled={currentIdx === 0}
              className="gap-1.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t("welcome.back")}
            </Button>

            {isLast ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={dismiss}>
                  {t("welcome.goToDashboard")}
                </Button>
                <Button size="sm" onClick={handleAddAsset} className="gap-1.5">
                  {t("welcome.addFirstAsset")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={next} className="gap-1.5">
                {t("welcome.next")}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
