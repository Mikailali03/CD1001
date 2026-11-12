// Property report data, shared by the on-screen report and the PDF that's
// emailed or downloaded.
import { db } from "@workspace/db";
import { assetsTable, serviceRecordsTable, type Property } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { PdfDocument } from "./pdf.js";

export async function buildPropertyReport(property: Property) {
  const allAssets = await db
    .select()
    .from(assetsTable)
    .where(eq(assetsTable.propertyId, property.id))
    .orderBy(assetsTable.createdAt);
  const assetIds = allAssets.map((a) => a.id);
  const allRecords = assetIds.length
    ? await db
        .select()
        .from(serviceRecordsTable)
        .where(inArray(serviceRecordsTable.assetId, assetIds))
        .orderBy(serviceRecordsTable.date)
    : [];

  const recordsByAsset = new Map<string, typeof allRecords>();
  for (const record of allRecords) {
    const list = recordsByAsset.get(record.assetId) ?? [];
    list.push(record);
    recordsByAsset.set(record.assetId, list);
  }
  const withRecords = (a: (typeof allAssets)[number]) => ({ ...a, records: recordsByAsset.get(a.id) ?? [] });

  return {
    property,
    activeAssets: allAssets.filter((a) => !a.retiredAt).map(withRecords),
    retiredAssets: allAssets.filter((a) => !!a.retiredAt).map(withRecords),
    totalEvents: allRecords.length,
    generatedAt: new Date().toISOString(),
  };
}

export type PropertyReportData = Awaited<ReturnType<typeof buildPropertyReport>>;
type ReportAsset = PropertyReportData["activeAssets"][number];

const GREY: [number, number, number] = [0.42, 0.45, 0.5];
const GOLD: [number, number, number] = [0.57, 0.25, 0.05];
const RED: [number, number, number] = [0.6, 0.1, 0.1];

const RETIRE_REASONS: Record<string, string> = { replaced: "Replaced", removed: "Removed", failed: "Failed", other: "Other" };

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function money(value: string | number | null | undefined): string {
  const n = value != null ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "";
}

export type PdfOptions = {
  includeCosts: boolean;
  /** "Sent by <name> via Casa Dossier on <date>", or null for a personal download. */
  sentBy: string | null;
};

export function renderReportPdf(report: PropertyReportData, { includeCosts, sentBy }: PdfOptions): Buffer {
  const { property } = report;
  const doc = new PdfDocument(`Property Dossier — ${property.address}`);
  const all = [...report.activeAssets, ...report.retiredAssets];
  const verified = all.reduce((n, a) => n + a.records.filter((r) => r.verified).length, 0);
  const generated = fmtDate(report.generatedAt);

  // Header
  doc.text("PROPERTY DOSSIER", { size: 8, bold: true, color: GREY });
  doc.moveDown(2);
  doc.text(property.address, { size: 20, bold: true });
  const place = [property.city, property.state, property.zipCode].filter(Boolean).join(", ");
  if (place) doc.text(place, { size: 11, color: GREY });
  doc.moveDown(6);

  const specs = [
    property.yearBuilt && `Built ${property.yearBuilt}`,
    property.sqft && `${Number(property.sqft).toLocaleString("en-US")} sqft`,
    property.bedrooms && `${property.bedrooms} bd`,
    property.bathrooms && `${Number(property.bathrooms)} ba`,
  ].filter(Boolean).join("  ·  ");
  if (specs) doc.text(specs, { size: 10 });
  doc.text(
    `${report.totalEvents} service record${report.totalEvents === 1 ? "" : "s"}: ${verified} verified by CasaService, ${report.totalEvents - verified} self-reported`,
    { size: 10, bold: true },
  );
  doc.moveDown(2);
  doc.text(
    sentBy ? `Sent by ${sentBy} via Casa Dossier on ${generated}.` : `Personal copy generated ${generated}. For official sharing, email the report from Casa Dossier.`,
    { size: 9, color: GREY },
  );
  doc.rule([0.1, 0.1, 0.1], 1.5);

  const renderAsset = (asset: ReportAsset, retired: boolean) => {
    doc.ensureSpace(60);
    doc.moveDown(6);
    doc.text(asset.name, { size: 12, bold: true });
    const meta = [
      asset.category,
      [asset.brand, asset.model].filter(Boolean).join(" "),
      asset.installDate && `Installed ${fmtDate(asset.installDate)}`,
      asset.serialNumber && `Serial ${asset.serialNumber}`,
    ].filter(Boolean).join("  ·  ");
    if (meta) doc.text(meta, { size: 9, color: GREY });
    if (retired && asset.retiredAt) {
      const reason = asset.retiredReason ? ` · ${RETIRE_REASONS[asset.retiredReason] ?? asset.retiredReason}` : "";
      doc.text(`Retired ${fmtDate(asset.retiredAt)}${reason}`, { size: 9, bold: true, color: RED });
    }
    doc.moveDown(3);

    if (asset.records.length === 0) {
      doc.text("No service records", { size: 9, color: GREY, indent: 12 });
      return;
    }
    for (const r of asset.records) {
      doc.ensureSpace(42);
      const cost = includeCosts ? money(r.cost) : "";
      doc.text(`${fmtDate(r.date)}  —  ${r.description}${cost ? `  (${cost})` : ""}`, { size: 10, indent: 12 });
      if (r.verified) {
        doc.text(`Verified by CasaService${r.technicianName ? ` — ${r.technicianName}` : ""}`, { size: 8.5, bold: true, color: GOLD, indent: 24 });
      } else {
        const performer = r.companyName || r.technicianName;
        doc.text(`${performer ? `${performer} · ` : ""}Self-reported · added ${fmtDate(r.createdAt)}`, { size: 8.5, color: GREY, indent: 24 });
      }
      doc.moveDown(2);
    }
  };

  if (report.activeAssets.length) {
    doc.moveDown(8);
    doc.text("CURRENT SYSTEMS", { size: 9, bold: true, color: GREY });
    report.activeAssets.forEach((a) => renderAsset(a, false));
  }
  if (report.retiredAssets.length) {
    doc.moveDown(10);
    doc.text("RETIRED SYSTEMS", { size: 9, bold: true, color: GREY });
    doc.text("Kept so the property's full service history stays on record.", { size: 8.5, color: GREY });
    report.retiredAssets.forEach((a) => renderAsset(a, true));
  }
  if (all.length === 0) {
    doc.moveDown(8);
    doc.text("No systems recorded yet.", { size: 10, color: GREY });
  }

  doc.moveDown(14);
  doc.rule();
  doc.text(
    'Records marked "Verified by CasaService" were completed by the Casa Dossier service team. All other records are self-reported by the homeowner and have not been independently verified; the date each was added is shown.',
    { size: 8, color: GREY },
  );

  return doc.toBuffer((page, total) => `${property.address}  ·  Casa Dossier  ·  Page ${page} of ${total}`);
}
