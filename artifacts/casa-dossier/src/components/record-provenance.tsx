import { useTranslation } from "react-i18next";
import { format } from "@/lib/date";

type RecordLike = {
  verified?: boolean | null;
  createdAt: string;
  companyName?: string | null;
  technicianName?: string | null;
};

// Who did the work, and how much to trust it: CasaService-verified records get
// the gold badge; everything else is labelled self-reported with the date it was
// entered, so late entries are visible to whoever reads the history.
export function RecordPerformer({ record, fallback, size = "sm" }: {
  record: RecordLike;
  fallback?: string;
  size?: "sm" | "xs";
}) {
  const textSize = size === "xs" ? "text-[9px]" : "text-[10px]";
  if (record.verified) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className={`inline-flex items-center bg-amber-50 border border-amber-200 font-semibold px-1.5 py-0.5 rounded ${textSize} tracking-wide`}>
          <span className="casa-shimmer-gold">✦ CasaService</span>
        </span>
        {record.technicianName && <span> — {record.technicianName}</span>}
      </span>
    );
  }
  const performer = record.companyName || record.technicianName || fallback;
  return performer ? <span>{performer}</span> : null;
}

export function RecordProvenance({ record, className = "" }: { record: RecordLike; className?: string }) {
  const { t } = useTranslation();
  if (record.verified) {
    return <span className={`text-amber-700 font-medium ${className}`}>{t("provenance.verified")}</span>;
  }
  return (
    <span className={`text-muted-foreground ${className}`}>
      {t("provenance.selfReported", { date: format(new Date(record.createdAt), "MMM d, yyyy") })}
    </span>
  );
}
