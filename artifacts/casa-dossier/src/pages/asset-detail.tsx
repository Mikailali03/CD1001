import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useGetAsset,
  getGetAssetQueryKey,
  useListServiceRecords,
  getListServiceRecordsQueryKey,
  useListMaintenanceTasks,
  getListMaintenanceTasksQueryKey,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Archive, QrCode, Wrench } from "lucide-react";
import { format } from "@/lib/date";
import { calcScore, categoryConfig, gradeFromScore } from "@/lib/asset-scoring";
import { EditAssetSheet } from "@/components/edit-asset-sheet";
import { AssetHeroCard } from "@/components/asset-detail/asset-hero-card";
import { MaintenanceScheduleCard } from "@/components/asset-detail/maintenance-schedule-card";
import { ServiceHistoryCard } from "@/components/asset-detail/service-history-card";

export default function AssetDetail() {
  const { propertyId: routePropertyId, assetId } = useParams<{ propertyId: string; assetId: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const [editOpen, setEditOpen] = useState(false);

  const { data: asset, isLoading: assetLoading } = useGetAsset(assetId!, {
    query: { enabled: !!assetId, queryKey: getGetAssetQueryKey(assetId!) },
  });

  const { data: records = [], isLoading: recordsLoading } = useListServiceRecords(assetId!, {
    query: { enabled: !!assetId, queryKey: getListServiceRecordsQueryKey(assetId!) },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useListMaintenanceTasks(assetId!, {
    query: { enabled: !!assetId, queryKey: getListMaintenanceTasksQueryKey(assetId!) },
  });

  const dismissTask = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  }, []);

  if (assetLoading || recordsLoading || tasksLoading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-5 w-24" />
        <div className="flex gap-6">
          <Skeleton className="h-[120px] w-[360px] rounded-xl" />
          <Skeleton className="h-[120px] flex-1 rounded-xl" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[340px] rounded-xl" />
          <Skeleton className="h-[340px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!asset) return <div className="p-6 text-center text-muted-foreground">{t("assetDetail.notFound")}</div>;

  const propertyId = asset.propertyId ?? routePropertyId!;
  const score = calcScore(asset);
  const { color: gradeColor } = gradeFromScore(score);
  const cfg = categoryConfig(asset.category);

  const pendingTasks = tasks.filter((task) => !task.completedAt && !dismissed.has(task.id));
  const completedTasks = tasks.filter((task) => task.completedAt);
  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">

      {/* Back link + Request Service */}
      <div className="flex items-center justify-between">
        <Link href="/assets" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          {t("assets.title")}
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5" title={t("qr.printLabel")}>
            <Link href={`/properties/${asset.propertyId}/labels?asset=${asset.id}`}>
              <QrCode className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("qr.printLabel")}</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/marketplace?propertyId=${asset.propertyId}&assetId=${asset.id}`}>
              <Wrench className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("assetDetail.requestService")}</span>
              <span className="sm:hidden">{t("assetDetail.requestServiceShort")}</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Retired banner */}
      {asset.retiredAt && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Archive className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">{t("assetDetail.retired.title")}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {t("assetDetail.retired.body", { date: format(new Date(asset.retiredAt), "MMMM d, yyyy") })}
            </p>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 border border-amber-300 hover:border-amber-400 rounded-lg px-2.5 py-1 transition-colors"
          >
            {t("assetDetail.retired.restore")}
          </button>
        </div>
      )}

      {/* ── Hero card ── */}
      <AssetHeroCard asset={asset} score={score} onEdit={() => setEditOpen(true)} />

      {/* Asset Photo */}
      {asset.photoUrl && (
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: cfg.color + "30" }}>
          <img
            src={asset.photoUrl}
            alt={asset.name}
            className="w-full max-h-72 object-cover"
          />
        </div>
      )}

      {/* Notes */}
      {asset.notes && (
        <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground mr-1.5">{t("assetDetail.notesLabel")}</span>{asset.notes}
        </div>
      )}

      {/* ── Bottom grid ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MaintenanceScheduleCard
          pendingTasks={pendingTasks}
          completedTasks={completedTasks}
          assetId={assetId!}
          propertyId={propertyId}
          onDismissTask={dismissTask}
        />
        <ServiceHistoryCard
          records={sortedRecords}
          gradeColor={gradeColor}
          assetId={assetId!}
          propertyId={propertyId}
          onRecordAdded={() =>
            queryClient.invalidateQueries({ queryKey: getListServiceRecordsQueryKey(assetId!) })
          }
        />
      </div>

      <EditAssetSheet
        asset={asset}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => queryClient.invalidateQueries({ queryKey: getGetAssetQueryKey(assetId!) })}
      />
    </div>
  );
}
