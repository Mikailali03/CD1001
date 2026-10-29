import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { uploadObject } from "@/lib/upload";
import { useToast } from "@/hooks/use-toast";
import { useSubscription, isBasicPlus } from "@/contexts/subscription-context";
import {
  useListLockerFolders,
  useListLockerFiles,
  getListLockerFoldersQueryKey,
  getListLockerFilesQueryKey,
  createLockerFile,
  createLockerFolder,
  updateLockerFolder,
  deleteLockerFolder,
  updateLockerFile,
  deleteLockerFile,
  type LockerFolder,
  type LockerFile,
  type ListLockerFilesParams,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Upload } from "lucide-react";
import { LockerUpgradeGate } from "@/components/locker/locker-upgrade-gate";
import { LockerSidebar, type ActiveFolder } from "@/components/locker/locker-sidebar";
import { LockerPhotoGrid } from "@/components/locker/locker-photo-grid";
import { FolderNameDialog } from "@/components/locker/folder-name-dialog";
import { MoveFileDialog } from "@/components/locker/move-file-dialog";
import { ConfirmDeleteDialog } from "@/components/locker/confirm-delete-dialog";
import { LockerLightbox } from "@/components/locker/locker-lightbox";

export default function DigitalLocker() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { subscription, isLoading: subscriptionLoading, openUpgradeModal } = useSubscription();
  const locked = !isBasicPlus(subscription?.tier);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeFolderId, setActiveFolderId] = useState<ActiveFolder>("all");
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

  // The server reads folderId="null" as "files without a folder".
  const filesQueryParams: ListLockerFilesParams = activeFolderId === "all"
    ? {}
    : activeFolderId === null
    ? { folderId: "null" }
    : { folderId: activeFolderId };

  const { data: files = [], isLoading: filesLoading } = useListLockerFiles(
    filesQueryParams,
    { query: { queryKey: getListLockerFilesQueryKey(filesQueryParams) } },
  );

  function invalidateFolders() {
    queryClient.invalidateQueries({ queryKey: getListLockerFoldersQueryKey() });
  }
  function invalidateFiles() {
    // Prefix match covers every folder filter.
    queryClient.invalidateQueries({ queryKey: getListLockerFilesQueryKey() });
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
        // Documents are stored at full resolution (no compression) so they stay legible.
        const objectPath = await uploadObject(file);

        try {
          await createLockerFile({
            name: file.name,
            objectPath,
            contentType: file.type || "image/jpeg",
            size: file.size,
            folderId: activeFolderId === "all" || activeFolderId === null ? undefined : activeFolderId,
          });
        } catch {
          throw new Error(t("locker.saveRecordFailed"));
        }

        done++;
        setUploadProgress(Math.round((done / selectedFiles.length) * 100));
      } catch (err) {
        toast({
          title: t("locker.uploadFailed", { name: file.name }),
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      }
    }

    setUploading(false);
    setUploadProgress(0);
    invalidateFiles();
    if (done > 0) {
      toast({ title: t("locker.uploaded", { count: done }) });
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setSavingFolder(true);
    try {
      const folder = await createLockerFolder({ name: newFolderName.trim() });
      invalidateFolders();
      setCreateFolderOpen(false);
      setNewFolderName("");
      setActiveFolderId(folder.id);
      toast({ title: t("locker.folderCreated", { name: folder.name }) });
    } catch {
      toast({ title: t("locker.couldNotCreateFolder"), variant: "destructive" });
    } finally {
      setSavingFolder(false);
    }
  }

  async function handleRenameFolder() {
    if (!renamingFolder || !renameFolderName.trim()) return;
    setSavingFolder(true);
    try {
      await updateLockerFolder(renamingFolder.id, { name: renameFolderName.trim() });
      invalidateFolders();
      setRenamingFolder(null);
      toast({ title: t("locker.folderRenamed") });
    } catch {
      toast({ title: t("locker.couldNotRenameFolder"), variant: "destructive" });
    } finally {
      setSavingFolder(false);
    }
  }

  async function handleDeleteFolder() {
    if (!deletingFolder) return;
    try {
      await deleteLockerFolder(deletingFolder.id);
      invalidateFolders();
      invalidateFiles();
      if (activeFolderId === deletingFolder.id) setActiveFolderId("all");
      setDeletingFolder(null);
      toast({ title: t("locker.folderDeleted", { name: deletingFolder.name }) });
    } catch {
      toast({ title: t("locker.couldNotDeleteFolder"), variant: "destructive" });
    }
  }

  async function handleDeleteFile() {
    if (!deletingFile) return;
    try {
      await deleteLockerFile(deletingFile.id);
      invalidateFiles();
      setDeletingFile(null);
      if (lightboxIndex !== null) setLightboxIndex(null);
      toast({ title: t("locker.photoDeleted") });
    } catch {
      toast({ title: t("locker.couldNotDeletePhoto"), variant: "destructive" });
    }
  }

  async function handleMoveFile(fileId: string, folderId: string | null) {
    try {
      await updateLockerFile(fileId, { folderId });
      invalidateFiles();
      setMoveFileId(null);
      toast({ title: folderId ? t("locker.movedToFolder") : t("locker.movedToAll") });
    } catch {
      toast({ title: t("locker.couldNotMovePhoto"), variant: "destructive" });
    }
  }

  const lightboxFiles = files.filter((f) => f.contentType.startsWith("image/"));

  if (subscriptionLoading) {
    return (
      <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    );
  }

  if (locked) {
    return <LockerUpgradeGate onUpgrade={openUpgradeModal} />;
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Sidebar ── */}
      <LockerSidebar
        folders={folders}
        foldersLoading={foldersLoading}
        activeFolderId={activeFolderId}
        onSelect={setActiveFolderId}
        onRename={(folder) => { setRenamingFolder(folder); setRenameFolderName(folder.name); }}
        onDelete={setDeletingFolder}
        onNewFolder={() => { setNewFolderName(""); setCreateFolderOpen(true); }}
      />

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="border-b px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h1 className="text-base font-semibold leading-none">
              {activeFolderId === "all"
                ? t("locker.allPhotos")
                : activeFolderId === null
                ? t("locker.unorganized")
                : folders.find((f) => f.id === activeFolderId)?.name ?? t("locker.folder")}
            </h1>
            {!filesLoading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("locker.photoCount", { count: files.length })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {uploading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("locker.uploadingProgress", { percent: uploadProgress })}
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
              {t("locker.uploadPhotos")}
            </Button>
          </div>
        </div>

        {/* Photo grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <LockerPhotoGrid
            files={files}
            imageFiles={lightboxFiles}
            filesLoading={filesLoading}
            uploading={uploading}
            onUploadClick={() => fileInputRef.current?.click()}
            onView={setLightboxIndex}
            onMove={setMoveFileId}
            onDelete={setDeletingFile}
          />
        </div>
      </main>

      {/* ── Create Folder Dialog ── */}
      <FolderNameDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        title={t("locker.newFolderTitle")}
        value={newFolderName}
        onChange={setNewFolderName}
        onSubmit={handleCreateFolder}
        submitLabel={t("common.create")}
        saving={savingFolder}
        placeholder={t("locker.folderName")}
      />

      {/* ── Rename Folder Dialog ── */}
      <FolderNameDialog
        open={!!renamingFolder}
        onOpenChange={(v) => !v && setRenamingFolder(null)}
        title={t("locker.renameFolderTitle")}
        value={renameFolderName}
        onChange={setRenameFolderName}
        onSubmit={handleRenameFolder}
        submitLabel={t("common.save")}
        saving={savingFolder}
      />

      {/* ── Move to Folder Dialog ── */}
      <MoveFileDialog
        open={!!moveFileId}
        onClose={() => setMoveFileId(null)}
        folders={folders}
        onMove={(folderId) => moveFileId && handleMoveFile(moveFileId, folderId)}
      />

      {/* ── Delete Folder Confirm ── */}
      <ConfirmDeleteDialog
        open={!!deletingFolder}
        onClose={() => setDeletingFolder(null)}
        title={t("locker.deleteFolderTitle")}
        description={t("locker.deleteFolderDesc", { name: deletingFolder?.name ?? "" })}
        confirmLabel={t("locker.deleteFolder")}
        onConfirm={handleDeleteFolder}
      />

      {/* ── Delete File Confirm ── */}
      <ConfirmDeleteDialog
        open={!!deletingFile}
        onClose={() => setDeletingFile(null)}
        title={t("locker.deletePhotoTitle")}
        description={t("locker.deletePhotoDesc", { name: deletingFile?.name ?? "" })}
        confirmLabel={t("common.delete")}
        onConfirm={handleDeleteFile}
      />

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && lightboxFiles.length > 0 && (
        <LockerLightbox
          files={lightboxFiles}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={setDeletingFile}
        />
      )}
    </div>
  );
}
