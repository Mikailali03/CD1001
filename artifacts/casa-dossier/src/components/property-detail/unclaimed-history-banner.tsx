import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetUnclaimedHistory,
  getGetUnclaimedHistoryQueryKey,
  createOwnershipClaim,
  type CreateOwnershipClaimBodyDocumentType,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage, uploadObject } from "@/lib/upload";
import { History, Loader2, Clock, XCircle, Upload } from "lucide-react";

// Offers a new owner the history a previous owner left at this address, and
// collects proof of ownership for review. Shown only to the property's owner.
export function UnclaimedHistoryBanner({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useGetUnclaimedHistory(propertyId, {
    query: { queryKey: getGetUnclaimedHistoryQueryKey(propertyId) },
  });
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState<CreateOwnershipClaimBodyDocumentType>("closing_document");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!data) return null;
  const claim = data.claim;

  if (claim?.status === "pending") {
    return (
      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="flex items-start gap-3 py-4">
          <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{t("ownershipClaim.pendingTitle")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("ownershipClaim.pendingBody")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data.available) return null;

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const documentPath = await uploadObject(file);
      await createOwnershipClaim(propertyId, { documentType, documentPath });
      toast({ title: t("ownershipClaim.submitted") });
      setOpen(false);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: getGetUnclaimedHistoryQueryKey(propertyId) });
    } catch (err) {
      toast({ title: t("ownershipClaim.submitFailed"), description: apiErrorMessage(err, ""), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 py-4">
          <History className="h-5 w-5 text-emerald-700 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">{t("ownershipClaim.foundTitle")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("ownershipClaim.foundBody", { assets: data.assetCount, records: data.recordCount, verified: data.verifiedCount })}
            </p>
            {claim?.status === "rejected" && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" />
                {t("ownershipClaim.rejected", { reason: claim.rejectionReason ?? "" })}
              </p>
            )}
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>{t("ownershipClaim.claimCta")}</Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ownershipClaim.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("ownershipClaim.dialogBody")}</DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={documentType}
            onValueChange={(v) => setDocumentType(v as CreateOwnershipClaimBodyDocumentType)}
            className="space-y-2"
          >
            <Label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer font-normal">
              <RadioGroupItem value="closing_document" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">{t("ownershipClaim.closingDocument")}</span>
                <span className="block text-xs text-muted-foreground">{t("ownershipClaim.closingDocumentHint")}</span>
              </span>
            </Label>
            <Label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer font-normal">
              <RadioGroupItem value="photo_id" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">{t("ownershipClaim.photoId")}</span>
                <span className="block text-xs text-muted-foreground">{t("ownershipClaim.photoIdHint")}</span>
              </span>
            </Label>
          </RadioGroup>

          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" className="w-full gap-2" onClick={() => fileInput.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" />
            {file ? file.name : t("ownershipClaim.chooseFile")}
          </Button>

          <p className="text-[11px] text-muted-foreground">{t("ownershipClaim.privacyNote")}</p>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>{t("common.cancel")}</Button>
            <Button onClick={submit} disabled={!file || busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("ownershipClaim.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
