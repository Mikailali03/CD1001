import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminOwnershipClaims,
  getListAdminOwnershipClaimsQueryKey,
  approveOwnershipClaim,
  rejectOwnershipClaim,
  type AdminOwnershipClaim,
  type ListAdminOwnershipClaimsStatus,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/lib/upload";
import { CheckCircle2, Eye, FileCheck2, Loader2, XCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const STATUSES: ListAdminOwnershipClaimsStatus[] = ["pending", "approved", "rejected"];
const DOC_LABEL: Record<string, string> = { closing_document: "Closing document", photo_id: "Photo ID" };

function ClaimCard({ claim, onDecided }: { claim: AdminOwnershipClaim; onDecided: () => void }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [doc, setDoc] = useState<{ url: string; type: string } | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function viewDocument() {
    setLoadingDoc(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/admin/ownership-claims/${claim.id}/document`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      setDoc({ url: URL.createObjectURL(blob), type: blob.type });
    } catch {
      toast({ title: "Could not load the document", variant: "destructive" });
    } finally {
      setLoadingDoc(false);
    }
  }

  function closeDocument() {
    if (doc) URL.revokeObjectURL(doc.url);
    setDoc(null);
  }

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    try {
      if (action === "approve") await approveOwnershipClaim(claim.id);
      else await rejectOwnershipClaim(claim.id, { reason: reason.trim() });
      toast({ title: action === "approve" ? "Approved — history moved and document deleted" : "Rejected — document deleted" });
      closeDocument();
      setRejecting(false);
      onDecided();
    } catch (err) {
      toast({ title: "Could not save the decision", description: apiErrorMessage(err, ""), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const pending = claim.status === "pending";

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold">{claim.propertyAddress}</p>
            <p className="text-xs text-muted-foreground">
              {claim.claimantName || "Unknown"}{claim.claimantEmail ? ` · ${claim.claimantEmail}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{DOC_LABEL[claim.documentType] ?? claim.documentType}</Badge>
            <Badge variant={pending ? "secondary" : claim.status === "approved" ? "default" : "destructive"} className="text-[10px] capitalize">
              {claim.status}
            </Badge>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          <p><span className="text-muted-foreground">Submitted:</span> {new Date(claim.createdAt).toLocaleString()}</p>
          {claim.history && (
            <p>
              <span className="text-muted-foreground">History:</span> {claim.history.assetCount} systems,{" "}
              {claim.history.recordCount} records ({claim.history.verifiedCount} verified)
            </p>
          )}
          {pending && (
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">Owner of record:</span>{" "}
              {claim.ownerOfRecord?.length
                ? claim.ownerOfRecord.join(", ")
                : "Not available — check the county property records"}
            </p>
          )}
          {claim.rejectionReason && (
            <p className="sm:col-span-2 text-destructive"><span className="text-muted-foreground">Reason:</span> {claim.rejectionReason}</p>
          )}
        </div>

        {pending && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={viewDocument} disabled={loadingDoc || !claim.hasDocument}>
              {loadingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              View document
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => decide("approve")} disabled={busy}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => setRejecting(true)} disabled={busy}>
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        )}
        {pending && claim.documentType === "photo_id" && (
          <p className="text-[11px] text-muted-foreground">
            A photo ID proves identity, not ownership. Approve only if the name matches the owner of record.
          </p>
        )}
      </CardContent>

      <Dialog open={!!doc} onOpenChange={(o) => !o && closeDocument()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{claim.propertyAddress}</DialogTitle></DialogHeader>
          {doc && (doc.type === "application/pdf"
            ? <iframe src={doc.url} title="Ownership document" className="w-full h-[70vh] rounded border" />
            : <img src={doc.url} alt="Ownership document" className="max-h-[70vh] mx-auto rounded" />)}
        </DialogContent>
      </Dialog>

      <Dialog open={rejecting} onOpenChange={(o) => !busy && setRejecting(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reject claim</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">The homeowner sees this reason in their email and on their home's page.</p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The name on the document doesn't match the property's owner records."
            className="h-24 text-sm"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={() => decide("reject")} disabled={busy || !reason.trim()}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function ClaimsTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ListAdminOwnershipClaimsStatus>("pending");
  const params = { status };
  const { data: claims, isLoading } = useListAdminOwnershipClaims(params, {
    query: { queryKey: getListAdminOwnershipClaimsQueryKey(params) },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><FileCheck2 className="h-5 w-5" /> Ownership claims</h2>
          <p className="text-xs text-muted-foreground">
            New owners asking to inherit a previous owner's history. Documents are deleted as soon as you decide.
          </p>
        </div>
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant={s === status ? "default" : "outline"} className="capitalize text-xs h-7" onClick={() => setStatus(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !claims?.length ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No {status} claims.</p>
      ) : (
        claims.map((c) => (
          <ClaimCard
            key={c.id}
            claim={c}
            onDecided={() => queryClient.invalidateQueries({ queryKey: getListAdminOwnershipClaimsQueryKey() })}
          />
        ))
      )}
    </div>
  );
}
