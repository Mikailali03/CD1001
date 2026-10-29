import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation, Trans } from "react-i18next";
import {
  getInbox,
  claimInboxTransfer,
  acceptInboxCollaborator,
  declineInboxCollaborator,
  getListPropertiesQueryKey,
  type Inbox,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Home,
  ArrowRight,
  MapPin,
  UserCheck,
  FileCheck,
  X,
  Check,
  Loader2,
} from "lucide-react";

function PropertyRow({ name, address, city, state }: { name: string; address: string; city?: string; state?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-muted rounded-lg p-2 shrink-0 mt-0.5">
        <Home className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm text-foreground leading-tight">{name}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <MapPin className="h-3 w-3 shrink-0" />
          {[address, city, state].filter(Boolean).join(", ")}
        </p>
      </div>
    </div>
  );
}

export function PendingInvitesModal() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getInbox()
      .then((data) => {
        if (cancelled) return;
        const hasItems = data.transfers.length > 0 || data.collaboratorInvites.length > 0;
        if (hasItems) {
          setInbox(data);
          setOpen(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  const totalItems = (inbox?.transfers.length ?? 0) + (inbox?.collaboratorInvites.length ?? 0);

  async function claimTransfer(id: string, propertyName: string) {
    setPending((p) => ({ ...p, [id]: true }));
    try {
      await claimInboxTransfer(id);
      setInbox((prev) => prev ? { ...prev, transfers: prev.transfers.filter((tr) => tr.id !== id) } : prev);
      queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
      toast({ title: t("invites.toast.claimed"), description: t("invites.toast.claimedDesc", { name: propertyName }) });
    } catch {
      toast({ title: t("invites.toast.claimFailed"), variant: "destructive" });
    } finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  }

  async function acceptCollab(id: string, propertyName: string) {
    setPending((p) => ({ ...p, [id]: true }));
    try {
      await acceptInboxCollaborator(id);
      setOpen(false);
      setInbox((prev) => prev ? { ...prev, collaboratorInvites: prev.collaboratorInvites.filter((c) => c.id !== id) } : prev);
      await queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
      await queryClient.refetchQueries({ queryKey: getListPropertiesQueryKey() });
      toast({ title: t("invites.toast.accepted"), description: t("invites.toast.acceptedDesc", { name: propertyName }) });
    } catch {
      toast({ title: t("invites.toast.acceptFailed"), variant: "destructive" });
      setPending((p) => ({ ...p, [id]: false }));
    }
  }

  async function declineCollab(id: string) {
    setPending((p) => ({ ...p, [id]: true }));
    try {
      await declineInboxCollaborator(id);
      setInbox((prev) => prev ? { ...prev, collaboratorInvites: prev.collaboratorInvites.filter((c) => c.id !== id) } : prev);
    } catch {
      toast({ title: t("invites.toast.declineFailed"), variant: "destructive" });
    } finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  }

  const remainingItems = (inbox?.transfers.length ?? 0) + (inbox?.collaboratorInvites.length ?? 0);

  useEffect(() => {
    if (open && remainingItems === 0 && totalItems > 0) {
      setOpen(false);
    }
  }, [remainingItems, open, totalItems]);

  if (!inbox) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden" hideCloseButton>
        <DialogTitle className="sr-only">{t("invites.srTitle")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("invites.srDescription")}
        </DialogDescription>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b bg-gradient-to-br from-primary/5 to-primary/0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-primary/10 rounded-lg p-1.5">
                  <Home className="h-4 w-4 text-primary" />
                </div>
                <Badge variant="secondary" className="text-xs">
                  {t("invites.pendingCount", { count: remainingItems })}
                </Badge>
              </div>
              <h2 className="text-base font-semibold text-foreground">{t("invites.title")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("invites.subtitle")}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* Deed transfers */}
          {inbox.transfers.map((tr) => (
            <div key={tr.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="bg-amber-100 rounded-md p-1">
                  <FileCheck className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">{t("invites.deedTransfer")}</span>
              </div>

              <PropertyRow
                name={tr.property.name}
                address={tr.property.address}
                city={tr.property.city}
                state={tr.property.state}
              />

              <p className="text-xs text-muted-foreground">
                <Trans
                  i18nKey="invites.transferredToYou"
                  values={{ email: tr.fromEmail }}
                  components={{ strong: <span className="font-medium text-foreground" /> }}
                />
              </p>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 h-8 text-xs"
                  onClick={() => claimTransfer(tr.id, tr.property.name)}
                  disabled={!!pending[tr.id]}
                >
                  {pending[tr.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {t("invites.acceptAndClaim")}
                </Button>
              </div>
            </div>
          ))}

          {/* Collaborator invites */}
          {inbox.collaboratorInvites.map((c) => (
            <div key={c.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 rounded-md p-1">
                  <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{t("invites.collabInvite")}</span>
              </div>

              <PropertyRow
                name={c.property.name}
                address={c.property.address}
                city={c.property.city}
                state={c.property.state}
              />

              <p className="text-xs text-muted-foreground">
                {t("invites.collabInvitedDesc")}
              </p>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 h-8 text-xs"
                  onClick={() => acceptCollab(c.id, c.property.name)}
                  disabled={!!pending[c.id]}
                >
                  {pending[c.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {t("invites.accept")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => declineCollab(c.id)}
                  disabled={!!pending[c.id]}
                >
                  {t("invites.decline")}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 bg-muted/20 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{t("invites.manageHint")}</p>
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 shrink-0" onClick={() => setOpen(false)}>
            {t("invites.later")}
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
