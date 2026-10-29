import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { Asset } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Archive, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { format } from "@/lib/date";

// ── Collapsible list of retired assets ────────────────────────────────────────
export function RetiredAssetsSection({ retiredAssets, propertyId, onEdit }: {
  retiredAssets: Asset[];
  propertyId: string;
  onEdit: (asset: Asset) => void;
}) {
  const { t } = useTranslation();
  const [retiredOpen, setRetiredOpen] = useState(false);

  if (retiredAssets.length === 0) return null;

  return (
    <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 overflow-hidden">
      <button
        onClick={() => setRetiredOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-amber-600" />
          {t("propertyDetail.retiredAssets")}
          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-amber-200 ml-1">
            {retiredAssets.length}
          </Badge>
        </span>
        {retiredOpen
          ? <ChevronDown className="h-4 w-4 text-amber-600" />
          : <ChevronRight className="h-4 w-4 text-amber-600" />
        }
      </button>
      {retiredOpen && (
        <div className="divide-y divide-amber-200/50 border-t border-amber-200">
          {retiredAssets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between py-3 px-4 hover:bg-amber-100/30 transition-colors group">
              <Link href={`/properties/${propertyId}/assets/${asset.id}`} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                <div className="bg-amber-100 p-2 rounded-lg shrink-0">
                  <Archive className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate text-amber-900">{asset.name}</p>
                  <p className="text-xs text-amber-600 truncate">
                    {[asset.brand, asset.model].filter(Boolean).join(" · ") || t(`assets.category.${asset.category}`, { defaultValue: asset.category })}
                    {asset.retiredAt && ` · ${t("propertyDetail.retiredOn", { date: format(new Date(asset.retiredAt), "MMM yyyy") })}`}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => onEdit(asset)}
                className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-amber-200/50 text-amber-600 hover:text-amber-800"
                title={t("propertyDetail.editRestore")}
                aria-label={t("propertyDetail.editRestoreNamed", { name: asset.name })}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
