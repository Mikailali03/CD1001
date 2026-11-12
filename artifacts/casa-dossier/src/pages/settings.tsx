import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation, Trans } from "react-i18next";
import { useProperty } from "@/contexts/property-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/field-error";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Bell, Shield, User, ArrowRightLeft, Clock, X, Copy,
  CheckCircle2, Loader2, AlertTriangle, ShieldCheck, Home, LayoutDashboard, ArrowRight,
} from "lucide-react";
import { format } from "@/lib/date";
import { Link } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import {
  useGetUserProfile,
  getGetUserProfileQueryKey,
  upsertUserProfile,
  useGetPendingPropertyTransfer,
  getGetPendingPropertyTransferQueryKey,
  useInitiatePropertyTransfer,
  useCancelPropertyTransfer,
  useListLockerFiles,
  getListLockerFilesQueryKey,
  useGetNotificationPreferences,
  getGetNotificationPreferencesQueryKey,
  updateNotificationPreferences,
  setReminderSubscription,
  type NotificationPreferences,
  type UpdateNotificationPreferencesBody,
} from "@workspace/api-client-react";

// App base path (not the API), used to build the shareable claim link.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function DeedTransferCard() {
  const { activePropertyId, activeProperty } = useProperty();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [recipientEmail, setRecipientEmail] = useState("");
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [confirmStep, setConfirmStep] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Locker documents tagged to this home can go with it.
  const { data: lockerFiles = [] } = useListLockerFiles(undefined, { query: { queryKey: getListLockerFilesQueryKey() } });
  const homeDocumentCount = lockerFiles.filter((f) => f.propertyId && f.propertyId === activePropertyId).length;

  const transferKey = getGetPendingPropertyTransferQueryKey(activePropertyId ?? "");
  const { data: pendingTransfer, isLoading: transferLoading } = useGetPendingPropertyTransfer(
    activePropertyId ?? "",
    { query: { queryKey: transferKey, enabled: !!activePropertyId } },
  );

  const inititateMutation = useInitiatePropertyTransfer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: transferKey });
        setRecipientEmail("");
        setConfirmStep(false);
        toast({ title: t("settings.transfer.toast.initiated"), description: t("settings.transfer.toast.initiatedDesc") });
      },
      onError: (err) => {
        toast({
          title: t("settings.transfer.toast.failed"),
          description: err.data?.error ?? t("settings.transfer.toast.failed"),
          variant: "destructive",
        });
        setConfirmStep(false);
      },
    },
  });

  const cancelMutation = useCancelPropertyTransfer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: transferKey });
        toast({ title: t("settings.transfer.toast.cancelled"), description: t("settings.transfer.toast.cancelledDesc") });
      },
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
            {t("settings.transfer.title")}
          </CardTitle>
          <CardDescription>{t("settings.transfer.selectProperty")}</CardDescription>
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
              {t("settings.transfer.title")}
            </CardTitle>
            <CardDescription>
              <Trans
                i18nKey="settings.transfer.description"
                values={{ name: activeProperty.name }}
                components={{ strong: <span className="font-medium text-foreground" /> }}
              />
            </CardDescription>
          </div>
          {pendingTransfer && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-300 shrink-0">
              <Clock className="h-3 w-3 mr-1" />
              {t("settings.transfer.inEscrow")}
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
                {t("settings.transfer.awaitingClaim", { email: pendingTransfer.toEmail })}
              </div>
              <p className="text-xs text-amber-700">
                {t("settings.transfer.initiatedOn", {
                  date: format(new Date(pendingTransfer.createdAt), "PP"),
                  time: format(new Date(pendingTransfer.createdAt), "p"),
                })}
                {pendingTransfer.expiresAt && (
                  <> {t("settings.transfer.expiresOn", { date: format(new Date(pendingTransfer.expiresAt), "PP") })}</>
                )}
              </p>

              {/* Claim link */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-amber-800">{t("settings.transfer.claimLinkLabel")}</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    aria-label={t("settings.transfer.claimLinkAria")}
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
                    {copied ? t("settings.transfer.copied") : t("settings.transfer.copy")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/60 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              {t("settings.transfer.staysWithYou")}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 w-full"
              onClick={() => cancelMutation.mutate({ transferId: pendingTransfer.id })}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              {t("settings.transfer.cancelAndRevoke")}
            </Button>
          </div>
        )}

        {/* ── Initiate form (no pending transfer) ── */}
        {!pendingTransfer && !transferLoading && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 text-sm text-muted-foreground">
              <Home className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <span>
                {t("settings.transfer.explainer")}
              </span>
            </div>

            {!confirmStep ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="recipient-email">{t("settings.transfer.newOwnerEmail")} <span className="text-destructive" aria-hidden="true">*</span></Label>
                  <Input
                    id="recipient-email"
                    type="email"
                    placeholder={t("settings.transfer.emailPlaceholder")}
                    value={recipientEmail}
                    onChange={(e) => { setRecipientEmail(e.target.value); if (emailError) setEmailError(null); }}
                    required
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? "recipient-email-error" : undefined}
                  />
                  <FieldError id="recipient-email-error" message={emailError} />
                </div>
                {homeDocumentCount > 0 && (
                  <Label className="flex items-start gap-2.5 text-sm font-normal cursor-pointer">
                    <Checkbox
                      checked={includeDocuments}
                      onCheckedChange={(v) => setIncludeDocuments(v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      {t("settings.transfer.includeDocuments", { count: homeDocumentCount })}
                      <span className="block text-xs text-muted-foreground">{t("settings.transfer.includeDocumentsHint")}</span>
                    </span>
                  </Label>
                )}
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    const trimmed = recipientEmail.trim();
                    if (!trimmed) { setEmailError(t("settings.transfer.emailRequired")); return; }
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setEmailError(t("settings.transfer.emailInvalid")); return; }
                    setRecipientEmail(trimmed);
                    setConfirmStep(true);
                  }}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  {t("settings.transfer.transferButton")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {t("settings.transfer.confirmTitle")}
                </div>
                <p className="text-sm text-muted-foreground">
                  <Trans
                    i18nKey="settings.transfer.confirmBody"
                    values={{ name: activeProperty.name, email: recipientEmail }}
                    components={{ strong: <span className="font-semibold text-foreground" /> }}
                  />
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setConfirmStep(false)}
                    disabled={inititateMutation.isPending}
                  >
                    {t("settings.transfer.goBack")}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 bg-destructive hover:bg-destructive/90"
                    onClick={() =>
                      inititateMutation.mutate({
                        propertyId: activePropertyId,
                        data: { toEmail: recipientEmail, includeDocuments: homeDocumentCount > 0 && includeDocuments },
                      })
                    }
                    disabled={inititateMutation.isPending}
                  >
                    {inititateMutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("settings.transfer.initiating")}</>
                    ) : (
                      <><ShieldCheck className="h-3.5 w-3.5" /> {t("settings.transfer.confirmAndSend")}</>
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
            {t("settings.transfer.checkingStatus")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationsCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = getGetNotificationPreferencesQueryKey();
  const { data: prefs } = useGetNotificationPreferences({ query: { queryKey } });

  async function save(change: () => Promise<NotificationPreferences>) {
    try {
      queryClient.setQueryData(queryKey, await change());
    } catch {
      toast({ title: t("settings.notifications.saveFailed"), variant: "destructive" });
    }
  }

  const toggles: { key: keyof UpdateNotificationPreferencesBody; label: string; desc: string }[] = [
    { key: "emailReminders", label: t("settings.notifications.emailReminders"), desc: t("settings.notifications.emailRemindersDesc") },
    { key: "weeklySummary", label: t("settings.notifications.weeklySummary"), desc: t("settings.notifications.weeklySummaryDesc") },
    { key: "pushReminders", label: t("settings.notifications.pushReminders"), desc: t("settings.notifications.pushRemindersDesc") },
  ];

  return (
    <Card className="hover-elevate transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {t("settings.notifications.title")}
        </CardTitle>
        <CardDescription>{t("settings.notifications.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {toggles.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={`notify-${key}`} className="text-base">{label}</Label>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
            <Switch
              id={`notify-${key}`}
              checked={prefs?.[key] ?? true}
              disabled={!prefs}
              onCheckedChange={(checked) => save(() => updateNotificationPreferences({ [key]: checked }))}
            />
          </div>
        ))}

        {(prefs?.sharedHomes.length ?? 0) > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-medium pt-3">{t("settings.notifications.sharedHomes")}</p>
            {prefs!.sharedHomes.map((home) => (
              <div key={home.propertyId} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label htmlFor={`notify-home-${home.propertyId}`} className="text-sm">{home.name}</Label>
                  <p className="text-xs text-muted-foreground truncate">{home.address}</p>
                </div>
                <Switch
                  id={`notify-home-${home.propertyId}`}
                  checked={home.receiveReminders}
                  onCheckedChange={(enabled) => save(() => setReminderSubscription(home.propertyId, { enabled }))}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { data: profile, isFetched } = useGetUserProfile({
    query: { queryKey: getGetUserProfileQueryKey(), retry: false },
  });
  const email = user?.primaryEmailAddress?.emailAddress ?? profile?.email ?? "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Fill the form once the saved profile (or, for a new account, Clerk) loads.
  useEffect(() => {
    // A new account has no saved profile yet (404); fall back to Clerk's name.
    if (!user || !isFetched || loadedFor === user.id) return;
    setFirstName(profile?.firstName ?? user.firstName ?? "");
    setLastName(profile?.lastName ?? user.lastName ?? "");
    setPhone(profile?.phone ?? "");
    setLoadedFor(user.id);
  }, [user, profile, isFetched, loadedFor]);

  async function save() {
    if (!firstName.trim()) {
      setNameError(t("settings.profile.firstNameRequired"));
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        email: email || undefined,
      });
      queryClient.setQueryData(getGetUserProfileQueryKey(), saved);
      // Keep the sign-in account's name in step; the app reads its own profile.
      user?.update({ firstName: firstName.trim(), lastName: lastName.trim() }).catch(() => {});
      toast({ title: t("settings.profile.saved") });
    } catch {
      toast({ title: t("settings.profile.saveFailed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="hover-elevate transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          {t("settings.profile.title")}
        </CardTitle>
        <CardDescription>{t("settings.profile.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="first-name">{t("settings.profile.firstName")} <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input
              id="first-name"
              value={firstName}
              onChange={(e) => { setFirstName(e.target.value); setNameError(null); }}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "first-name-error" : undefined}
            />
            <FieldError id="first-name-error" message={nameError} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">{t("settings.profile.lastName")}</Label>
            <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("settings.profile.email")}</Label>
          <Input id="email" type="email" value={email} readOnly disabled />
          <p className="text-xs text-muted-foreground">{t("settings.profile.emailHint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{t("settings.profile.phone")}</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button onClick={save} disabled={saving || loadedFor === null} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("common.saveChanges")}
        </Button>
      </CardContent>
    </Card>
  );
}

// Passwords, email addresses and sign-in methods live in Clerk.
function SecurityCard() {
  const { t } = useTranslation();
  const clerk = useClerk();
  return (
    <Card className="hover-elevate transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          {t("settings.security.title")}
        </CardTitle>
        <CardDescription>{t("settings.security.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => clerk.openUserProfile()}>
          {t("settings.security.manage")}
        </Button>
      </CardContent>
    </Card>
  );
}

function AdminCard() {
  const { t } = useTranslation();
  const { data: profile } = useGetUserProfile({
    query: { queryKey: getGetUserProfileQueryKey(), retry: false },
  });
  const isAdmin = profile?.role === "admin";
  if (!isAdmin) return null;

  return (
    <div className="md:col-span-2">
      <Card className="border-primary/30 bg-primary/5 hover-elevate transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            {t("settings.admin.title")}
            <Badge className="ml-1 text-[10px] font-semibold uppercase tracking-wider bg-primary/15 text-primary border-primary/20">
              {t("settings.admin.badge")}
            </Badge>
          </CardTitle>
          <CardDescription>
            {t("settings.admin.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="gap-2">
            <Link href="/admin">
              <LayoutDashboard className="h-4 w-4" />
              {t("settings.admin.goToDashboard")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <AdminCard />
        <ProfileCard />

        <NotificationsCard />

        {/* Deed Transfer — full width */}
        <div className="md:col-span-2">
          <DeedTransferCard />
        </div>

        <SecurityCard />

      </div>
    </div>
  );
}
