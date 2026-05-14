import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight, Mail, Zap, Eye, Code2, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  useListEmailTriggers,
  getListEmailTriggersQueryKey,
  useCreateEmailTrigger,
  useUpdateEmailTrigger,
  useDeleteEmailTrigger,
  useToggleEmailTrigger,
  type EmailTemplate,
  type EmailTrigger,
} from "@workspace/api-client-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  notification: "Notification",
  transactional: "Transactional",
};

const CATEGORY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  marketing: "default",
  notification: "secondary",
  transactional: "outline",
};

const TRIGGER_EVENT_LABELS: Record<string, { label: string; description: string }> = {
  technician_accepted_job: {
    label: "Technician Accepts a Job",
    description: "Sent when a technician accepts a marketplace job",
  },
  job_completed: {
    label: "Job Completed",
    description: "Sent when a technician marks a job as complete",
  },
  overdue_maintenance: {
    label: "Overdue Maintenance Item",
    description: "Sent when a maintenance task becomes overdue",
  },
  asset_end_of_life: {
    label: "Asset Reaching End of Life",
    description: "Sent when an asset is nearing its expected end of life",
  },
  property_transfer_initiated: {
    label: "Property Transfer Initiated",
    description: "Sent when a dossier transfer is requested",
  },
  new_feature_announcement: {
    label: "New Feature Announcement",
    description: "Manual blast to announce a new platform feature",
  },
  monthly_update: {
    label: "Monthly Update",
    description: "Scheduled monthly digest with upcoming maintenance items",
  },
  custom: {
    label: "Custom Trigger",
    description: "Fully configurable trigger with custom conditions",
  },
};

const STARTER_TEMPLATES: Record<string, { subject: string; body: string }> = {
  marketing: {
    subject: "Exciting news from Casa Dossier",
    body: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="color: #2563eb;">Hello {{firstName}},</h1>
  <p>We have some exciting news to share with you!</p>
  <p><!-- Add your message here --></p>
  <a href="{{ctaUrl}}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Learn More</a>
  <p style="margin-top: 32px; color: #6b7280; font-size: 13px;">You're receiving this because you're a Casa Dossier member.<br>
  <a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
</body>
</html>`,
  },
  notification: {
    subject: "Action required for your property",
    body: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h2 style="color: #1a1a1a;">Hi {{firstName}},</h2>
  <p>This is a notification about your property at <strong>{{propertyAddress}}</strong>.</p>
  <p><!-- Describe the notification here --></p>
  <a href="{{actionUrl}}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View Details</a>
  <p style="margin-top: 32px; color: #6b7280; font-size: 13px;">Casa Dossier — Your Home Maintenance OS</p>
</body>
</html>`,
  },
  transactional: {
    subject: "Your Casa Dossier update",
    body: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h2>Hi {{firstName}},</h2>
  <p>Here's a summary of recent activity on your account.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Item</td>
      <td style="padding: 8px 0; font-size: 14px;">Details</td>
    </tr>
  </table>
  <p style="color: #6b7280; font-size: 13px;">— The Casa Dossier Team</p>
</body>
</html>`,
  },
};

// ─── Template Form Dialog ─────────────────────────────────────────────────────

type TemplateFormValues = {
  name: string;
  subject: string;
  bodyHtml: string;
  description: string;
  category: "marketing" | "notification" | "transactional";
};

function TemplateFormDialog({
  open,
  onClose,
  template,
}: {
  open: boolean;
  onClose: () => void;
  template: EmailTemplate | null;
}) {
  const isEdit = !!template;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [previewMode, setPreviewMode] = useState<"code" | "preview">("code");
  const [form, setForm] = useState<TemplateFormValues>(() => ({
    name: template?.name ?? "",
    subject: template?.subject ?? "",
    bodyHtml: template?.bodyHtml ?? STARTER_TEMPLATES.notification.body,
    description: template?.description ?? "",
    category: (template?.category as TemplateFormValues["category"]) ?? "notification",
  }));

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailTemplatesQueryKey() });
    toast({ title: isEdit ? "Template updated" : "Template created" });
    onClose();
  };
  const onError = () => toast({ title: "Something went wrong", variant: "destructive" });

  const { mutate: create, isPending: creating } = useCreateEmailTemplate({ mutation: { onSuccess, onError } });
  const { mutate: update, isPending: updating } = useUpdateEmailTemplate({ mutation: { onSuccess, onError } });

  const isPending = creating || updating;

  const handleSubmit = () => {
    if (!form.name.trim() || !form.subject.trim() || !form.bodyHtml.trim()) return;
    if (isEdit) {
      update({ templateId: template.id, data: form });
    } else {
      create({ data: form });
    }
  };

  const handleCategoryChange = (cat: string) => {
    const c = cat as TemplateFormValues["category"];
    setForm((f) => ({
      ...f,
      category: c,
      subject: f.subject || STARTER_TEMPLATES[c].subject,
      bodyHtml: f.bodyHtml === STARTER_TEMPLATES[f.category].body ? STARTER_TEMPLATES[c].body : f.bodyHtml,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Template" : "New Email Template"}</DialogTitle>
          <DialogDescription>
            Use HTML to build the email body. Variables like{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{firstName}}"}</code> will be
            replaced at send time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g. Monthly Maintenance Digest"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="notification">Notification</SelectItem>
                  <SelectItem value="transactional">Transactional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Subject Line *</Label>
            <Input
              placeholder="Email subject line…"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              placeholder="Internal note about this template's purpose…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Email Body (HTML) *</Label>
              <div className="flex items-center gap-1 p-0.5 bg-muted rounded-md">
                <Button
                  size="sm"
                  variant={previewMode === "code" ? "secondary" : "ghost"}
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => setPreviewMode("code")}
                >
                  <Code2 className="h-3 w-3" />
                  HTML
                </Button>
                <Button
                  size="sm"
                  variant={previewMode === "preview" ? "secondary" : "ghost"}
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => setPreviewMode("preview")}
                >
                  <Eye className="h-3 w-3" />
                  Preview
                </Button>
              </div>
            </div>
            {previewMode === "code" ? (
              <Textarea
                className="font-mono text-xs leading-relaxed min-h-[240px] resize-y"
                placeholder="Paste or write HTML here…"
                value={form.bodyHtml}
                onChange={(e) => setForm((f) => ({ ...f, bodyHtml: e.target.value }))}
              />
            ) : (
              <div className="border rounded-md overflow-hidden min-h-[240px] bg-white">
                <iframe
                  title="Email preview"
                  className="w-full min-h-[240px]"
                  srcDoc={form.bodyHtml}
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name || !form.subject || !form.bodyHtml}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Trigger Form Dialog ──────────────────────────────────────────────────────

type TriggerFormValues = {
  name: string;
  description: string;
  triggerEvent: string;
  templateId: string;
  isActive: boolean;
};

function TriggerFormDialog({
  open,
  onClose,
  trigger,
  templates,
}: {
  open: boolean;
  onClose: () => void;
  trigger: EmailTrigger | null;
  templates: EmailTemplate[];
}) {
  const isEdit = !!trigger;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<TriggerFormValues>(() => ({
    name: trigger?.name ?? "",
    description: trigger?.description ?? "",
    triggerEvent: trigger?.triggerEvent ?? "technician_accepted_job",
    templateId: trigger?.templateId ?? "",
    isActive: trigger?.isActive ?? true,
  }));

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getListEmailTriggersQueryKey() });
    toast({ title: isEdit ? "Trigger updated" : "Trigger created" });
    onClose();
  };
  const onError = () => toast({ title: "Something went wrong", variant: "destructive" });

  const { mutate: create, isPending: creating } = useCreateEmailTrigger({ mutation: { onSuccess, onError } });
  const { mutate: update, isPending: updating } = useUpdateEmailTrigger({ mutation: { onSuccess, onError } });

  const isPending = creating || updating;

  const handleSubmit = () => {
    if (!form.name.trim() || !form.triggerEvent) return;
    const payload = {
      name: form.name,
      description: form.description || undefined,
      triggerEvent: form.triggerEvent as EmailTrigger["triggerEvent"],
      templateId: form.templateId || undefined,
      isActive: form.isActive,
    };
    if (isEdit) {
      update({ triggerId: trigger.id, data: payload });
    } else {
      create({ data: payload });
    }
  };

  const selectedEvent = TRIGGER_EVENT_LABELS[form.triggerEvent];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Trigger" : "New Email Trigger"}</DialogTitle>
          <DialogDescription>
            Configure an automatic email trigger. The selected template will be sent when the event fires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Trigger Name *</Label>
            <Input
              placeholder="e.g. Notify homeowner when job accepted"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Trigger Event *</Label>
            <Select
              value={form.triggerEvent}
              onValueChange={(v) => setForm((f) => ({ ...f, triggerEvent: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGER_EVENT_LABELS).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEvent && (
              <p className="text-xs text-muted-foreground">{selectedEvent.description}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Email Template</Label>
            <Select
              value={form.templateId || "none"}
              onValueChange={(v) => setForm((f) => ({ ...f, templateId: v === "none" ? "" : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template (assign later)</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Internal notes about this trigger…"
              className="min-h-[72px] resize-none text-sm"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Trigger will fire when active</p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name || !form.triggerEvent}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Trigger"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Templates Panel ──────────────────────────────────────────────────────────

function TemplatesPanel() {
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
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleting(t)}
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

// ─── Triggers Panel ───────────────────────────────────────────────────────────

function TriggersPanel() {
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
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(t)}
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

// ─── Communication Hub Tab ────────────────────────────────────────────────────

export function CommunicationHubTab() {
  return (
    <div className="space-y-2">
      <Tabs defaultValue="templates">
        <TabsList className="mb-6">
          <TabsTrigger value="templates" className="gap-2">
            <Mail className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="triggers" className="gap-2">
            <Zap className="h-4 w-4" />
            Auto Triggers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-0">
          <TemplatesPanel />
        </TabsContent>

        <TabsContent value="triggers" className="mt-0">
          <TriggersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
