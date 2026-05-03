import { Link } from "wouter";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ShieldCheck, Wrench, FileText, TrendingUp, Star, ArrowRight,
  CheckCircle2, Home, Package, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: ShieldCheck,
    title: "Full Property History",
    description: "Every repair, upgrade, and service visit logged and searchable — like a Carfax report but for your home.",
    accent: "from-blue-500/20 to-indigo-500/10",
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: Wrench,
    title: "AI Maintenance Planner",
    description: "Scan any appliance data tag and our AI instantly generates a personalized maintenance schedule based on your exact model.",
    accent: "from-violet-500/20 to-purple-500/10",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: TrendingUp,
    title: "Capital Outlook",
    description: "Know what's coming. See upcoming replacement costs and plan your home investment years in advance.",
    accent: "from-emerald-500/20 to-teal-500/10",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: FileText,
    title: "Official Property Dossier",
    description: "Generate a printable, verified record of your home — perfect for home sales, insurance claims, or refinancing.",
    accent: "from-amber-500/20 to-orange-500/10",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    icon: Package,
    title: "Asset Inventory",
    description: "Track every appliance, system, and fixture with model numbers, serial numbers, warranties, and service records.",
    accent: "from-rose-500/20 to-pink-500/10",
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    icon: Home,
    title: "Home Health Score",
    description: "Get a real-time grade on your home's condition and a clear improvement plan to protect your biggest investment.",
    accent: "from-cyan-500/20 to-sky-500/10",
    iconBg: "bg-cyan-500/15",
    iconColor: "text-cyan-600 dark:text-cyan-400",
  },
];

const benefits = [
  "Increase resale value with a documented home history",
  "Never miss a warranty claim again",
  "Know your replacement costs before they surprise you",
  "Transfer your complete home record to the next owner",
];

const INTERVAL_MS = 4000;

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function FeatureCarousel() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [animKey, setAnimKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { ref, visible } = useFadeIn();

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDirection("right");
      setCurrent((c) => (c + 1) % features.length);
      setAnimKey((k) => k + 1);
    }, INTERVAL_MS);
  }, []);

  const go = useCallback((next: number, dir: "left" | "right") => {
    setDirection(dir);
    setCurrent(next);
    setAnimKey((k) => k + 1);
    resetTimer();
  }, [resetTimer]);

  const prev = useCallback(() => {
    go((current - 1 + features.length) % features.length, "left");
  }, [current, go]);

  const next = useCallback(() => {
    go((current + 1) % features.length, "right");
  }, [current, go]);

  const goTo = useCallback((i: number) => {
    if (i === current) return;
    go(i, i > current ? "right" : "left");
  }, [current, go]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const f = features[current]!;

  return (
    <section className="max-w-6xl mx-auto px-6 py-24">
      <div
        ref={ref}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(48px)",
          transition: "opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything your home needs in one place</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Built for homeowners who care about protecting their biggest asset.
          </p>
        </div>

        {/* Narrowed carousel wrapper */}
        <div className="max-w-2xl mx-auto">
          {/* Carousel container */}
          <div className="relative overflow-hidden rounded-2xl border bg-card shadow-xl">
            {/* Slide — keyed so CSS animation fires fresh on each change */}
            <div
              key={animKey}
              className={`bg-gradient-to-br ${f.accent}`}
              style={{
                animation: "fadeUp 1.5s cubic-bezier(0.22,1,0.36,1) both",
              }}
            >
              <div className="flex flex-col items-center text-center min-h-[320px] py-10 px-8 justify-center gap-6">
                {/* Icon */}
                <div className={`${f.iconBg} rounded-2xl p-6 shadow-inner`}>
                  <f.icon className={`h-14 w-14 ${f.iconColor}`} strokeWidth={1.25} />
                </div>

                {/* Text */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    {current + 1} / {features.length}
                  </div>
                  <h3 className="text-2xl font-bold mb-3 leading-tight">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">{f.description}</p>
                </div>
              </div>
            </div>

            {/* Nav arrows */}
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur border rounded-full p-2 shadow-sm hover:bg-background transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur border rounded-full p-2 shadow-sm hover:bg-background transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {features.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                style={{
                  width: i === current ? "28px" : "8px",
                  opacity: i === current ? 1 : 0.35,
                  transition: "width 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease",
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
  const { ref, visible } = useFadeIn();
  return (
    <section className="bg-primary/5 border-y py-8">
      <div
        ref={ref}
        className="max-w-6xl mx-auto px-6"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(24px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
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

function CtaSection() {
  const { ref, visible } = useFadeIn();
  return (
    <section className="bg-primary text-primary-foreground py-20">
      <div
        ref={ref}
        className="max-w-3xl mx-auto px-6 text-center"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(32px)",
          transition: "opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Start your home's permanent record today
        </h2>
        <p className="text-primary-foreground/80 text-lg mb-8">
          Join homeowners who are taking control of their home's history, health, and value.
        </p>
        <Link href="/sign-up">
          <Button size="lg" variant="secondary" className="gap-2 px-8 h-12 text-base font-semibold">
            Create Free Account
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

export default function Landing() {
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
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">Log In</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="gap-1.5">
                Get Started <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Star className="h-3 w-3" />
          The Home Maintenance OS for Modern Homeowners
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          Your Home Has a History.
          <br />
          <span className="text-primary">Start Documenting It.</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
          Casa Dossier is the Carfax for homes — a living record of every repair, appliance, upgrade, and service visit. Know your home. Protect your investment. Transfer your history.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/sign-up">
            <Button size="lg" className="gap-2 px-8 h-12 text-base font-semibold">
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="gap-2 px-8 h-12 text-base">
              Log In to Your Account
            </Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-4">No credit card required</p>
      </section>

      <BenefitsStrip />
      <FeatureCarousel />
      <CtaSection />

      {/* Footer */}
      <footer className="border-t py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="bg-primary rounded-md p-1">
            <ShieldCheck className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-primary">Casa Dossier</span>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Casa Dossier. Your Home, Documented.</p>
      </footer>
    </div>
  );
}
