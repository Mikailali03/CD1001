import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateProperty,
  getGetPropertyQueryKey,
  getListPropertiesQueryKey,
  type Property,
} from "@workspace/api-client-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  Building2,
  Camera,
  Loader2,
  X,
  ImagePlus,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Props = {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export function EditPropertySheet({ property, open, onOpenChange, onSaved }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const authFetch = useAuthFetch();
  const updateProperty = useUpdateProperty();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [sqft, setSqft] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && property) populate(property);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, property?.id]);

  function populate(p: Property) {
    setName(p.name ?? "");
    setAddress(p.address ?? "");
    setCity(p.city ?? "");
    setState(p.state ?? "");
    setZipCode(p.zipCode ?? "");
    setYearBuilt(p.yearBuilt != null ? String(p.yearBuilt) : "");
    setSqft(p.sqft != null ? String(p.sqft) : "");
    setBedrooms(p.bedrooms != null ? String(p.bedrooms) : "");
    setBathrooms(p.bathrooms != null ? String(p.bathrooms) : "");
    setPhotoPreview(p.photoUrl ?? null);
    setPendingPhotoUrl(null);
  }

  function handleOpenChange(v: boolean) {
    if (v && property) populate(property);
    onOpenChange(v);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPhotoPreview(localPreview);
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
      setPhotoPreview(property?.photoUrl ?? null);
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

  async function handleSave() {
    if (!property?.id || !name.trim()) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        name: name.trim(),
        address: address.trim() || undefined,
        city: city.trim() || null,
        state: state.trim() || null,
        zipCode: zipCode.trim() || null,
        yearBuilt: yearBuilt ? parseInt(yearBuilt) : null,
        sqft: sqft ? parseInt(sqft) : null,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseFloat(bathrooms) : null,
      };

      if (pendingPhotoUrl !== null) {
        patch.photoUrl = pendingPhotoUrl || null;
      }

      await updateProperty.mutateAsync(
        { propertyId: property.id, data: patch as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(property.id) });
            queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
            toast({ title: "Property updated" });
            onSaved?.();
            onOpenChange(false);
          },
          onError: () => toast({ title: "Could not save changes", variant: "destructive" }),
        }
      );
    } finally {
      setSaving(false);
    }
  }

  const currentPhoto = photoPreview;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <SheetTitle className="text-lg">Edit Property</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Photo */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Property Photo</Label>
            <div className="relative group">
              {currentPhoto ? (
                <div className="relative h-44 w-full rounded-xl overflow-hidden border border-border">
                  <img src={currentPhoto} alt="Property" className="h-full w-full object-cover" />
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
                        <X className="h-3.5 w-3.5" />
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
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Property Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Johnson Family Home" />
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Street Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          {/* City + State */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} placeholder="TX" />
            </div>
          </div>

          {/* Zip */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ZIP Code</Label>
            <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="78701" />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Year Built</Label>
              <Input value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} type="number" placeholder="1990" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sq Ft</Label>
              <Input value={sqft} onChange={(e) => setSqft(e.target.value)} type="number" placeholder="2000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bedrooms</Label>
              <Input value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} type="number" placeholder="3" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bathrooms</Label>
              <Input value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} type="number" step="0.5" placeholder="2" />
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-4 flex items-center justify-end gap-2 shrink-0 bg-muted/20">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || uploading || !name.trim()}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
