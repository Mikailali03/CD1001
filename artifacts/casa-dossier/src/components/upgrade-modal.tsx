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
  Building2,
  Wrench,
  Star,
  Zap,
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
  propertyLimit: string;
};

const PLANS: Plan[] = [
  {
    id: "essential",
    name: "Essential",
    price: "Free",
    priceNote: "forever",
    icon: <Shield className="h-5 w-5" />,
    color: "text-muted-foreground",
    features: [
      "1 property",
      "AI-generated maintenance plan",
      "Asset tracking & health score",
      "Service history log",
      "DIY guides library",
      "Maintenance inbox",
    ],
    propertyLimit: "1 property",
  },
  {
    id: "managed",
    name: "Managed",
    price: "$35",
    priceNote: "/ month",
    icon: <Star className="h-5 w-5" />,
    color: "text-blue-600",
    badge: "Popular",
    features: [
      "Up to 5 properties",
      "Professional onboarding for each home",
      "Home health check included",
      "Quarterly HVAC filter delivery & installation",
      "15% off CasaService calls",
      "1 free service credit / year",
      "Annual visual inspection of all systems",
    ],
    propertyLimit: "Up to 5 properties",
  },
  {
    id: "concierge",
    name: "Concierge",
    price: "$99",
    priceNote: "/ month",
    icon: <Crown className="h-5 w-5" />,
    color: "text-amber-600",
    badge: "Best Value",
    features: [
      "Unlimited properties",
      "Professional onboarding for every home",
      "Home health check included",
      "Same-day priority support",
      "25% off CasaService calls",
      "4 free service credits / year",
      "Dedicated home advisor",
    ],
    propertyLimit: "Unlimited properties",
  },
];

export function UpgradeModal() {
  const { subscription, upgradeModalOpen, closeUpgradeModal, upgradeTo } = useSubscription();
  const { toast } = useToast();
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);

  const currentTier = subscription?.tier ?? "essential";

  async function handleUpgrade(tier: SubscriptionTier) {
    if (tier === currentTier) return;
    setLoadingTier(tier);
    try {
      await upgradeTo(tier);
      toast({
        title: `Upgraded to ${tier.charAt(0).toUpperCase() + tier.slice(1)}!`,
        description: "Your plan has been updated.",
      });
      closeUpgradeModal();
    } catch {
      toast({ title: "Upgrade failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoadingTier(null);
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
            const tierOrder = { essential: 0, managed: 1, concierge: 2 };
            const isDowngrade = tierOrder[plan.id] < tierOrder[currentTier];
            const isLoading = loadingTier === plan.id;

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
                {plan.badge && (
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
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isCurrent ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Active
                    </>
                  ) : isDowngrade ? (
                    "Downgrade"
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5" />
                      Upgrade
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Changes take effect immediately. Cancel anytime.
        </p>
      </DialogContent>
    </Dialog>
  );
}
