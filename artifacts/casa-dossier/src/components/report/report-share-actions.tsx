import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  emailPropertyReport,
  useListReportSends,
  getListReportSendsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/field-error";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/lib/upload";
import { format } from "@/lib/date";
import { Download, Loader2, Mail } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const MAX_RECIPIENTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Emailing the report from Casa Dossier is the official way to share it: the
// recipient gets the PDF straight from us, so there's no question of whether
// it was edited. A download is labelled as a personal copy.
export function ReportShareActions({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [message, setMessage] = useState("");
  const [includeCosts, setIncludeCosts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { data: sends = [] } = useListReportSends(propertyId, {
    query: { queryKey: getListReportSendsQueryKey(propertyId), enabled: open },
  });

  function parseRecipients(): string[] | null {
    const list = [...new Set(recipients.split(/[\s,;]+/).map((r) => r.trim().toLowerCase()).filter(Boolean))];
    if (list.length === 0) { setError(t("reportShare.recipientsRequired")); return null; }
    if (list.length > MAX_RECIPIENTS) { setError(t("reportShare.tooMany", { max: MAX_RECIPIENTS })); return null; }
    const bad = list.find((r) => !EMAIL_RE.test(r));
    if (bad) { setError(t("reportShare.invalidEmail", { email: bad })); return null; }
    return list;
  }

  async function send() {
    const list = parseRecipients();
    if (!list) return;
    setSending(true);
    try {
      const result = await emailPropertyReport(propertyId, {
        recipients: list,
        message: message.trim() || undefined,
        includeCosts,
      });
      queryClient.invalidateQueries({ queryKey: getListReportSendsQueryKey(propertyId) });
      toast({
        title: t("reportShare.sent"),
        description: result.failedRecipients.length
          ? t("reportShare.partlyFailed", { emails: result.failedRecipients.join(", ") })
          : undefined,
        variant: result.failedRecipients.length ? "destructive" : undefined,
      });
      setRecipients("");
      setMessage("");
      setOpen(false);
    } catch (err) {
      toast({ title: t("reportShare.sendFailed"), description: apiErrorMessage(err, ""), variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/properties/${propertyId}/report/pdf?includeCosts=${includeCosts}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "Casa Dossier report.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t("reportShare.downloadFailed"), variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={download}
          disabled={downloading}
          className="flex items-center gap-2 border border-white/30 text-white text-sm font-semibold px-3 py-2 rounded hover:bg-white/10 transition-colors disabled:opacity-60"
          title={t("reportShare.personalCopyHint")}
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t("reportShare.download")}
        </button>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-white text-gray-900 text-sm font-bold px-4 py-2 rounded hover:bg-gray-100 transition-colors"
        >
          <Mail className="h-4 w-4" />
          {t("reportShare.emailCta")}
        </button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !sending && setOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("reportShare.title")}</DialogTitle>
            <DialogDescription>{t("reportShare.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="report-recipients">{t("reportShare.recipients")}</Label>
              <Input
                id="report-recipients"
                value={recipients}
                onChange={(e) => { setRecipients(e.target.value); setError(null); }}
                placeholder={t("reportShare.recipientsPlaceholder")}
                aria-invalid={!!error}
                aria-describedby={error ? "report-recipients-error" : undefined}
              />
              <FieldError id="report-recipients-error" message={error} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-message">{t("reportShare.message")}</Label>
              <Textarea
                id="report-message"
                value={message}
                maxLength={1000}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("reportShare.messagePlaceholder")}
                className="h-20 text-sm resize-none"
              />
            </div>
            <Label className="flex items-center gap-2 font-normal cursor-pointer">
              <Checkbox checked={includeCosts} onCheckedChange={(v) => setIncludeCosts(v === true)} />
              {t("reportShare.includeCosts")}
            </Label>
            <p className="text-xs text-muted-foreground">{t("reportShare.receiptsNote")}</p>

            {sends.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold mb-1.5">{t("reportShare.history")}</p>
                <ul className="space-y-1 max-h-28 overflow-y-auto">
                  {sends.map((s) => (
                    <li key={s.id} className="text-xs text-muted-foreground">
                      {format(new Date(s.createdAt), "MMM d, yyyy")} · {s.recipients.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending}>{t("common.cancel")}</Button>
            <Button onClick={send} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {t("reportShare.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
