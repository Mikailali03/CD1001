import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
};

type Props = {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (updated: Asset) => void;
};

export function EditAssetSheet({ asset, open, onOpenChange, onSaved }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("HVAC");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [replacementCost, setReplacementCost] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [notes, setNotes] = useState("");

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
  }, [asset]);

  async function handleSave() {
    if (!asset || !name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${BASE}/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          brand: brand.trim() || null,
          model: model.trim() || null,
          serialNumber: serialNumber.trim() || null,
          installDate: installDate ? `${installDate}-01` : null,
          replacementCost: replacementCost
            ? String(parseFloat(replacementCost))
            : null,
          warrantyExpiry: warrantyExpiry ? `${warrantyExpiry}-01` : null,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      const updated = await res.json();
      toast({ title: "Asset updated", description: `${name} has been saved.` });

      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey.some(
            (k) =>
              typeof k === "string" &&
              (k.includes("assets") ||
                k.includes(asset.id) ||
                k.includes("summary"))
          ),
      });

      onSaved?.(updated);
      onOpenChange(false);
    } catch {
      toast({ title: "Could not save changes", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-5">
          <SheetTitle className="flex items-center gap-2">
            {asset ? CATEGORY_ICONS[asset.category] ?? "📦" : ""}
            Edit Asset
          </SheetTitle>
          <SheetDescription>
            Update the details for this asset. Changes are saved immediately.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
