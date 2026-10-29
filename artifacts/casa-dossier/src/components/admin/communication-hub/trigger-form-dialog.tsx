import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  getListEmailTriggersQueryKey,
  useCreateEmailTrigger,
  useUpdateEmailTrigger,
  type EmailTemplate,
  type EmailTrigger,
} from "@workspace/api-client-react";
import { TRIGGER_EVENT_LABELS } from "./constants";

type TriggerFormValues = {
  name: string;
  description: string;
  triggerEvent: string;
  templateId: string;
  isActive: boolean;
};

export function TriggerFormDialog({
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
            <Label htmlFor="trg-name">Trigger Name *</Label>
            <Input id="trg-name"
              placeholder="e.g. Notify homeowner when job accepted"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trg-event">Trigger Event *</Label>
            <Select
              value={form.triggerEvent}
              onValueChange={(v) => setForm((f) => ({ ...f, triggerEvent: v }))}
            >
              <SelectTrigger id="trg-event">
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
            <Label htmlFor="trg-template">Email Template</Label>
            <Select
              value={form.templateId || "none"}
              onValueChange={(v) => setForm((f) => ({ ...f, templateId: v === "none" ? "" : v }))}
            >
              <SelectTrigger id="trg-template">
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
            <Label htmlFor="trg-description">Description</Label>
            <Textarea id="trg-description"
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
