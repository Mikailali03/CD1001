import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCollaborators,
  getListCollaboratorsQueryKey,
  useInviteCollaborator,
  useRemoveCollaborator,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/field-error";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/subscription-context";
import { apiErrorMessage } from "@/lib/upload";
import { Users, X, Lock, Mail, UserCheck, Clock } from "lucide-react";

interface Props {
  propertyId: string;
  isOwner: boolean;
}

export function CollaboratorsPanel({ propertyId, isOwner }: Props) {
  const { subscription, isLoading: subscriptionLoading, openUpgradeModal } = useSubscription();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const isManagedPlus =
    subscription?.tier === "managed" || subscription?.tier === "concierge";

  const { data: collaborators = [], isLoading } = useListCollaborators(propertyId, {
    query: {
      enabled: !!propertyId && isOwner && isManagedPlus,
      queryKey: getListCollaboratorsQueryKey(propertyId),
    },
  });

  const invite = useInviteCollaborator();
  const remove = useRemoveCollaborator();

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError(t("collaborators.emailRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(t("validation.invalidEmail"));
      return;
    }
    setEmailError(null);
    invite.mutate(
      { propertyId, data: { email: email.trim().toLowerCase() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey(propertyId) });
          toast({ title: t("collaborators.inviteSent"), description: t("collaborators.inviteSentDesc", { email: email.trim() }) });
          setEmail("");
        },
        onError: (err) => {
          const msg = apiErrorMessage(err, t("collaborators.inviteFailedDesc"));
          toast({ title: t("collaborators.inviteFailed"), description: msg, variant: "destructive" });
        },
      }
    );
  }

  function handleRemove(collaboratorId: string, collaboratorEmail: string) {
    remove.mutate(
      { propertyId, collaboratorId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey(propertyId) });
          toast({ title: t("collaborators.removed"), description: t("collaborators.removedDesc", { email: collaboratorEmail }) });
        },
        onError: () => {
          toast({ title: t("collaborators.couldNotRemove"), variant: "destructive" });
        },
      }
    );
  }

  if (!isOwner) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          {t("collaborators.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {subscriptionLoading ? (
          <p className="text-xs text-muted-foreground text-center py-2">{t("common.loading")}</p>
        ) : !isManagedPlus ? (
          <div className="rounded-lg border border-dashed p-4 flex flex-col items-center gap-2 text-center">
            <div className="bg-muted rounded-full p-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("collaborators.upsell")}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-1 text-xs h-7"
              onClick={openUpgradeModal}
            >
              {t("collaborators.upgradeToManaged")}
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={handleInvite} noValidate className="space-y-1.5">
              <label htmlFor={`invite-email-${propertyId}`} className="sr-only">{t("collaborators.emailLabel")}</label>
              <div className="flex gap-2">
                <Input
                  id={`invite-email-${propertyId}`}
                  type="email"
                  placeholder={t("collaborators.emailPlaceholder")}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
                  className="h-8 text-sm flex-1"
                  disabled={invite.isPending}
                  required
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? `invite-email-${propertyId}-error` : undefined}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={invite.isPending}
                >
                  <Mail className="h-3.5 w-3.5 mr-1" />
                  {t("collaborators.invite")}
                </Button>
              </div>
              <FieldError id={`invite-email-${propertyId}-error`} message={emailError} />
            </form>

            {isLoading ? (
              <p className="text-xs text-muted-foreground text-center py-2">{t("common.loading")}</p>
            ) : collaborators.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-1">
                {t("collaborators.empty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {collaborators.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="shrink-0">
                        {c.status === "accepted" ? (
                          <UserCheck className="h-3.5 w-3.5 text-chart-1" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-xs truncate text-foreground">{c.invitedEmail}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] h-4 px-1.5 ${
                          c.status === "accepted"
                            ? "bg-chart-1/10 text-chart-1 border-chart-1/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.status === "accepted" ? t("collaborators.active") : t("collaborators.pending")}
                      </Badge>
                      <button
                        onClick={() => handleRemove(c.id, c.invitedEmail)}
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title={t("collaborators.removeTitle")}
                        aria-label={t("collaborators.removeAria", { email: c.invitedEmail })}
                        disabled={remove.isPending}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
