import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[80vh] w-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      <div className="bg-secondary/50 p-6 rounded-full mb-6 relative">
        <div className="absolute inset-0 border-4 border-dashed border-muted rounded-full animate-[spin_10s_linear_infinite]" />
        <ShieldCheck className="h-16 w-16 text-muted-foreground opacity-50 relative z-10" />
      </div>
      <h1 className="text-5xl font-bold tracking-tight text-primary mb-3">404</h1>
      <h2 className="text-2xl font-semibold mb-2">{t("notFound.title")}</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        {t("notFound.body")}
      </p>
      <Button asChild size="lg" className="h-12 px-6 gap-2">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" />
          {t("notFound.cta")}
        </Link>
      </Button>
    </div>
  );
}
