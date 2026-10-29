import { Link } from "wouter";
import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck, Wrench, FileText, TrendingUp, Star, ArrowRight,
  CheckCircle2, Home, Package, ChevronLeft, ChevronRight,
  Hash, Cpu, ClipboardList, Quote, Pause, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";

const FEATURE_META = [
  { icon: ShieldCheck, accent: "from-blue-500/20 to-indigo-500/10", iconBg: "bg-blue-500/15", iconColor: "text-blue-600 dark:text-blue-400" },
  { icon: Wrench,      accent: "from-violet-500/20 to-purple-500/10", iconBg: "bg-violet-500/15", iconColor: "text-violet-600 dark:text-violet-400" },
  { icon: TrendingUp,  accent: "from-emerald-500/20 to-teal-500/10", iconBg: "bg-emerald-500/15", iconColor: "text-emerald-600 dark:text-emerald-400" },
  { icon: FileText,    accent: "from-amber-500/20 to-orange-500/10", iconBg: "bg-amber-500/15", iconColor: "text-amber-600 dark:text-amber-400" },
  { icon: Package,     accent: "from-rose-500/20 to-pink-500/10", iconBg: "bg-rose-500/15", iconColor: "text-rose-600 dark:text-rose-400" },
  { icon: Home,        accent: "from-cyan-500/20 to-sky-500/10", iconBg: "bg-cyan-500/15", iconColor: "text-cyan-600 dark:text-cyan-400" },
] as const;

const TECH_ICONS = [Hash, ClipboardList, Cpu] as const;

const INTERVAL_MS = 4000;

// Scroll-reveal for landing sections. Content must never stay hidden: it
// shows immediately for reduced-motion users or without IntersectionObserver,
// and a timeout reveals it anyway if the observer never fires.
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(
    () => reducedMotion || typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    if (reducedMotion) { setVisible(true); return; }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    const fallback = setTimeout(() => setVisible(true), 3000);
    return () => { observer.disconnect(); clearTimeout(fallback); };
  }, [reducedMotion]);

  const style = (distance: number, easing = "cubic-bezier(0.22,1,0.36,1)", duration = "0.7s"): React.CSSProperties =>
    reducedMotion
      ? {}
      : {
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : `translateY(${distance}px)`,
          transition: `opacity ${duration} ${easing}, transform ${duration} ${easing}`,
        };

  return { ref, visible, style };
}

function FeatureCarousel() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { ref, style } = useFadeIn();
  const reducedMotion = usePrefersReducedMotion();
  // Autoplay is off for reduced-motion users; everyone else can pause it.
  // It also holds while the pointer or keyboard focus is inside the carousel.
  const [paused, setPaused] = useState(reducedMotion);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const autoplay = !paused && !reducedMotion && !hovered && !focused;

  const features = FEATURE_META.map((meta, i) => ({
    ...meta,
    title: t(`landing.feature${i + 1}Title`),
    description: t(`landing.feature${i + 1}Desc`),
  }));

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!autoplay) return;
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % features.length);
      setAnimKey((k) => k + 1);
    }, INTERVAL_MS);
  }, [features.length, autoplay]);

  const go = useCallback((next: number) => {
    setCurrent(next);
    setAnimKey((k) => k + 1);
    resetTimer();
  }, [resetTimer]);

  const prev = useCallback(() => {
    go((current - 1 + features.length) % features.length);
  }, [current, features.length, go]);

  const next = useCallback(() => {
    go((current + 1) % features.length);
  }, [current, features.length, go]);

  const goTo = useCallback((i: number) => {
    if (i !== current) go(i);
  }, [current, go]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const f = features[current]!;

  return (
    <section className="max-w-6xl mx-auto px-6 py-24">
      <div ref={ref} style={style(48)}>
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{t("landing.featuresSectionTitle")}</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {t("landing.featuresSectionSubtitle")}
          </p>
        </div>

        <div
          className="max-w-2xl mx-auto"
          role="region"
          aria-roledescription="carousel"
          aria-label={t("landing.carouselLabel")}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
        >
          <div className="relative overflow-hidden rounded-2xl border bg-card shadow-xl">
            <div
              key={animKey}
              className={`bg-gradient-to-br ${f.accent}`}
              style={reducedMotion ? undefined : { animation: "fadeUp 1.5s cubic-bezier(0.22,1,0.36,1) both" }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${current + 1} / ${features.length}`}
              aria-live={autoplay ? "off" : "polite"}
            >
              <div className="flex flex-col items-center text-center min-h-[320px] py-10 px-8 justify-center gap-6">
                <div className={`${f.iconBg} rounded-2xl p-6 shadow-inner`}>
                  <f.icon className={`h-14 w-14 ${f.iconColor}`} strokeWidth={1.25} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    {current + 1} / {features.length}
                  </div>
                  <h3 className="text-2xl font-bold mb-3 leading-tight">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">{f.description}</p>
                </div>
              </div>
            </div>

            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur border rounded-full p-2 shadow-sm hover:bg-background transition-colors"
              aria-label={t("landing.previousSlide")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur border rounded-full p-2 shadow-sm hover:bg-background transition-colors"
              aria-label={t("landing.nextSlide")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6">
            {!reducedMotion && (
              <button
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? t("landing.playCarousel") : t("landing.pauseCarousel")}
                aria-pressed={paused}
                className="mr-2 rounded-full border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
            )}
            {features.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={t("landing.goToSlide", { n: i + 1 })}
                aria-current={i === current ? "true" : undefined}
                style={{
                  width: i === current ? "28px" : "8px",
                  opacity: i === current ? 1 : 0.35,
                  transition: reducedMotion ? undefined : "width 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease",
                }}
                className="h-2 rounded-full bg-primary"
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </section>
  );
}

function BenefitsStrip() {
  const { t } = useTranslation();
  const { ref, style } = useFadeIn();

  const benefits = [
    t("landing.benefit1"),
    t("landing.benefit2"),
    t("landing.benefit3"),
    t("landing.benefit4"),
  ];

  return (
    <section className="bg-primary/5 border-y py-8">
      <div
        ref={ref}
        className="max-w-6xl mx-auto px-6"
        style={style(24, "ease", "0.6s")}
      >
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="text-sm font-medium">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TechQuoteSection() {
  const { t } = useTranslation();
  const { ref, style } = useFadeIn();

  const techDetails = TECH_ICONS.map((Icon, i) => ({
    icon: Icon,
    label: t(`landing.tech${i + 1}Label`),
    detail: t(`landing.tech${i + 1}Detail`),
  }));

  return (
    <section className="max-w-6xl mx-auto px-6 py-24">
      <div
        ref={ref}
        className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        style={style(32)}
      >
        <div className="relative">
          <div className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1621905251918-48416bd8575a?q=80&w=900&auto=format&fit=crop"
              alt={t("landing.techImageAlt")}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="bg-white/95 backdrop-blur rounded-xl p-5 shadow-xl border border-white/60">
              <Quote className="h-6 w-6 text-primary/30 mb-2" />
              <p className="text-foreground text-base font-medium leading-snug">
                {t("landing.quoteText")}{" "}
                <em className="text-primary font-semibold not-italic italic">{t("landing.quoteEmphasis")}</em>
              </p>
              <p className="text-muted-foreground text-sm mt-1.5">
                {t("landing.quoteDetail")}
              </p>
              <div className="flex items-center gap-2.5 mt-3 pt-3 border-t">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">M</div>
                <div>
                  <p className="text-xs font-semibold leading-none">{t("landing.quoteAuthor")}</p>
                  <p className="text-xs text-muted-foreground">{t("landing.quoteLocation")}</p>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <Wrench className="h-3 w-3" />
              {t("landing.prosArrivePrepared")}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              {t("landing.assetDataTravels")}<br />
              <span className="text-primary">{t("landing.withEveryRequest")}</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {t("landing.prosDesc")}
            </p>
          </div>

          <div className="space-y-5">
            {techDetails.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="flex gap-4 items-start">
                <div className="shrink-0 h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-0.5">{label}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{detail}</p>
                </div>
              </div>
            ))}
          </div>

          <Button asChild className="gap-2 mt-2">
            <Link href="/sign-up">
              {t("landing.startDocumenting")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  const { t } = useTranslation();
  const { ref, style } = useFadeIn();
  return (
    <section className="bg-primary text-primary-foreground py-20">
      <div
        ref={ref}
        className="max-w-3xl mx-auto px-6 text-center"
        style={style(32)}
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          {t("landing.ctaTitle")}
        </h2>
        <p className="text-primary-foreground/80 text-lg mb-8">
          {t("landing.ctaSubtitle")}
        </p>
        <Button asChild size="lg" variant="secondary" className="gap-2 px-8 h-12 text-base font-semibold">
          <Link href="/sign-up">
            {t("landing.createFreeAccount")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

export default function Landing() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary rounded-lg p-1.5">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-primary">Casa Dossier</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">{t("landing.logIn")}</Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/sign-up">
                {t("landing.getStarted")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Star className="h-3 w-3" />
          {t("landing.tagline")}
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          {t("landing.heroTitle")}
          <br />
          <span className="text-primary">{t("landing.heroHighlight")}</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
          {t("landing.heroSubtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="gap-2 px-8 h-12 text-base font-semibold">
            <Link href="/sign-up">
              {t("landing.createFreeAccount")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2 px-8 h-12 text-base font-medium">
            <Link href="/demo">
              <Star className="h-4 w-4 text-amber-500" />
              {t("landing.seeDemo")}
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">{t("landing.noCreditCard")}</p>
      </section>

      <BenefitsStrip />
      <FeatureCarousel />
      <TechQuoteSection />
      <CtaSection />

      {/* Footer */}
      <footer className="border-t py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="bg-primary rounded-md p-1">
            <ShieldCheck className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-primary">Casa Dossier</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("landing.footerCopy", { year: new Date().getFullYear() })}
        </p>
      </footer>
    </div>
  );
}
