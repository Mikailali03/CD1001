import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Save,
  Tag,
  Hash,
  Calendar,
  DollarSign,
  FileText,
  ShieldCheck,
  Archive,
  ArchiveRestore,
  Camera,
  ImagePlus,
  X as XIcon,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CATEGORIES = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Roof",
  "Appliance",
  "Structural",
  "Other",
] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_ICONS: Record<string, string> = {
  HVAC: "❄️",
  Plumbing: "🔧",
  Electrical: "⚡",
  Roof: "🏠",
  Appliance: "🫙",
  Structural: "🏗️",
  Other: "📦",
};

type Asset = {
  id: string;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  installDate?: string | null;
  replacementCost?: string | null;
  warrantyExpiry?: string | null;
  notes?: string | null;
  status?: string | null;
  retiredAt?: string | Date | null;
  photoUrl?: string | null;
};

type Props = {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (updated: Asset) => void;
};

export function EditAssetSheet({ asset, open, onOpenChange, onSaved }: Props) {
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [retireDialogOpen, setRetireDialogOpen] = useState(false);
  const [unretireDialogOpen, setUnretireDialogOpen] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("HVAC");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [replacementCost, setReplacementCost] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [notes, setNotes] = useState("");

  // Photo upload state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRetired = !!asset?.retiredAt;

  useEffect(() => {
    if (!asset) return;
    setName(asset.name ?? "");
    setCategory((asset.category as Category) ?? "HVAC");
    setBrand(asset.brand ?? "");
    setModel(asset.model ?? "");
    setSerialNumber(asset.serialNumber ?? "");
    setInstallDate(asset.installDate ? asset.installDate.substring(0, 7) : "");
    setReplacementCost(
      asset.replacementCost ? String(Number(asset.replacementCost)) : ""
    );
    setWarrantyExpiry(
      asset.warrantyExpiry ? asset.warrantyExpiry.substring(0, 7) : ""
    );
    setNotes(asset.notes ?? "");
    setPhotoPreview(asset.photoUrl ?? null);
    setPendingPhotoUrl(null);
  }, [asset]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const urlRes = await authFetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      setPendingPhotoUrl(`${BASE}/api/storage${objectPath}`);
    } catch {
      toast({ title: "Photo upload failed", variant: "destructive" });
      setPhotoPreview(asset?.photoUrl ?? null);
      setPendingPhotoUrl(null);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removePhoto() {
    setPhotoPreview(null);
    setPendingPhotoUrl("");
  }

  function invalidateAssetQueries() {
    queryClient.invalidateQueries({
      predicate: (q) =>
        q.queryKey.some(
          (k) =>
            typeof k === "string" &&
            (k.includes("assets") ||
              k.includes(asset!.id) ||
              k.includes("summary"))
        ),
    });
  }

  async function handleSave() {
    if (!asset || !name.trim()) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        category,
        brand: brand.trim() || null,
        model: model.trim() || null,
        serialNumber: serialNumber.trim() || null,
        installDate: installDate ? `${installDate}-01` : null,
        replacementCost: replacementCost ? parseFloat(replacementCost) : null,
        warrantyExpiry: warrantyExpiry ? `${warrantyExpiry}-01` : null,
        notes: notes.trim() || null,
      };
      // Only send photoUrl when it has been changed (pendingPhotoUrl !== null)
      if (pendingPhotoUrl !== null) {
        body.photoUrl = pendingPhotoUrl || null;
      }
      const res = await authFetch(`${BASE}/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed");

      const updated = await res.json();
      toast({ title: "Asset updated", description: `${name} has been saved.` });
      invalidateAssetQueries();
      onSaved?.(updated);
      onOpenChange(false);
    } catch {
      toast({ title: "Could not save changes", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleRetire() {
    if (!asset) return;
    setBusy(true);
    try {
      const res = await authFetch(`${BASE}/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retiredAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      toast({ title: "Asset retired", description: `${asset.name} has been moved to Retired Assets. Its service history is preserved.` });
      invalidateAssetQueries();
      onSaved?.(updated);
      onOpenChange(false);
    } catch {
      toast({ title: "Could not retire asset", variant: "destructive" });
    } finally {
      setBusy(false);
      setRetireDialogOpen(false);
    }
  }

  async function handleUnretire() {
    if (!asset) return;
    setBusy(true);
    try {
      const res = await authFetch(`${BASE}/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retiredAt: null }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      toast({ title: "Asset restored", description: `${asset.name} is back in your active asset list.` });
      invalidateAssetQueries();
      onSaved?.(updated);
      onOpenChange(false);
    } catch {
      toast({ title: "Could not restore asset", variant: "destructive" });
    } finally {
      setBusy(false);
      setUnretireDialogOpen(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2">
              {asset ? CATEGORY_ICONS[asset.category] ?? "📦" : ""}
              {isRetired ? "Retired Asset" : "Edit Asset"}
            </SheetTitle>
            <SheetDescription>
              {isRetired
                ? "This asset is retired. You can restore it to your active list or update its details."
                : "Update the details for this asset. Changes are saved immediately."}
            </SheetDescription>
          </SheetHeader>

          {isRetired && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <Archive className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Retired — removed from active inventory but service history is preserved.</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Photo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Asset Photo</Label>
              <div className="relative group">
                {photoPreview ? (
                  <div className="relative h-44 w-full rounded-xl overflow-hidden border border-border">
                    <img src={photoPreview} alt="Asset" className="h-full w-full object-cover" />
                    {uploading && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                    {!uploading && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-white/90 hover:bg-white text-foreground rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="bg-white/90 hover:bg-white text-destructive rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full h-32 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/40 hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all cursor-pointer"
                  >
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="h-6 w-6" />
                        <span className="text-xs font-medium">Upload a photo</span>
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Asset Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Carrier Central AC Unit"
                autoFocus
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as Category)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_ICONS[c]} {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Brand + Model */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Brand / Make
                </Label>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Carrier"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Model Number</Label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Optional"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            {/* Serial Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Hash className="h-3 w-3" /> Serial Number
              </Label>
              <Input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Found on the unit's label"
                className="font-mono text-sm"
              />
            </div>

            {/* Install Date + Replacement Cost */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Mfr / Install Date
                </Label>
                <Input
                  type="month"
                  value={installDate}
                  onChange={(e) => setInstallDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Est. Replacement Cost
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  placeholder="0"
                  value={replacementCost}
                  onChange={(e) => setReplacementCost(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Warranty Expiry */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Warranty Expiry (optional)
              </Label>
              <Input
                type="month"
                value={warrantyExpiry}
                onChange={(e) => setWarrantyExpiry(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <FileText className="h-3 w-3" /> Notes
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this asset…"
                className="resize-none h-20 text-sm"
              />
            </div>

            {/* Save */}
            <div className="pt-2">
              <Button
                className="w-full gap-2"
                onClick={handleSave}
                disabled={!name.trim() || busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save Changes
                  </>
                )}
              </Button>
            </div>

            {/* Retire / Unretire */}
            <div className="pt-1 border-t">
              {isRetired ? (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-chart-1 border-chart-1/30 hover:bg-chart-1/5 hover:text-chart-1"
                  onClick={() => setUnretireDialogOpen(true)}
                  disabled={busy}
                >
                  <ArchiveRestore className="h-4 w-4" />
                  Restore to Active Assets
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full gap-2 text-muted-foreground hover:text-amber-700 hover:bg-amber-50"
                  onClick={() => setRetireDialogOpen(true)}
                  disabled={busy}
                >
                  <Archive className="h-4 w-4" />
                  Retire this Asset
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Retire confirm */}
      <AlertDialog open={retireDialogOpen} onOpenChange={setRetireDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire "{asset?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This asset will be removed from your active inventory. All service history, maintenance records, and cost data will be preserved. You can restore it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleRetire}
            >
              <Archive className="h-4 w-4 mr-2" />
              Yes, Retire Asset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unretire confirm */}
      <AlertDialog open={unretireDialogOpen} onOpenChange={setUnretireDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore "{asset?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This asset will be moved back into your active inventory and will appear in maintenance schedules and health scoring again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnretire}>
              <ArchiveRestore className="h-4 w-4 mr-2" />
              Yes, Restore Asset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
