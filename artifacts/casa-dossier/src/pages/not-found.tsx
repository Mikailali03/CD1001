import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] w-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      <div className="bg-secondary/50 p-6 rounded-full mb-6 relative">
        <div className="absolute inset-0 border-4 border-dashed border-muted rounded-full animate-[spin_10s_linear_infinite]" />
        <ShieldCheck className="h-16 w-16 text-muted-foreground opacity-50 relative z-10" />
      </div>
      <h1 className="text-5xl font-bold tracking-tight text-primary mb-3">404</h1>
      <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        We couldn't find the page you're looking for. It might have been moved, deleted, or you may have mistyped the URL.
      </p>
      <Link href="/">
        <Button size="lg" className="h-12 px-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
