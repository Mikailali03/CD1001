// Property report data, shared by the on-screen report and the PDF that's
// emailed or downloaded.
import { db } from "@workspace/db";
import { assetsTable, serviceRecordsTable, type Property } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { PdfDocument, measure, type Font, type Rgb } from "./pdf.js";

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

// ── PDF layout ───────────────────────────────────────────────────────────────
// Header with the address and a record-count badge, a stat strip, then one card
// per system with a Date / Service item / Performer (/ Cost) table. Every record
// says whether it was verified by CasaService or self-reported (and when it was
// added); the report makes no broader "verified" or "audited" claims.

const INK: Rgb = [0.07, 0.09, 0.15];
const GREY: Rgb = [0.42, 0.45, 0.5];
const MUTED: Rgb = [0.58, 0.61, 0.66];
const BORDER: Rgb = [0.85, 0.87, 0.9];
const HEADER_BG: Rgb = [0.969, 0.973, 0.98];
const ROW_ALT: Rgb = [0.98, 0.983, 0.988];
const GOLD: Rgb = [0.72, 0.53, 0.04];
const RED: Rgb = [0.65, 0.12, 0.12];
const WHITE: Rgb = [1, 1, 1];

const RETIRE_REASONS: Record<string, string> = { replaced: "Replaced", removed: "Removed", failed: "Failed", other: "Other" };

function parseDate(value: string | Date): Date {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
}

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = parseDate(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Dec 2024" — install dates are often stored as full timestamps. */
function fmtMonthYear(value: string | null | undefined): string {
  if (!value) return "";
  const d = parseDate(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
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
  const selfReported = report.totalEvents - verified;
  const generated = fmtDate(report.generatedAt);
  const X = doc.margin;
  const W = doc.contentWidth;

  // ── Header ─────────────────────────────────────────────────────────────────
  const badgeW = 132;
  const badgeH = 74;
  const top = doc.top;
  doc.drawText(X, top - 8, "PROPERTY DOSSIER", { size: 8, font: "mono", color: GREY, charSpacing: 2.4 });
  let y = top - 22;
  for (const line of doc.wrap(property.address, 26, "bold", W - badgeW - 24)) {
    y -= 26;
    doc.drawText(X, y, line, { size: 26, font: "bold", color: INK });
    y -= 6;
  }
  const place = [property.city, property.state, property.zipCode].filter(Boolean).join(", ");
  if (place) {
    y -= 14;
    doc.drawText(X, y, place, { size: 13, color: GREY });
  }
  y -= 16;
  doc.drawText(
    X,
    y,
    sentBy ? `Sent by ${sentBy} via Casa Dossier on ${generated}` : `Personal copy generated ${generated} · for official sharing, email it from Casa Dossier`,
    { size: 8.5, color: MUTED },
  );

  // Record-count badge (top right), with an offset shadow.
  const bx = X + W - badgeW;
  const by = top - badgeH - 2;
  doc.rect(bx + 3, by - 3, badgeW, badgeH, { fill: INK, radius: 3 });
  doc.rect(bx, by, badgeW, badgeH, { fill: WHITE, stroke: INK, lineWidth: 2, radius: 3 });
  const centred = (text: string, size: number, font: Font, color: Rgb, baseline: number, charSpacing = 0) =>
    doc.drawText(bx + (badgeW - measure(text, size, font, charSpacing)) / 2, baseline, text, { size, font, color, charSpacing });
  centred("SERVICE RECORDS", 6.5, "mono", GREY, by + badgeH - 15, 1.2);
  centred(`${verified} Verified`, 14, "bold", INK, by + badgeH - 35);
  centred(`${selfReported} Self-reported`, 9.5, "regular", GREY, by + badgeH - 50);
  centred("Casa Dossier", 7, "mono", MUTED, by + 9);

  y = Math.min(y, by - 3) - 16;
  doc.line(X, y, X + W, y, INK, 2);
  y -= 18;

  // ── Stat strip ─────────────────────────────────────────────────────────────
  const stats: [string, string][] = [
    ["BUILT", property.yearBuilt ? String(property.yearBuilt) : "—"],
    ["STRUCTURE", property.sqft ? `${Number(property.sqft).toLocaleString("en-US")} sqft` : "—"],
    [
      "CONFIGURATION",
      property.bedrooms || property.bathrooms
        ? [property.bedrooms && `${property.bedrooms} BD`, property.bathrooms && `${Number(property.bathrooms).toFixed(1)} BA`].filter(Boolean).join(" / ")
        : "—",
    ],
    ["SERVICE RECORDS", `${report.totalEvents} on file`],
  ];
  const stripH = 48;
  const cellW = W / stats.length;
  doc.rect(X, y - stripH, W, stripH, { fill: HEADER_BG, stroke: BORDER, radius: 4 });
  stats.forEach(([label, value], i) => {
    const cx = X + i * cellW;
    if (i > 0) doc.line(cx, y - stripH, cx, y, BORDER);
    doc.drawText(cx + 14, y - 17, label, { size: 6.5, font: "bold", color: GREY, charSpacing: 1.2 });
    doc.drawText(cx + 14, y - 36, value, { size: 13, font: "bold", color: INK });
  });
  doc.cursor = y - stripH - 26;

  // ── Section heading: rule — TITLE — rule ───────────────────────────────────
  const sectionHeading = (title: string, note?: string) => {
    doc.ensureSpace(note ? 150 : 130);
    const yy = doc.cursor - 10;
    const tw = measure(title, 10, "bold", 3);
    const tx = X + (W - tw) / 2;
    doc.line(X, yy + 3.5, tx - 16, yy + 3.5, INK, 0.9);
    doc.line(tx + tw + 16, yy + 3.5, X + W, yy + 3.5, INK, 0.9);
    doc.drawText(tx, yy, title, { size: 10, font: "bold", color: INK, charSpacing: 3 });
    doc.cursor = yy - 14;
    if (note) {
      const nw = measure(note, 8.5, "italic");
      doc.drawText(X + (W - nw) / 2, doc.cursor - 6, note, { size: 8.5, font: "italic", color: GREY });
      doc.cursor -= 20;
    }
  };

  // ── Asset cards ────────────────────────────────────────────────────────────
  const PAD = 14;
  const RADIUS = 5;
  const dateW = 82;
  const costW = includeCosts ? 62 : 0;
  const perfW = 150;
  const itemW = W - dateW - perfW - costW;
  const colItem = X + dateW;
  const colPerf = colItem + itemW;
  const colCostRight = X + W - PAD;
  const TABLE_HEAD_H = 22;

  type Row = { height: number; draw: (rowTop: number) => void };

  const recordRow = (r: ReportAsset["records"][number]): Row => {
    const itemLines = doc.wrap(r.description, 9.5, "regular", itemW - 12);
    let perf: { text: string; size: number; font: Font; color: Rgb; star?: boolean }[];
    if (r.verified) {
      perf = [{ text: "Verified by CasaService", size: 8.5, font: "bold", color: GOLD, star: true }];
      if (r.technicianName) perf.push({ text: r.technicianName, size: 8, font: "regular", color: GREY });
    } else {
      perf = [
        { text: r.companyName || r.technicianName || "Homeowner", size: 9, font: "regular", color: INK },
        { text: `Self-reported · added ${fmtDate(r.createdAt)}`, size: 7.5, font: "regular", color: MUTED },
      ];
    }
    // Long performer names wrap within the column.
    const perfLines = perf.flatMap((p) =>
      doc.wrap(p.text, p.size, p.font, perfW - PAD - (p.star ? 10 : 0)).map((text, i) => ({ ...p, text, star: p.star && i === 0 })),
    );
    const contentH = Math.max(itemLines.length * 12.5, perfLines.length * 11.5, 12);
    const height = contentH + 18;
    return {
      height,
      draw: (rowTop) => {
        const base = rowTop - 9 - 9;
        doc.drawText(X + PAD, base, fmtDate(r.date), { size: 8, font: "mono", color: GREY });
        itemLines.forEach((line, i) => doc.drawText(colItem, base - i * 12.5, line, { size: 9.5, color: INK }));
        perfLines.forEach((p, i) => {
          const py = base - i * 11.5;
          let px = colPerf;
          if (p.star) {
            const cx = px + 3.5;
            const cy = py + 3;
            doc.polygon([[cx, cy + 4], [cx + 1.2, cy + 1.2], [cx + 4, cy], [cx + 1.2, cy - 1.2], [cx, cy - 4], [cx - 1.2, cy - 1.2], [cx - 4, cy], [cx - 1.2, cy + 1.2]], GOLD);
            px += 10;
          }
          doc.drawText(px, py, p.text, { size: p.size, font: p.font, color: p.color });
        });
        if (includeCosts) {
          const cost = money(r.cost);
          if (cost) doc.drawText(colCostRight - measure(cost, 9, "mono"), base, cost, { size: 9, font: "mono", color: INK });
        }
      },
    };
  };

  const emptyRow: Row = {
    height: 30,
    draw: (rowTop) => doc.drawText(X + PAD, rowTop - 19, "No service events recorded.", { size: 9.5, font: "italic", color: MUTED }),
  };

  const tableHead = (yTop: number) => {
    const base = yTop - 14;
    const label = (x: number, text: string) => doc.drawText(x, base, text, { size: 6.5, font: "bold", color: MUTED, charSpacing: 1.2 });
    label(X + PAD, "DATE");
    label(colItem, "SERVICE ITEM");
    label(colPerf, "PERFORMER");
    if (includeCosts) doc.drawText(colCostRight - measure("COST", 6.5, "bold", 1.2), base, "COST", { size: 6.5, font: "bold", color: MUTED, charSpacing: 1.2 });
    doc.line(X, yTop - TABLE_HEAD_H, X + W, yTop - TABLE_HEAD_H, BORDER);
  };

  const renderAsset = (asset: ReportAsset, retired: boolean) => {
    // Pill: install date and serial number, monospace on dark.
    const pillText = [asset.installDate && `INSTALLED: ${fmtMonthYear(asset.installDate)}`, asset.serialNumber && `S/N: ${asset.serialNumber}`]
      .filter(Boolean)
      .join("  |  ");
    const pillW = pillText ? measure(pillText, 7.5, "mono") + 16 : 0;
    const pillH = 18;
    // Put the pill on its own line when it would crowd the name.
    const pillStacked = pillW > W * 0.5;
    const titleW = W - PAD * 2 - (pillText && !pillStacked ? pillW + 16 : 0);

    const nameLines = doc.wrap(asset.name, 13, "bold", titleW);
    const sub = [asset.brand, asset.model].filter(Boolean).join(" · ");
    const retiredLabel = retired && asset.retiredAt
      ? `RETIRED ${fmtDate(asset.retiredAt).toUpperCase()}${asset.retiredReason ? ` · ${(RETIRE_REASONS[asset.retiredReason] ?? asset.retiredReason).toUpperCase()}` : ""}`
      : "";

    let headerH = PAD + 9 + 6 + nameLines.length * 16 + (sub ? 15 : 0) + (retiredLabel ? 14 : 0) + PAD - 2;
    if (pillText && pillStacked) headerH += pillH + 8;

    const rows = asset.records.length ? asset.records.map(recordRow) : [emptyRow];
    doc.ensureSpace(headerH + TABLE_HEAD_H + rows[0]!.height + 24);

    let segTop = doc.cursor;
    const closeSegment = (bottomY: number) =>
      doc.rect(X, bottomY, W, segTop - bottomY, { stroke: BORDER, lineWidth: 1, radius: RADIUS });

    // Header background: rounded on top, square where it meets the table.
    doc.rect(X, segTop - headerH, W, headerH, { fill: HEADER_BG, radius: RADIUS });
    doc.rect(X, segTop - headerH, W, headerH - RADIUS, { fill: HEADER_BG });
    let hy = segTop - PAD - 7;
    doc.drawText(X + PAD, hy, asset.category.toUpperCase(), { size: 7.5, font: "bold", color: GREY, charSpacing: 1.5 });
    hy -= 6;
    for (const line of nameLines) {
      hy -= 15;
      doc.drawText(X + PAD, hy, line, { size: 13, font: "bold", color: INK });
      hy -= 1;
    }
    if (sub) {
      hy -= 14;
      doc.drawText(X + PAD, hy, sub, { size: 10, color: GREY });
    }
    if (retiredLabel) {
      hy -= 14;
      doc.drawText(X + PAD, hy, retiredLabel, { size: 7.5, font: "bold", color: RED, charSpacing: 1 });
    }
    if (pillText) {
      const px = pillStacked ? X + PAD : X + W - PAD - pillW;
      const py = pillStacked ? hy - 8 - pillH : segTop - PAD - pillH + 2;
      doc.rect(px, py, pillW, pillH, { fill: INK, radius: 4 });
      doc.drawText(px + 8, py + 6, pillText, { size: 7.5, font: "mono", color: WHITE });
    }
    doc.line(X, segTop - headerH, X + W, segTop - headerH, BORDER);

    let rowTop = segTop - headerH;
    if (asset.records.length) {
      tableHead(rowTop);
      rowTop -= TABLE_HEAD_H;
    }

    rows.forEach((row, i) => {
      if (rowTop - row.height < doc.bottom) {
        // Continue the card on the next page with a short header.
        closeSegment(rowTop);
        doc.addPage();
        segTop = doc.cursor;
        const contH = 26;
        doc.rect(X, segTop - contH, W, contH, { fill: HEADER_BG, radius: RADIUS });
        doc.rect(X, segTop - contH, W, contH - RADIUS, { fill: HEADER_BG });
        doc.drawText(X + PAD, segTop - 17, `${asset.name} (continued)`, { size: 9.5, font: "bold", color: INK });
        doc.line(X, segTop - contH, X + W, segTop - contH, BORDER);
        rowTop = segTop - contH;
        tableHead(rowTop);
        rowTop -= TABLE_HEAD_H;
      }
      if (i % 2 === 1) doc.rect(X + 0.5, rowTop - row.height, W - 1, row.height, { fill: ROW_ALT });
      row.draw(rowTop);
      rowTop -= row.height;
      if (i < rows.length - 1) doc.line(X, rowTop, X + W, rowTop, [0.92, 0.93, 0.95], 0.5);
    });
    closeSegment(rowTop);
    doc.cursor = rowTop - 18;
  };

  if (report.activeAssets.length) {
    sectionHeading("CURRENT OPERATIONAL INVENTORY");
    report.activeAssets.forEach((a) => renderAsset(a, false));
  }
  if (report.retiredAssets.length) {
    doc.moveDown(10);
    sectionHeading("RETIRED SYSTEMS", "Kept so the property's full service history stays on record.");
    report.retiredAssets.forEach((a) => renderAsset(a, true));
  }
  if (all.length === 0) {
    sectionHeading("CURRENT OPERATIONAL INVENTORY");
    doc.text("No systems recorded yet.", { size: 10, color: GREY });
  }

  doc.moveDown(10);
  doc.rule(BORDER);
  doc.text(
    'Records marked "Verified by CasaService" were completed by the Casa Dossier service team. All other records are self-reported by the homeowner and have not been independently verified; the date each was added is shown.',
    { size: 8, color: GREY },
  );

  return doc.toBuffer((page, total) => `${property.address}  ·  Casa Dossier  ·  Page ${page} of ${total}`);
}
