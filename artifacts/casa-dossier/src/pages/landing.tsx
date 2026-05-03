import { Link } from "wouter";
import { ShieldCheck, Wrench, FileText, TrendingUp, Star, ArrowRight, CheckCircle2, Home, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: ShieldCheck,
    title: "Full Property History",
    description: "Every repair, upgrade, and service visit logged and searchable — like a Carfax report but for your home.",
  },
  {
    icon: Wrench,
    title: "AI Maintenance Planner",
    description: "Scan any appliance data tag and our AI instantly generates a personalized maintenance schedule based on your exact model.",
  },
  {
    icon: TrendingUp,
    title: "Capital Outlook",
    description: "Know what's coming. See upcoming replacement costs and plan your home investment years in advance.",
  },
  {
    icon: FileText,
    title: "Official Property Dossier",
    description: "Generate a printable, verified record of your home — perfect for home sales, insurance claims, or refinancing.",
  },
  {
    icon: Package,
    title: "Asset Inventory",
    description: "Track every appliance, system, and fixture with model numbers, serial numbers, warranties, and service records.",
  },
  {
    icon: Home,
    title: "Health Score",
    description: "Get a real-time grade on your home's condition and a clear improvement plan to protect your investment.",
  },
];

const benefits = [
  "Increase resale value with a documented home history",
  "Never miss a warranty claim again",
  "Know your replacement costs before they surprise you",
  "Transfer your complete home record to the next owner",
];

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

      {/* Benefits strip */}
      <section className="bg-primary/5 border-y py-8">
        <div className="max-w-6xl mx-auto px-6">
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

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything your home needs in one place</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Built for homeowners who care about protecting their biggest asset.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="border rounded-xl p-6 bg-card hover:shadow-md transition-shadow">
              <div className="bg-primary/10 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
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
