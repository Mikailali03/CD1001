import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { useSubscription, isBasicPlus } from "@/contexts/subscription-context";
import {
  useListLockerFolders,
  useListLockerFiles,
  getListLockerFoldersQueryKey,
  getListLockerFilesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  FolderOpen,
  FolderPlus,
  Images,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  FolderIcon,
  Lock,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type LockerFolder = { id: string; userId: string; name: string; createdAt: string; updatedAt: string };
type LockerFile = { id: string; userId: string; folderId?: string | null; name: string; objectPath: string; contentType: string; size?: number | null; createdAt: string };

function photoSrc(objectPath: string) {
  return `${BASE}/api/storage${objectPath}`;
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DigitalLocker() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { subscription, openUpgradeModal } = useSubscription();
  const locked = !isBasicPlus(subscription?.tier);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeFolderId, setActiveFolderId] = useState<string | null | "all">("all");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);

  const [renamingFolder, setRenamingFolder] = useState<LockerFolder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [deletingFolder, setDeletingFolder] = useState<LockerFolder | null>(null);
  const [deletingFile, setDeletingFile] = useState<LockerFile | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [moveFileId, setMoveFileId] = useState<string | null>(null);

  const { data: folders = [], isLoading: foldersLoading } = useListLockerFolders({
    query: { queryKey: getListLockerFoldersQueryKey() },
  });

  const filesQueryParams = activeFolderId === "all"
    ? {}
    : activeFolderId === null
    ? { folderId: "null" }
    : { folderId: activeFolderId };

  const { data: files = [], isLoading: filesLoading } = useListLockerFiles(
    filesQueryParams as any,
    { query: { queryKey: getListLockerFilesQueryKey(filesQueryParams as any) } },
  );

  function invalidateFolders() {
    queryClient.invalidateQueries({ queryKey: getListLockerFoldersQueryKey() });
  }
  function invalidateFiles() {
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "/api/locker/files" });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (!selectedFiles.length) return;
    e.target.value = "";

    setUploading(true);
    setUploadProgress(0);

    let done = 0;
    for (const file of selectedFiles) {
      try {
        const urlRes = await authFetch(`${BASE}/api/storage/uploads/request-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "image/jpeg" }),
        });
        if (!urlRes.ok) throw new Error("Failed to get upload URL");
        const { uploadURL, objectPath } = await urlRes.json();

        await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/jpeg" } });

        const metaRes = await authFetch(`${BASE}/api/locker/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            objectPath,
            contentType: file.type || "image/jpeg",
            size: file.size,
            folderId: activeFolderId === "all" || activeFolderId === null ? undefined : activeFolderId,
          }),
        });
        if (!metaRes.ok) throw new Error("Failed to save file record");

        done++;
        setUploadProgress(Math.round((done / selectedFiles.length) * 100));
      } catch {
        toast({ title: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }

    setUploading(false);
    setUploadProgress(0);
    invalidateFiles();
    if (done > 0) {
      toast({ title: `${done} photo${done !== 1 ? "s" : ""} uploaded` });
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setSavingFolder(true);
    try {
      const res = await authFetch(`${BASE}/api/locker/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      if (!res.ok) throw new Error();
      const folder = await res.json();
      invalidateFolders();
      setCreateFolderOpen(false);
      setNewFolderName("");
      setActiveFolderId(folder.id);
      toast({ title: `Folder "${folder.name}" created` });
    } catch {
      toast({ title: "Could not create folder", variant: "destructive" });
    } finally {
      setSavingFolder(false);
    }
  }

  async function handleRenameFolder() {
    if (!renamingFolder || !renameFolderName.trim()) return;
    setSavingFolder(true);
    try {
      const res = await authFetch(`${BASE}/api/locker/folders/${renamingFolder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameFolderName.trim() }),
      });
      if (!res.ok) throw new Error();
      invalidateFolders();
      setRenamingFolder(null);
      toast({ title: "Folder renamed" });
    } catch {
      toast({ title: "Could not rename folder", variant: "destructive" });
    } finally {
      setSavingFolder(false);
    }
  }

  async function handleDeleteFolder() {
    if (!deletingFolder) return;
    try {
      const res = await authFetch(`${BASE}/api/locker/folders/${deletingFolder.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      invalidateFolders();
      invalidateFiles();
      if (activeFolderId === deletingFolder.id) setActiveFolderId("all");
      setDeletingFolder(null);
      toast({ title: `Folder "${deletingFolder.name}" deleted — photos moved to All Photos` });
    } catch {
      toast({ title: "Could not delete folder", variant: "destructive" });
    }
  }

  async function handleDeleteFile() {
    if (!deletingFile) return;
    try {
      const res = await authFetch(`${BASE}/api/locker/files/${deletingFile.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      invalidateFiles();
      setDeletingFile(null);
      if (lightboxIndex !== null) setLightboxIndex(null);
      toast({ title: "Photo deleted" });
    } catch {
      toast({ title: "Could not delete photo", variant: "destructive" });
    }
  }

  async function handleMoveFile(fileId: string, folderId: string | null) {
    try {
      const res = await authFetch(`${BASE}/api/locker/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      if (!res.ok) throw new Error();
      invalidateFiles();
      setMoveFileId(null);
      toast({ title: folderId ? "Photo moved to folder" : "Photo moved to All Photos" });
    } catch {
      toast({ title: "Could not move photo", variant: "destructive" });
    }
  }

  const lightboxFiles = files.filter((f) => f.contentType.startsWith("image/"));

  if (locked) {
    return (
      <div className="relative h-full min-h-0 overflow-hidden">
        {/* Blurred fake page underneath */}
        <div className="blur-sm pointer-events-none select-none opacity-60 flex h-full" aria-hidden>
          <aside className="w-56 shrink-0 border-r bg-muted/30 flex flex-col">
            <div className="px-4 pt-5 pb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Digital Locker</p>
            </div>
            <nav className="flex-1 px-2 space-y-0.5">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                <Images className="h-4 w-4 shrink-0" /> All Photos
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-foreground">
                <FolderOpen className="h-4 w-4 shrink-0" /> Unorganized
              </div>
              {["Living Room", "Kitchen Reno", "Roof Damage"].map((name) => (
                <div key={name} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-foreground">
                  <FolderIcon className="h-4 w-4 shrink-0" /> {name}
                </div>
              ))}
            </nav>
            <div className="p-3 border-t">
              <div className="h-8 rounded-lg border bg-muted w-full" />
            </div>
          </aside>
          <main className="flex-1 flex flex-col">
            <div className="border-b px-6 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded mt-1.5" />
              </div>
              <div className="h-8 w-32 rounded-lg bg-muted" />
            </div>
            <div className="flex-1 p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl bg-muted border" />
                ))}
              </div>
            </div>
          </main>
        </div>

        {/* Upgrade overlay */}
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="bg-background/95 backdrop-blur-sm rounded-2xl border shadow-xl p-8 w-full max-w-md text-center space-y-5">
            <div className="flex justify-center">
              <div className="bg-primary/10 rounded-full p-5">
                <Lock className="h-10 w-10 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Your Digital Locker</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Store and organize photos of your home — renovation progress, damage documentation, appliance receipts, and anything else you want to keep on file. Organized into folders, available forever.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50">
                <Images className="h-5 w-5 text-primary" />
                <span className="leading-snug text-center font-medium">Unlimited photo storage</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50">
                <FolderIcon className="h-5 w-5 text-primary" />
                <span className="leading-snug text-center font-medium">Organized folders</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="leading-snug text-center font-medium">Secure &amp; private</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 pt-1">
              <Button onClick={openUpgradeModal} className="w-full gap-2 h-11">
                <Sparkles className="h-4 w-4" />
                Upgrade to Basic — $9.99/mo
              </Button>
              <p className="text-xs text-muted-foreground">Cancel anytime · No credit card needed to explore</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 border-r bg-muted/30 flex flex-col overflow-y-auto">
        <div className="px-4 pt-5 pb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Digital Locker</p>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          <button
            onClick={() => setActiveFolderId("all")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeFolderId === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"}`}
          >
            <Images className="h-4 w-4 shrink-0" />
            All Photos
          </button>
          <button
            onClick={() => setActiveFolderId(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeFolderId === null ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"}`}
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            Unorganized
          </button>

          {foldersLoading ? (
            <div className="space-y-1 px-1 pt-1">
              {[1, 2].map((i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
            </div>
          ) : (
            folders.map((folder) => (
              <div key={folder.id} className="group relative">
                <button
                  onClick={() => setActiveFolderId(folder.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors pr-8 ${activeFolderId === folder.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"}`}
                >
                  <FolderIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${activeFolderId === folder.id ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => { setRenamingFolder(folder); setRenameFolderName(folder.name); }}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeletingFolder(folder)}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </nav>

        <div className="p-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => { setNewFolderName(""); setCreateFolderOpen(true); }}
          >
            <FolderPlus className="h-3.5 w-3.5" /> New Folder
          </Button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="border-b px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h1 className="text-base font-semibold leading-none">
              {activeFolderId === "all"
                ? "All Photos"
                : activeFolderId === null
                ? "Unorganized"
                : folders.find((f) => f.id === activeFolderId)?.name ?? "Folder"}
            </h1>
            {!filesLoading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {files.length} photo{files.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {uploading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading… {uploadProgress}%
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              className="gap-2"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload Photos
            </Button>
          </div>
        </div>

        {/* Photo grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-center gap-4">
              <div className="bg-muted rounded-full p-6">
                <Images className="h-10 w-10 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">No photos yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload photos to keep a visual record of your home
                </p>
              </div>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Plus className="h-4 w-4" /> Upload your first photo
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {files.map((file, idx) => {
                const isImage = file.contentType.startsWith("image/");
                const imgIdx = lightboxFiles.findIndex((f) => f.id === file.id);
                return (
                  <div
                    key={file.id}
                    className="group relative aspect-square rounded-xl overflow-hidden border bg-muted cursor-pointer"
                    onClick={() => isImage && setLightboxIndex(imgIdx)}
                  >
                    {isImage ? (
                      <img
                        src={photoSrc(file.objectPath)}
                        alt={file.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Images className="h-8 w-8" />
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-end justify-between p-2">
                      <span className="text-white text-xs font-medium truncate opacity-0 group-hover:opacity-100 transition-opacity max-w-[70%]">
                        {file.name}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 rounded-md p-1 text-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {isImage && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLightboxIndex(imgIdx); }}>
                              <ZoomIn className="h-3.5 w-3.5 mr-2" /> View full size
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setMoveFileId(file.id); }}>
                            <FolderIcon className="h-3.5 w-3.5 mr-2" /> Move to folder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeletingFile(file); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Create Folder Dialog ── */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || savingFolder}>
                {savingFolder ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rename Folder Dialog ── */}
      <Dialog open={!!renamingFolder} onOpenChange={(v) => !v && setRenamingFolder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <Input
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRenamingFolder(null)}>Cancel</Button>
              <Button onClick={handleRenameFolder} disabled={!renameFolderName.trim() || savingFolder}>
                {savingFolder ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Move to Folder Dialog ── */}
      <Dialog open={!!moveFileId} onOpenChange={(v) => !v && setMoveFileId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 pt-2">
            <button
              onClick={() => moveFileId && handleMoveFile(moveFileId, null)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors text-left"
            >
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              Unorganized (no folder)
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => moveFileId && handleMoveFile(moveFileId, folder.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors text-left"
              >
                <FolderIcon className="h-4 w-4 text-muted-foreground" />
                {folder.name}
              </button>
            ))}
            {folders.length === 0 && (
              <p className="text-sm text-muted-foreground py-3 text-center">
                No folders yet — create one first
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Folder Confirm ── */}
      <AlertDialog open={!!deletingFolder} onOpenChange={(v) => !v && setDeletingFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingFolder?.name}" will be deleted. Photos inside will move to Unorganized — they won't be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete File Confirm ── */}
      <AlertDialog open={!!deletingFile} onOpenChange={(v) => !v && setDeletingFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete photo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingFile?.name}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && lightboxFiles.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="h-5 w-5" />
          </button>

          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {lightboxIndex < lightboxFiles.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          <div className="max-w-5xl max-h-[90vh] w-full mx-8" onClick={(e) => e.stopPropagation()}>
            <img
              src={photoSrc(lightboxFiles[lightboxIndex]!.objectPath)}
              alt={lightboxFiles[lightboxIndex]!.name}
              className="max-w-full max-h-[80vh] object-contain mx-auto rounded-lg"
            />
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-white/80 text-sm">{lightboxFiles[lightboxIndex]!.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-xs">
                  {lightboxIndex + 1} / {lightboxFiles.length}
                </span>
                <button
                  className="text-red-400 hover:text-red-300 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={() => setDeletingFile(lightboxFiles[lightboxIndex]!)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
