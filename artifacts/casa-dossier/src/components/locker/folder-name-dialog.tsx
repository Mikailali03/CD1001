import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

/** Single-field dialog used for both creating and renaming a locker folder. */
export function FolderNameDialog({
  open,
  onOpenChange,
  title,
  value,
  onChange,
  onSubmit,
  submitLabel,
  saving,
  placeholder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  saving: boolean;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <Input aria-label={t("locker.folderName")}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button onClick={onSubmit} disabled={!value.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
