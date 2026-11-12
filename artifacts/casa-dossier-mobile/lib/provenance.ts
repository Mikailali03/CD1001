import type { TFunction } from "i18next";
import { formatDate } from "@/lib/dates";

// CasaService-verified records vs self-reported ones, labelled with the date they
// were entered so late entries are visible to whoever reads the history.
export function provenanceLabel(
  record: { verified?: boolean | null; createdAt: string },
  t: TFunction,
): string {
  return record.verified
    ? t("provenance.verified")
    : t("provenance.selfReported", { date: formatDate(record.createdAt, "MMM d, yyyy") });
}
