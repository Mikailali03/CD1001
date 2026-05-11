import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useProperty } from "@/contexts/property-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Bell, Shield, User, ArrowRightLeft, Clock, X, Copy,
  CheckCircle2, Loader2, AlertTriangle, ShieldCheck, Home,
} from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type PendingTransfer = {
  id: string;
  propertyId: string;
  toEmail: string;
  fromEmail: string;
  token: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
};

function DeedTransferCard() {
  const { activePropertyId, activeProperty } = useProperty();
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();
  const { toast } = useToast();

  const [recipientEmail, setRecipientEmail] = useState("");
  const [fromEmail] = useState("alex@example.com");
  const [confirmStep, setConfirmStep] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: pendingTransfer, isLoading: transferLoading } = useQuery<PendingTransfer | null>({
    queryKey: ["property-transfer", activePropertyId],
    queryFn: async () => {
      if (!activePropertyId) return null;
      const res = await authFetch(`${BASE}/api/properties/${activePropertyId}/transfer`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  const inititateMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/properties/${activePropertyId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: recipientEmail, fromEmail }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Transfer failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-transfer", activePropertyId] });
      setRecipientEmail("");
      setConfirmStep(false);
      toast({ title: "Transfer initiated", description: "A claim link has been generated for the new owner." });
    },
    onError: (err: Error) => {
      toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
      setConfirmStep(false);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (transferId: string) => {
      const res = await authFetch(`${BASE}/api/transfers/${transferId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not cancel transfer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-transfer", activePropertyId] });
      toast({ title: "Transfer cancelled", description: "The escrow link has been revoked." });
    },
  });

  const claimUrl = pendingTransfer
    ? `${window.location.origin}${BASE}/claim/${pendingTransfer.token}`
    : null;

  function copyLink() {
    if (!claimUrl) return;
    navigator.clipboard.writeText(claimUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!activePropertyId || !activeProperty) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            Digital Deed Transfer
          </CardTitle>
          <CardDescription>Select a property to initiate a transfer.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={pendingTransfer ? "border-amber-300/60 bg-amber-50/30" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              Digital Deed Transfer
            </CardTitle>
            <CardDescription>
              Transfer the complete maintenance history of{" "}
              <span className="font-medium text-foreground">{activeProperty.name}</span> to a new owner.
            </CardDescription>
          </div>
          {pendingTransfer && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-300 shrink-0">
              <Clock className="h-3 w-3 mr-1" />
              In Escrow
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* ── Active escrow state ── */}
        {pendingTransfer && claimUrl && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <Clock className="h-4 w-4" />
                Awaiting claim by {pendingTransfer.toEmail}
              </div>
              <p className="text-xs text-amber-700">
                Initiated {format(new Date(pendingTransfer.createdAt), "MMM d, yyyy 'at' h:mm a")}.
                {pendingTransfer.expiresAt && (
                  <> Expires {format(new Date(pendingTransfer.expiresAt), "MMM d, yyyy")}.</>
                )}
              </p>

              {/* Claim link */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-amber-800">Claim Link — share with new owner:</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={claimUrl}
                    className="text-xs bg-white border-amber-200 h-8 font-mono"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 border-amber-300 hover:bg-amber-100 h-8"
                    onClick={copyLink}
                  >
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/60 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              The dossier stays with you until the new owner accepts. You can cancel at any time.
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 w-full"
              onClick={() => cancelMutation.mutate(pendingTransfer.id)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Cancel Transfer & Revoke Link
            </Button>
          </div>
        )}

        {/* ── Initiate form (no pending transfer) ── */}
        {!pendingTransfer && !transferLoading && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 text-sm text-muted-foreground">
              <Home className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <span>
                The new owner will receive a secure link to claim the full history — assets, service records, maintenance tasks, and AI reports — tied to this address, not to you.
              </span>
            </div>

            {!confirmStep ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="recipient-email">New Owner's Email</Label>
                  <Input
                    id="recipient-email"
                    type="email"
                    placeholder="newowner@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full gap-2"
                  disabled={!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)}
                  onClick={() => setConfirmStep(true)}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Transfer Home Dossier
                </Button>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Confirm Transfer
                </div>
                <p className="text-sm text-muted-foreground">
                  You are about to transfer the complete history of{" "}
                  <span className="font-semibold text-foreground">{activeProperty.name}</span> to{" "}
                  <span className="font-semibold text-foreground">{recipientEmail}</span>.
                  A claim link will be placed in escrow until they accept.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setConfirmStep(false)}
                    disabled={inititateMutation.isPending}
                  >
                    Go Back
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 bg-destructive hover:bg-destructive/90"
                    onClick={() => inititateMutation.mutate()}
                    disabled={inititateMutation.isPending}
                  >
                    {inititateMutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Initiating…</>
                    ) : (
                      <><ShieldCheck className="h-3.5 w-3.5" /> Confirm & Send to Escrow</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {transferLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking transfer status…
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and notifications.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover-elevate transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              Profile Information
            </CardTitle>
            <CardDescription>Update your personal details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue="Alex Homeowner" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue="alex@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" defaultValue="(555) 123-4567" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              Notifications
            </CardTitle>
            <CardDescription>Choose what alerts you receive.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Maintenance Reminders</Label>
                <p className="text-sm text-muted-foreground">Get notified when tasks are due.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Service Updates</Label>
                <p className="text-sm text-muted-foreground">Alerts when pros update your records.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Marketing Emails</Label>
                <p className="text-sm text-muted-foreground">Tips, guides, and promotions.</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Deed Transfer — full width */}
        <div className="md:col-span-2">
          <DeedTransferCard />
        </div>

        <Card className="hover-elevate transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Security
            </CardTitle>
            <CardDescription>Manage your password and authentication.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" />
            </div>
            <Button variant="outline">Update Password</Button>
          </CardContent>
        </Card>

        <Card className="bg-muted/50 border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Pro Settings</CardTitle>
            <CardDescription>For service professionals and inspectors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enable Pro Mode to access marketplace features and quick intake forms.
            </p>
            <div className="flex items-center justify-between bg-background p-4 rounded-lg border">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Pro Mode</Label>
                <p className="text-xs text-muted-foreground">Unlock inspector tools</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
