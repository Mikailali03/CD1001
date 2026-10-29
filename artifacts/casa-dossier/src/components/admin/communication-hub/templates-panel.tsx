import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Mail } from "lucide-react";
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
  useDeleteEmailTemplate,
  type EmailTemplate,
} from "@workspace/api-client-react";
import { CATEGORY_LABELS, CATEGORY_VARIANTS } from "./constants";
import { TemplateFormDialog } from "./template-form-dialog";

export function TemplatesPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState<EmailTemplate | null>(null);

  const { data: templates = [], isLoading } = useListEmailTemplates({
    query: { queryKey: getListEmailTemplatesQueryKey() },
  });

  const { mutate: deleteTemplate, isPending: isDeleting } = useDeleteEmailTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmailTemplatesQueryKey() });
        toast({ title: "Template deleted" });
        setDeleting(null);
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    setFormOpen(true);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Email Templates</h3>
          <p className="text-sm text-muted-foreground">
            Reusable HTML email layouts used by manual campaigns and automatic triggers.
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Mail className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">No templates yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first template to start sending emails.
            </p>
            <Button size="sm" className="mt-4 gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id} className="hover-elevate transition-shadow">
              <CardContent className="py-3 px-4 flex items-start gap-4">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{t.name}</p>
                    <Badge
                      variant={CATEGORY_VARIANTS[t.category] ?? "secondary"}
                      className="text-[10px]"
                    >
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Subject: {t.subject}
                  </p>
                  {t.description && (
                    <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
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
          ))}
        </div>
      )}

      <TemplateFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        template={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" will be permanently deleted. Any triggers using this template will
              lose their template association.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleting && deleteTemplate({ templateId: deleting.id })}
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
