import { describe, it, expect, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, assetsTable: {}, serviceRecordsTable: {} }));

import { PdfDocument, textWidth } from "../pdf";
import { renderReportPdf, type PropertyReportData } from "../report";

function xrefIsValid(pdf: Buffer): boolean {
  const text = pdf.toString("latin1");
  const start = Number(/startxref\n(\d+)/.exec(text)![1]);
  const table = text.slice(start).split("\n");
  const count = Number(table[1]!.split(" ")[1]);
  for (let i = 1; i < count; i++) {
    const offset = Number(table[2 + i]!.slice(0, 10));
    if (!text.startsWith(`${i} 0 obj`, offset)) return false;
  }
  return text.startsWith("xref", start);
}

describe("PdfDocument", () => {
  it("writes a structurally valid PDF with correct cross-reference offsets", () => {
    const doc = new PdfDocument("Test");
    doc.text("Hello (world) \\ café — “quotes”", { size: 14, bold: true });
    for (let i = 0; i < 120; i++) doc.text(`Line ${i} with enough words to wrap around the page width at least once in a while`);
    const pdf = doc.toBuffer((p, n) => `Page ${p} of ${n}`);
    expect(pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(pdf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    expect(xrefIsValid(pdf)).toBe(true);
    expect(pdf.toString("latin1")).toContain("/Count 3");
  });

  it("measures text with the Helvetica metrics", () => {
    expect(textWidth("MM", 10)).toBeCloseTo(16.66, 1);
    expect(textWidth("MM", 10, true)).toBeCloseTo(16.66, 1);
    expect(textWidth("ii", 10)).toBeCloseTo(4.44, 1);
  });
});

describe("renderReportPdf", () => {
  const report = {
    property: { id: "p1", name: "Home", address: "12 Oak St", city: "Atlanta", state: "GA", zipCode: "30301", yearBuilt: 1998, sqft: 2100, bedrooms: 3, bathrooms: "2.0" },
    activeAssets: [{
      id: "a1", name: "Water Heater", category: "Plumbing", brand: "Rheem", model: "XE50", serialNumber: "S123", installDate: "2019-04-01", retiredAt: null, retiredReason: null,
      records: [
        { id: "r1", date: "2024-03-01", description: "Flushed tank", verified: true, technicianName: "Sam T Technician", companyName: "CasaService", cost: "150.00", createdAt: new Date("2024-03-01") },
        { id: "r2", date: "2021-06-10", description: "Replaced anode rod", verified: false, technicianName: "Homeowner (DIY)", companyName: null, cost: "40.00", createdAt: new Date("2024-11-01") },
      ],
    }],
    retiredAssets: [],
    totalEvents: 2,
    generatedAt: "2026-11-11T12:00:00.000Z",
  } as unknown as PropertyReportData;

  it("labels verified and self-reported records and can leave out costs", () => {
    const withCosts = renderReportPdf(report, { includeCosts: true, sentBy: "Jane Doe" }).toString("latin1");
    expect(withCosts).toContain("Verified by CasaService");
    expect(withCosts).toContain("Self-reported");
    expect(withCosts).toContain("$150");
    expect(withCosts).toContain("Sent by Jane Doe");

    const noCosts = renderReportPdf(report, { includeCosts: false, sentBy: null }).toString("latin1");
    expect(noCosts).not.toContain("$150");
    expect(noCosts).toContain("Personal copy");
    expect(xrefIsValid(Buffer.from(noCosts, "latin1"))).toBe(true);
  });
});
