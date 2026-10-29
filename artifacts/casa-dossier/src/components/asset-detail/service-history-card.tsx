import { useTranslation } from "react-i18next";
import type { ServiceRecord } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { format } from "@/lib/date";
import { ReceiptLink, ReceiptThumbnail } from "@/components/receipt-upload";
import { AddServiceRecordForm } from "./add-service-record-form";

// ── Service History ───────────────────────────────────────────────────────────
export function ServiceHistoryCard({ records, gradeColor, assetId, propertyId, onRecordAdded }: {
  records: ServiceRecord[];
  gradeColor: string;
  assetId: string;
  propertyId: string;
  onRecordAdded: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {t("assetDetail.history.title")}
          </CardTitle>
          {records.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {t("assetDetail.history.recordCount", { count: records.length })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {records.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <FileText className="h-7 w-7 opacity-20" />
            <p className="text-sm font-medium">{t("assetDetail.history.empty")}</p>
            <p className="text-xs text-center max-w-[200px]">{t("assetDetail.history.emptyHint")}</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-border ml-2 space-y-5 py-1">
            {records.map((record) => (
              <div key={record.id} className="relative pl-5">
                <div
                  className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-background border-2 flex items-center justify-center"
                  style={{ borderColor: gradeColor }}
                >
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: gradeColor }} />
                </div>
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className="font-semibold text-sm leading-tight">{record.description}</p>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                    {format(new Date(record.date), "MMM d, yyyy")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {(record.companyName || record.technicianName) && (
                    <p className="flex items-center gap-1.5">
                      {record.companyName === "CasaService" && (
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-flex items-center bg-amber-50 border border-amber-200 font-semibold px-1.5 py-0.5 rounded text-[10px] tracking-wide">
                            <span className="casa-shimmer-gold">✦ CasaService</span>
                          </span>
                          {record.technicianName && (
                            <span className="text-xs"> — {record.technicianName}</span>
                          )}
                        </span>
                      )}
                      {record.companyName !== "CasaService" && record.companyName && (
                        <span>{record.companyName}</span>
                      )}
                      {record.companyName !== "CasaService" && record.technicianName && (
                        <span className="text-muted-foreground">({record.technicianName})</span>
                      )}
                    </p>
                  )}
                  {!!record.cost && Number(record.cost) > 0 && (
                    <p className="font-semibold text-foreground">${Number(record.cost).toLocaleString()}</p>
                  )}
                  {record.receiptUrl && (
                    <div className="mt-1.5">
                      <ReceiptLink url={record.receiptUrl} className="inline-block rounded-md">
                        <ReceiptThumbnail url={record.receiptUrl} />
                      </ReceiptLink>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline add form */}
        <AddServiceRecordForm
          assetId={assetId}
          propertyId={propertyId}
          gradeColor={gradeColor}
          onSuccess={onRecordAdded}
        />
      </CardContent>
    </Card>
  );
}
