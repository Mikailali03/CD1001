import { useTranslation } from "react-i18next";
import type { LockerFile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Images, MoreHorizontal, Plus, Trash2, ZoomIn, FolderIcon } from "lucide-react";
import { LockerImage } from "./locker-image";

export function LockerPhotoGrid({
  files,
  imageFiles,
  filesLoading,
  uploading,
  onUploadClick,
  onView,
  onMove,
  onDelete,
}: {
  files: LockerFile[];
  /** The image subset, in lightbox order. */
  imageFiles: LockerFile[];
  filesLoading: boolean;
  uploading: boolean;
  onUploadClick: () => void;
  onView: (imageIndex: number) => void;
  onMove: (fileId: string) => void;
  onDelete: (file: LockerFile) => void;
}) {
  const { t } = useTranslation();

  if (filesLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-64 text-center gap-4">
        <div className="bg-muted rounded-full p-6">
          <Images className="h-10 w-10 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold">{t("locker.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("locker.emptyDesc")}
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={onUploadClick}
          disabled={uploading}
        >
          <Plus className="h-4 w-4" /> {t("locker.uploadFirst")}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {files.map((file) => {
        const isImage = file.contentType.startsWith("image/");
        const imgIdx = imageFiles.findIndex((f) => f.id === file.id);
        return (
          <div
            key={file.id}
            className="group relative aspect-square rounded-xl overflow-hidden border bg-muted cursor-pointer"
            onClick={() => isImage && onView(imgIdx)}
          >
            {isImage ? (
              <LockerImage
                objectPath={file.objectPath}
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
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 group-focus-within:bg-black/40 [@media(hover:none)]:bg-gradient-to-t [@media(hover:none)]:from-black/50 [@media(hover:none)]:to-transparent transition-colors duration-200 flex items-end justify-between p-2">
              <span className="text-white text-xs font-medium truncate opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity max-w-[70%]">
                {file.name}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 rounded-md p-1 text-white"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={t("locker.fileOptions", { name: file.name })}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {isImage && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(imgIdx); }}>
                      <ZoomIn className="h-3.5 w-3.5 mr-2" /> {t("locker.viewFullSize")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(file.id); }}>
                    <FolderIcon className="h-3.5 w-3.5 mr-2" /> {t("locker.moveToFolder")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(file); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
