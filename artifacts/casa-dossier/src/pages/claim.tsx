import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Home,
  CheckCircle2,
  XCircle,
  ArrowRight,
  MapPin,
  FileText,
  Loader2,
  ShieldCheck,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ClaimData = {
  transfer: {
    id: string;
    propertyId: string;
    fromEmail: string;
    toEmail: string;
    status: string;
    expiresAt: string | null;
  };
  property: {
    id: string;
    name: string;
    address: string;
    city: string | null;
    state: string | null;
    yearBuilt: number | null;
    sqft: number | null;
  } | null;
};

export default function ClaimTransfer() {
  const [, params] = useRoute("/claim/:token");
  const [, navigate] = useLocation();
  const token = params?.token ?? "";

  const [data, setData] = useState<ClaimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/api/transfers/claim/${token}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          setErrorStatus(body.status ?? null);
          setError(body.error ?? "Something went wrong.");
        } else {
          setData(body);
        }
      })
      .catch(() => setError("Could not load transfer details."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleClaim() {
    setClaiming(true);
    try {
      const res = await fetch(`${BASE}/api/transfers/claim/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Transfer failed.");
        return;
      }
      setClaimed(true);
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-4">
            <Skeleton className="h-14 w-14 rounded-full mx-auto mb-3" />
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-10 rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (claimed && data?.property) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Transfer Complete!</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              You now own the home dossier for{" "}
              <span className="font-semibold text-foreground">{data.property.name}</span>.
              The full maintenance history, assets, and records are yours.
            </p>
          </div>
          <Card className="text-left">
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{data.property.name}</span>
              </div>
              {(data.property.city || data.property.state) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {[data.property.city, data.property.state].filter(Boolean).join(", ")}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4 shrink-0" />
                Full maintenance history transferred
              </div>
            </CardContent>
          </Card>
          <Button className="w-full gap-2" onClick={() => navigate("/")}>
            Open Your Home Dossier
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="bg-muted w-20 h-20 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {errorStatus === "completed" ? "Already Claimed" : errorStatus === "cancelled" ? "Transfer Cancelled" : "Link Unavailable"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">{error}</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/")}>
            <Home className="h-4 w-4" />
            Go to Casa Dossier
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { property, transfer } = data;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Home Dossier Transfer</h1>
            <p className="text-muted-foreground text-sm mt-1">
              <span className="font-medium text-foreground">{transfer.fromEmail}</span> has transferred a home dossier to you.
            </p>
          </div>
        </div>

        {/* Property card */}
        {property && (
          <Card className="border-2 border-primary/20 bg-primary/3">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2.5 rounded-xl shrink-0 mt-0.5">
                  <Home className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-base">{property.name}</p>
                  <p className="text-sm text-muted-foreground">{property.address}</p>
                  {(property.city || property.state) && (
                    <p className="text-sm text-muted-foreground">
                      {[property.city, property.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="border-t pt-3 grid grid-cols-2 gap-2">
                {property.yearBuilt && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Built </span>
                    <span className="font-semibold">{property.yearBuilt}</span>
                  </div>
                )}
                {property.sqft && (
                  <div className="text-xs">
                    <span className="font-semibold">{property.sqft.toLocaleString()}</span>
                    <span className="text-muted-foreground"> sq ft</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* What's included */}
        <div className="bg-muted/50 rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">What you'll receive</p>
          {[
            "Full maintenance task history",
            "All tracked assets & appliances",
            "Service records & technician logs",
            "AI-generated health reports",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              {item}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-2">
          <Button className="w-full gap-2 h-11" onClick={handleClaim} disabled={claiming}>
            {claiming ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Accepting Transfer…</>
            ) : (
              <><ShieldCheck className="h-4 w-4" /> Accept & Claim This Home Dossier</>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            By accepting, you take ownership of this property's complete history.
          </p>
        </div>
      </div>
    </div>
  );
}
