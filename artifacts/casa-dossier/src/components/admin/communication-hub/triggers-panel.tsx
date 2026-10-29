import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  useListEmailTemplates,
  getListEmailTemplatesQueryKey,
  useListEmailTriggers,
  getListEmailTriggersQueryKey,
  useDeleteEmailTrigger,
  useToggleEmailTrigger,
  type EmailTrigger,
} from "@workspace/api-client-react";
import { TRIGGER_EVENT_LABELS } from "./constants";
import { TriggerFormDialog } from "./trigger-form-dialog";

export function TriggersPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTrigger | null>(null);
  const [deleting, setDeleting] = useState<EmailTrigger | null>(null);

  const { data: triggers = [], isLoading } = useListEmailTriggers({
    query: { queryKey: getListEmailTriggersQueryKey() },
  });
  const { data: templates = [] } = useListEmailTemplates({
    query: { queryKey: getListEmailTemplatesQueryKey() },
  });

  const { mutate: toggleTrigger } = useToggleEmailTrigger({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListEmailTriggersQueryKey() }),
      onError: () => toast({ title: "Failed to toggle trigger", variant: "destructive" }),
    },
  });

  const { mutate: deleteTrigger, isPending: isDeleting } = useDeleteEmailTrigger({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmailTriggersQueryKey() });
        toast({ title: "Trigger deleted" });
        setDeleting(null);
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    },
  });

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (t: EmailTrigger) => { setEditing(t); setFormOpen(true); };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Automatic Triggers</h3>
          <p className="text-sm text-muted-foreground">
            Configure emails that send automatically based on platform events.
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Trigger
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : triggers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Zap className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">No triggers configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a trigger to automatically send emails when events happen.
            </p>
            <Button size="sm" className="mt-4 gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create Trigger
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {triggers.map((t) => {
            const eventInfo = TRIGGER_EVENT_LABELS[t.triggerEvent];
            const linkedTemplate = templates.find((tmpl) => tmpl.id === t.templateId);
            return (
              <Card key={t.id} className={`hover-elevate transition-shadow ${!t.isActive ? "opacity-60" : ""}`}>
                <CardContent className="py-3 px-4 flex items-start gap-4">
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${t.isActive ? "bg-primary/10" : "bg-muted"}`}>
                    <Zap className={`h-4 w-4 ${t.isActive ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{t.name}</p>
                      <Badge variant={t.isActive ? "default" : "secondary"} className="text-[10px]">
                        {t.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Event: {eventInfo?.label ?? t.triggerEvent}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Template: {linkedTemplate ? linkedTemplate.name : <span className="italic">None assigned</span>}
                    </p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={t.isActive ? "Pause trigger" : "Activate trigger"}
                      onClick={() => toggleTrigger({ triggerId: t.id })}
                    >
                      {t.isActive ? (
                        <ToggleRight className="h-4 w-4 text-primary" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(t)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(t)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TriggerFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        trigger={editing}
        templates={templates}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trigger?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" will be permanently deleted and will stop firing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleting && deleteTrigger({ triggerId: deleting.id })}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
