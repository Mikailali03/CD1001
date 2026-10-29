import { useState } from "react";
import { Loader2, Eye, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  getListEmailTemplatesQueryKey,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  type EmailTemplate,
} from "@workspace/api-client-react";
import { STARTER_TEMPLATES } from "./constants";

type TemplateFormValues = {
  name: string;
  subject: string;
  bodyHtml: string;
  description: string;
  category: "marketing" | "notification" | "transactional";
};

export function TemplateFormDialog({
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
              <Label htmlFor="tpl-name">Template Name *</Label>
              <Input id="tpl-name"
                placeholder="e.g. Monthly Maintenance Digest"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-category">Category *</Label>
              <Select value={form.category} onValueChange={handleCategoryChange}>
                <SelectTrigger id="tpl-category">
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
            <Label htmlFor="tpl-subject">Subject Line *</Label>
            <Input id="tpl-subject"
              placeholder="Email subject line…"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-description">Description</Label>
            <Input id="tpl-description"
              placeholder="Internal note about this template's purpose…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tpl-body">Email Body (HTML) *</Label>
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
                id="tpl-body"
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
