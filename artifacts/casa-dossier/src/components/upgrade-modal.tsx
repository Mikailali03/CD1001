import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription, type SubscriptionTier } from "@/contexts/subscription-context";
import { useToast } from "@/hooks/use-toast";
import {
  Check,
  Sparkles,
  Shield,
  Crown,
  Loader2,
  Star,
  Zap,
  ExternalLink,
  Settings,
} from "lucide-react";

type Plan = {
  id: SubscriptionTier;
  name: string;
  price: string;
  priceNote: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
  features: string[];
  paid: boolean;
};

const PLANS: Plan[] = [
  {
    id: "essential",
    name: "Essential",
    price: "Free",
    priceNote: "forever",
    icon: <Shield className="h-5 w-5" />,
    color: "text-muted-foreground",
    paid: false,
    features: [
      "1 property",
      "AI-generated maintenance plan",
      "Asset tracking & health score",
      "Service history log",
      "DIY guides library",
      "Maintenance inbox",
    ],
  },
  {
    id: "managed",
    name: "Managed",
    price: "$35",
    priceNote: "/ month",
    icon: <Star className="h-5 w-5" />,
    color: "text-blue-600",
    badge: "Popular",
    paid: true,
    features: [
      "Up to 5 properties",
      "Professional onboarding for each home",
      "Home health check included",
      "Quarterly HVAC filter delivery & installation",
      "15% off CasaService calls",
      "1 free service credit / year",
      "Annual visual inspection of all systems",
    ],
  },
  {
    id: "concierge",
    name: "Concierge",
    price: "$99",
    priceNote: "/ month",
    icon: <Crown className="h-5 w-5" />,
    color: "text-amber-600",
    badge: "Best Value",
    paid: true,
    features: [
      "Unlimited properties",
      "Professional onboarding for every home",
      "Home health check included",
      "Same-day priority support",
      "25% off CasaService calls",
      "4 free service credits / year",
      "Dedicated home advisor",
    ],
  },
];

const TIER_ORDER: Record<SubscriptionTier, number> = { essential: 0, managed: 1, concierge: 2 };

export function UpgradeModal() {
  const { subscription, upgradeModalOpen, closeUpgradeModal, upgradeTo, startCheckout, openBillingPortal } = useSubscription();
  const { toast } = useToast();
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const currentTier = subscription?.tier ?? "essential";
  const hasStripeSubscription = Boolean(subscription?.stripeSubscriptionId);

  async function handleAction(plan: Plan) {
    if (plan.id === currentTier) return;

    setLoadingTier(plan.id);
    try {
      if (plan.id === "essential") {
        // Downgrade: use internal API (could also go through portal)
        await upgradeTo("essential");
        toast({ title: "Downgraded to Essential", description: "Your plan has been updated." });
        closeUpgradeModal();
      } else if (hasStripeSubscription) {
        // Already has Stripe subscription — send to billing portal to switch plans
        await openBillingPortal();
      } else {
        // New paid subscription — Stripe Checkout
        await startCheckout(plan.id as "managed" | "concierge");
        // startCheckout redirects, so this line is only reached on error
      }
    } catch (err: any) {
      toast({
        title: "Something went wrong",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTier(null);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      await openBillingPortal();
    } catch {
      toast({ title: "Could not open billing portal", variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <Dialog open={upgradeModalOpen} onOpenChange={closeUpgradeModal}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="bg-primary/10 p-3 rounded-full">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold">Choose Your Plan</DialogTitle>
          <DialogDescription className="text-base">
            Upgrade to manage more properties and unlock premium services.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3 mt-2">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentTier;
            const isDowngrade = TIER_ORDER[plan.id] < TIER_ORDER[currentTier];
            const isUpgrade = TIER_ORDER[plan.id] > TIER_ORDER[currentTier];
            const isLoading = loadingTier === plan.id;
            const isPaidSwitch = hasStripeSubscription && !isCurrent && plan.paid;

            function getButtonLabel() {
              if (isCurrent) return <><Check className="h-3.5 w-3.5" />Active</>;
              if (isLoading) return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
              if (isPaidSwitch) return <><ExternalLink className="h-3.5 w-3.5" />Switch Plan</>;
              if (isUpgrade && plan.paid) return <><Zap className="h-3.5 w-3.5" />Upgrade — ${plan.price.replace("$", "")}/mo</>;
              if (isDowngrade) return "Downgrade";
              return <><Zap className="h-3.5 w-3.5" />Upgrade</>;
            }

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border-2 p-5 flex flex-col gap-4 transition-all ${
                  plan.id === "managed"
                    ? "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800"
                    : isCurrent
                    ? "border-primary/30 bg-primary/5"
                    : "border-border"
                }`}
              >
                {plan.badge && !isCurrent && (
                  <Badge className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 ${
                    plan.id === "managed" ? "bg-blue-600 text-white" : "bg-amber-500 text-white"
                  }`}>
                    {plan.badge}
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 bg-primary text-primary-foreground">
                    Current Plan
                  </Badge>
                )}

                <div>
                  <div className={`flex items-center gap-2 mb-1 ${plan.color}`}>
                    {plan.icon}
                    <span className="font-bold text-sm">{plan.name}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{plan.price}</span>
                    <span className="text-xs text-muted-foreground">{plan.priceNote}</span>
                  </div>
                </div>

                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="sm"
                  variant={isCurrent ? "outline" : plan.id === "managed" ? "default" : "outline"}
                  className={`w-full gap-1.5 ${
                    plan.id === "concierge" && !isCurrent
                      ? "border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
                      : ""
                  }`}
                  disabled={isCurrent || isLoading}
                  onClick={() => handleAction(plan)}
                >
                  {getButtonLabel()}
                </Button>
              </div>
            );
          })}
        </div>

        {hasStripeSubscription && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
            <span>Manage billing, invoices, and payment methods</span>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={portalLoading}
              onClick={handleManageBilling}
            >
              {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
              Billing Portal
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-2">
          {hasStripeSubscription
            ? "Subscription changes take effect immediately."
            : "Secure checkout powered by Stripe. Cancel anytime."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
