import { useTranslation } from "react-i18next";
import type { LockerFolder } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderOpen, FolderPlus, Images, MoreHorizontal, Pencil, Trash2, FolderIcon } from "lucide-react";

/** "all" = every file, null = files without a folder, otherwise a folder id. */
export type ActiveFolder = string | null | "all";

export function LockerSidebar({
  folders,
  foldersLoading,
  activeFolderId,
  onSelect,
  onRename,
  onDelete,
  onNewFolder,
}: {
  folders: LockerFolder[];
  foldersLoading: boolean;
  activeFolderId: ActiveFolder;
  onSelect: (id: ActiveFolder) => void;
  onRename: (folder: LockerFolder) => void;
  onDelete: (folder: LockerFolder) => void;
  onNewFolder: () => void;
}) {
  const { t } = useTranslation();
  return (
    <aside className="w-56 shrink-0 border-r bg-muted/30 flex flex-col overflow-y-auto">
      <div className="px-4 pt-5 pb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">{t("locker.title")}</p>
      </div>

      <nav className="flex-1 px-2 space-y-0.5">
        <button
          onClick={() => onSelect("all")}
          aria-pressed={activeFolderId === "all"}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeFolderId === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"}`}
        >
          <Images className="h-4 w-4 shrink-0" />
          {t("locker.allPhotos")}
        </button>
        <button
          onClick={() => onSelect(null)}
          aria-pressed={activeFolderId === null}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeFolderId === null ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"}`}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          {t("locker.unorganized")}
        </button>

        {foldersLoading ? (
          <div className="space-y-1 px-1 pt-1">
            {[1, 2].map((i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
          </div>
        ) : (
          folders.map((folder) => (
            <div key={folder.id} className="group relative">
              <button
                onClick={() => onSelect(folder.id)}
                aria-pressed={activeFolderId === folder.id}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors pr-8 ${activeFolderId === folder.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"}`}
              >
                <FolderIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{folder.name}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label={t("locker.folderOptions", { name: folder.name })} className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity ${activeFolderId === folder.id ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => onRename(folder)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> {t("common.rename")}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(folder)}>
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> {t("common.delete")}
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
          onClick={onNewFolder}
        >
          <FolderPlus className="h-3.5 w-3.5" /> {t("locker.newFolder")}
        </Button>
      </div>
    </aside>
  );
}
