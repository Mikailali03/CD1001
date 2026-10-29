import { Link, useParams, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListPropertyQrLabels, getListPropertyQrLabelsQueryKey } from "@workspace/api-client-react";
import { QrLabel } from "@/components/qr-label";

// Avery 5160 / 8160: US Letter, 3 × 10 labels of 2.625" × 1".
const LABELS_PER_SHEET = 30;

const PRINT_CSS = `
.qr-sheet {
  width: 8.5in;
  min-height: 11in;
  padding: 0.5in 0.1875in;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(3, 2.625in);
  grid-auto-rows: 1in;
  column-gap: 0.125in;
  align-content: start;
  background: white;
}
.qr-label {
  width: 2.625in;
  height: 1in;
  box-sizing: border-box;
  outline: 1px dashed #d4d4d8;
  outline-offset: -1px;
}
@page { size: letter; margin: 0; }
@media print {
  html, body { background: white !important; }
  .qr-sheet { box-shadow: none !important; margin: 0 !important; break-after: page; page-break-after: always; }
  .qr-sheet:last-child { break-after: auto; page-break-after: auto; }
  .qr-label { outline: none; }
  .qr-label, .qr-label * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export default function AssetLabels() {
  const { id: propertyId } = useParams<{ id: string }>();
  const search = useSearch();
  const assetId = new URLSearchParams(search).get("asset");
  const { t } = useTranslation();

  const params = assetId ? { assetId } : undefined;
  const { data, isLoading, isError } = useListPropertyQrLabels(propertyId!, params, {
    query: { queryKey: getListPropertyQrLabelsQueryKey(propertyId!, params), enabled: !!propertyId },
  });

  const backHref = assetId ? `/properties/${propertyId}/assets/${assetId}` : `/properties/${propertyId}`;
  const labels = data?.labels ?? [];

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      <style>{PRINT_CSS}</style>

      {/* Toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0">
              <ArrowLeft className="h-4 w-4" />
              {t("qr.labels.back")}
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {assetId ? t("qr.labels.titleOne") : t("qr.labels.titleAll")}
                {data?.propertyName ? ` — ${data.propertyName}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">{t("qr.labels.sheetHint")}</p>
            </div>
          </div>
          <Button className="gap-2" onClick={() => window.print()} disabled={labels.length === 0}>
            <Printer className="h-4 w-4" />
            {t("qr.labels.print")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground print:hidden">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : isError ? (
        <div className="max-w-md mx-auto py-24 text-center text-sm text-muted-foreground print:hidden">
          {t("qr.labels.error")}
        </div>
      ) : labels.length === 0 ? (
        <div className="max-w-md mx-auto py-24 flex flex-col items-center text-center gap-3 print:hidden">
          <QrCode className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t("qr.labels.empty")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto py-6 print:p-0 print:overflow-visible">
          <p className="print:hidden text-center text-xs text-muted-foreground mb-4">
            {t("qr.labels.count", { count: labels.length })}
          </p>
          {chunk(labels, LABELS_PER_SHEET).map((sheet, i) => (
            <div key={i} className="qr-sheet mx-auto mb-6 shadow-md">
              {sheet.map((label) => (
                <QrLabel key={label.assetId} label={label} scanHint={t("qr.labels.scanHint")} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
