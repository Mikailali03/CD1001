import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Camera,
  Upload,
  Scan,
  Loader2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  PenLine,
  Image as ImageIcon,
  X,
  Tag,
  Hash,
  Calendar,
  DollarSign,
  Wrench,
  AlertCircle,
  ZapIcon,
  Lock,
} from "lucide-react";
import { useSubscription } from "@/contexts/subscription-context";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function compressForScan(file: File, maxPx = 1600, quality = 0.82): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({ base64: dataUrl.split(",")[1]!, mimeType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const CATEGORIES = ["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"] as const;
type Category = typeof CATEGORIES[number];

type ScanResult = {
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  manufactureDate: string | null;
  estimatedReplacementCost: number | null;
  category: Category | null;
  suggestedName: string | null;
};

type Step = "method" | "lens" | "review" | "generating" | "done";

type Props = {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (assetId: string) => void;
};

const CATEGORY_ICONS: Record<string, string> = {
  HVAC: "❄️",
  Plumbing: "🔧",
  Electrical: "⚡",
  Roof: "🏠",
  Appliance: "🫙",
  Structural: "🏗️",
  Other: "📦",
};

function FileDropZone({
  onFile,
  isScanning,
}: {
  onFile: (f: File) => void;
  isScanning: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) onFile(file);
    },
    [onFile]
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
        }`}
        onClick={() => fileRef.current?.click()}
      >
        <div className="bg-primary/10 p-4 rounded-full">
          <ImageIcon className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-sm">Drop a photo here</p>
          <p className="text-xs text-muted-foreground mt-1">of the spec plate, label, or the unit itself</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="gap-2 h-11"
          disabled={isScanning}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
          Take Photo
        </Button>
        <Button
          variant="outline"
          className="gap-2 h-11"
          disabled={isScanning}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Browse Files
        </Button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

export function AddAssetDialog({ propertyId, open, onOpenChange, onCreated }: Props) {
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();
  const { toast } = useToast();
  const { subscription, openUpgradeModal } = useSubscription();
  const aiScanLocked = subscription?.tier === "essential" && (subscription?.aiScansUsed ?? 0) >= 1;
  const aiPlanLocked = subscription?.tier === "essential" && (subscription?.aiPlansUsed ?? 0) >= 1;

  const [step, setStep] = useState<Step>("method");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Editable form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("HVAC");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [replacementCost, setReplacementCost] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");

  const [saveBusy, setSaveBusy] = useState(false);
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);
  const [planBlocked, setPlanBlocked] = useState(false);

  function reset() {
    setStep("method");
    setImageFile(null);
    setImagePreview(null);
    setScanBusy(false);
    setScanResult(null);
    setScanError(null);
    setName(""); setCategory("HVAC"); setBrand(""); setModel("");
    setSerialNumber(""); setInstallDate(""); setReplacementCost(""); setWarrantyExpiry("");
    setSaveBusy(false);
    setTaskCount(null);
    setCreatedAssetId(null);
    setPlanBlocked(false);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function applyManual() {
    setStep("review");
  }

  function handleImageSelected(file: File) {
    setImageFile(file);
    setScanError(null);
    setScanResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleScan() {
    if (!imageFile) return;
    setScanBusy(true);
    setScanError(null);

    try {
      const { base64, mimeType } = await compressForScan(imageFile);

      const res = await authFetch(`${BASE}/api/assets/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      if (!res.ok) {
        setScanError("Scan failed — please try a clearer photo or enter details manually.");
        return;
      }

      const data: ScanResult = await res.json();
      setScanResult(data);

      // Pre-fill form
      if (data.suggestedName) setName(data.suggestedName);
      else if (data.brand && data.model) setName(`${data.brand} ${data.model}`);
      else if (data.brand) setName(data.brand);

      if (data.category) setCategory(data.category);
      if (data.brand) setBrand(data.brand);
      if (data.model) setModel(data.model);
      if (data.serialNumber) setSerialNumber(data.serialNumber);
      if (data.manufactureDate) setInstallDate(data.manufactureDate.substring(0, 7));
      if (data.estimatedReplacementCost) setReplacementCost(String(data.estimatedReplacementCost));

      setStep("review");
    } catch {
      setScanError("Could not reach the scan service. Please try again.");
    } finally {
      setScanBusy(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaveBusy(true);
    setStep("generating");

    try {
      // Create the asset
      const res = await authFetch(`${BASE}/api/properties/${propertyId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
          installDate: installDate || undefined,
          replacementCost: replacementCost ? parseFloat(replacementCost) : undefined,
          warrantyExpiry: warrantyExpiry ? `${warrantyExpiry}-01` : undefined,
        }),
      });

      if (!res.ok) {
        toast({ title: "Could not save asset", variant: "destructive" });
        setStep("review");
        return;
      }

      const asset = await res.json();
      setCreatedAssetId(asset.id);

      // Invalidate asset lists
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => typeof k === "string" && (k.includes("assets") || k.includes("properties"))) });

      // Trigger autonomous task generation
      try {
        const taskRes = await authFetch(`${BASE}/api/assets/${asset.id}/generate-tasks`, { method: "POST" });
        if (taskRes.ok) {
          const td = await taskRes.json();
          setTaskCount(td.taskCount);
        } else if (taskRes.status === 403) {
          setPlanBlocked(true);
          setTaskCount(0);
        } else {
          setTaskCount(0);
        }
      } catch {
        setTaskCount(0);
      }

      // Invalidate again after tasks generated
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => typeof k === "string" && (k.includes("assets") || k.includes("properties") || k.includes("maintenance") || k.includes("summary"))) });

      setStep("done");
      onCreated?.(asset.id);
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
      setStep("review");
    } finally {
      setSaveBusy(false);
    }
  }

  const fieldsFilled = [brand, model, serialNumber].filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">

        {/* ── Step: Choose Method ── */}
        {step === "method" && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-xl">
                  <Wrench className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Add an Asset</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">Log a home system or appliance to track its maintenance.</p>
                </div>
              </div>
            </DialogHeader>

            <div className="px-6 py-6 space-y-3">
              {/* AI Lens option */}
              <button
                onClick={aiScanLocked ? () => openUpgradeModal() : () => setStep("lens")}
                className={`w-full text-left rounded-xl border-2 transition-all p-4 group ${
                  aiScanLocked
                    ? "border-muted bg-muted/30 opacity-70 cursor-pointer"
                    : "border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`rounded-xl p-3 shrink-0 ${aiScanLocked ? "bg-muted" : "bg-primary/15"}`}>
                    {aiScanLocked ? (
                      <Lock className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <Scan className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">AI Lens</p>
                      {aiScanLocked ? (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 text-[10px] font-semibold px-1.5 py-0">
                          <Lock className="h-2.5 w-2.5 mr-0.5" />
                          Upgrade to Basic
                        </Badge>
                      ) : (
                        <Badge className="bg-primary/15 text-primary border-0 text-[10px] font-semibold px-1.5 py-0">RECOMMENDED</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {aiScanLocked
                        ? "You've used your free AI scan. Upgrade to Basic for unlimited AI scans."
                        : "Take a photo of the spec plate or label. AI extracts brand, model, serial number, and manufacture date instantly."}
                    </p>
                    {!aiScanLocked && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {["Auto-fills all fields", "Works on any label", "Estimates replacement cost"].map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 text-[10px] text-primary font-medium">
                            <CheckCircle2 className="h-3 w-3" />{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ArrowRight className={`h-4 w-4 shrink-0 mt-1 transition-colors ${aiScanLocked ? "text-muted-foreground" : "text-muted-foreground group-hover:text-primary"}`} />
                </div>
              </button>

              {/* Manual option */}
              <button
                onClick={applyManual}
                className="w-full text-left rounded-xl border hover:border-muted-foreground/40 hover:bg-muted/30 transition-all p-4 group"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-muted rounded-xl p-3 shrink-0">
                    <PenLine className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Enter Manually</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Type in the details yourself — brand, model, serial number, etc.</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </div>
              </button>
            </div>

            <div className="border-t px-6 py-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>Cancel</Button>
            </div>
          </>
        )}

        {/* ── Step: AI Lens ── */}
        {step === "lens" && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-xl">
                  <Scan className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg">AI Lens</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">Photo of the spec plate, data tag, or the unit itself.</p>
                </div>
              </div>
            </DialogHeader>

            <div className="px-6 py-5 space-y-4">
              {!imagePreview ? (
                <FileDropZone onFile={handleImageSelected} isScanning={scanBusy} />
              ) : (
                <div className="space-y-3">
                  {/* Image preview */}
                  <div className="relative rounded-xl overflow-hidden border bg-muted/30 aspect-video flex items-center justify-center">
                    <img src={imagePreview} alt="Spec plate preview" className="max-h-48 w-auto object-contain" />
                    {!scanBusy && (
                      <button
                        onClick={() => { setImageFile(null); setImagePreview(null); setScanResult(null); setScanError(null); }}
                        className="absolute top-2 right-2 bg-background/90 rounded-full p-1 hover:bg-background border shadow-sm"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {scanBusy && (
                      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-sm font-medium text-primary">Reading spec plate…</p>
                      </div>
                    )}
                  </div>

                  {/* Scan error */}
                  {scanError && (
                    <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-xs text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      {scanError}
                    </div>
                  )}

                  {/* Scan trigger */}
                  {!scanBusy && !scanError && (
                    <Button onClick={handleScan} className="w-full gap-2" disabled={scanBusy}>
                      <ZapIcon className="h-4 w-4" />
                      Scan with AI
                    </Button>
                  )}

                  {scanError && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" onClick={() => { setImageFile(null); setImagePreview(null); setScanError(null); }}>
                        Retake Photo
                      </Button>
                      <Button onClick={applyManual}>Enter Manually</Button>
                    </div>
                  )}
                </div>
              )}

              <p className="text-center text-[11px] text-muted-foreground">
                Best results: spec plates, energy labels, model/serial stickers
              </p>
            </div>

            <div className="border-t px-6 py-4 flex items-center justify-between">
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setStep("method")}>
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button variant="ghost" size="sm" onClick={applyManual}>
                Skip — Enter Manually
              </Button>
            </div>
          </>
        )}

        {/* ── Step: Review / Edit Fields ── */}
        {step === "review" && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${scanResult ? "bg-emerald-100" : "bg-muted"}`}>
                  {scanResult
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    : <PenLine className="h-5 w-5 text-muted-foreground" />
                  }
                </div>
                <div>
                  <DialogTitle className="text-lg">
                    {scanResult ? "Review Extracted Details" : "Asset Details"}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {scanResult
                      ? `${fieldsFilled} of 3 fields extracted — edit anything that's off.`
                      : "Fill in the details for this asset."}
                  </p>
                </div>
              </div>
            </DialogHeader>

            {/* AI extraction summary banner */}
            {scanResult && (
              <div className="mx-6 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-800 space-y-0.5">
                  <p className="font-semibold">AI Lens extracted {fieldsFilled + (scanResult.manufactureDate ? 1 : 0) + (scanResult.estimatedReplacementCost ? 1 : 0)} fields</p>
                  <p className="text-emerald-700">Review and correct anything below before saving.</p>
                </div>
              </div>
            )}

            <div className="px-6 py-4 space-y-3 max-h-[55vh] overflow-y-auto">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
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
                <Label className="text-xs font-medium text-muted-foreground">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
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
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3" />Brand / Make
                    {scanResult?.brand && <span className="text-emerald-600 text-[10px]">✓ AI</span>}
                  </Label>
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Carrier" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    Model Number
                    {scanResult?.model && <span className="text-emerald-600 text-[10px]">✓ AI</span>}
                  </Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Optional" className="font-mono text-sm" />
                </div>
              </div>

              {/* Serial Number */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" />Serial Number
                  {scanResult?.serialNumber && <span className="text-emerald-600 text-[10px]">✓ AI</span>}
                </Label>
                <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Found on the unit's label" className="font-mono text-sm" />
              </div>

              {/* Install Date + Warranty Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />Manufacture / Install Date
                    {scanResult?.manufactureDate && <span className="text-emerald-600 text-[10px]">✓ AI</span>}
                  </Label>
                  <Input
                    type="month"
                    value={installDate}
                    onChange={(e) => setInstallDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />Warranty Expiry
                  </Label>
                  <Input
                    type="month"
                    value={warrantyExpiry}
                    onChange={(e) => setWarrantyExpiry(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Replacement Cost */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />Est. Replacement Cost
                  {scanResult?.estimatedReplacementCost && <span className="text-emerald-600 text-[10px]">✓ AI</span>}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    value={replacementCost}
                    onChange={(e) => setReplacementCost(e.target.value)}
                    placeholder="0"
                    type="number"
                    className="pl-7"
                  />
                </div>
              </div>
            </div>

            <div className="border-t px-6 py-4 flex items-center justify-between gap-3 bg-muted/20">
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setStep(imagePreview ? "lens" : "method")}>
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  AI will generate maintenance tasks
                </div>
                <Button onClick={handleSave} disabled={!name.trim() || saveBusy} className="gap-1.5">
                  Save & Generate Plan
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Step: Generating Tasks ── */}
        {step === "generating" && (
          <>
            <div className="px-6 py-12 flex flex-col items-center text-center gap-5">
              <div className="relative">
                <div className="bg-primary/10 rounded-full p-5">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold">AI Research Agent at work</h3>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                  Looking up the official {brand || "manufacturer"} maintenance schedule for{" "}
                  {model ? <><strong>{model}</strong> and generating</> : "your asset and generating"} step-by-step DIY instructions…
                </p>
              </div>
              <div className="w-full max-w-xs space-y-2 pt-2">
                {[
                  `Identifying ${brand || "manufacturer"} service requirements`,
                  "Generating step-by-step DIY instructions",
                  "Scheduling due dates based on install date",
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t px-6 py-4 flex flex-col items-center gap-1.5">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleClose(false)}>
                Close — I'll check back later
              </Button>
              <p className="text-xs text-muted-foreground">Your plan will finish generating in the background.</p>
            </div>
          </>
        )}

        {/* ── Step: Done ── */}
        {step === "done" && (
          <>
            <div className="px-6 py-10 flex flex-col items-center text-center gap-5">
              <div className="bg-emerald-100 rounded-full p-5">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold">{name} is in your dossier!</h3>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                  {planBlocked
                    ? "Asset saved. Upgrade to Basic to unlock AI maintenance plans."
                    : "Asset saved and your personalized maintenance schedule has been generated."}
                </p>
              </div>

              {taskCount != null && taskCount > 0 ? (
                <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-emerald-800">
                      {taskCount} maintenance tasks generated
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Brand-specific tasks with step-by-step DIY instructions and due dates.
                    </p>
                  </div>
                </div>
              ) : planBlocked ? (
                <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-amber-800">
                      Free AI plan used
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      You've used your 1 free AI maintenance plan. Upgrade to Basic for unlimited plans on all assets.
                    </p>
                  </div>
                  <Button size="sm" className="shrink-0 text-xs" onClick={openUpgradeModal}>
                    Upgrade
                  </Button>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2 w-full text-xs text-muted-foreground">
                {[
                  { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Asset added to dossier" },
                  { icon: <Sparkles className="h-3.5 w-3.5" />, text: planBlocked ? "AI plan locked (free tier)" : "Maintenance plan generated" },
                  { icon: <Calendar className="h-3.5 w-3.5" />, text: planBlocked ? "Add tasks manually in asset detail" : "Tasks scheduled with due dates" },
                  { icon: <Wrench className="h-3.5 w-3.5" />, text: "Status set to Verified" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className={planBlocked && i === 1 ? "text-amber-500" : "text-emerald-600"}>{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-between">
              <Button variant="outline" onClick={reset}>Add Another Asset</Button>
              <Button onClick={() => handleClose(false)} className="gap-1.5">
                View Asset
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
