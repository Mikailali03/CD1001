import { Router } from "express";
import { db } from "@workspace/db";
import { reportSendsTable, userProfilesTable } from "@workspace/db";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { EmailPropertyReportBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getAccessibleProperty, getVerifiedEmail } from "../lib/access.js";
import { buildPropertyReport, renderReportPdf } from "../lib/report.js";
import { button, escapeHtml, layout, sendEmail } from "../lib/email.js";
import { getAppUrl } from "../lib/appUrl.js";
import { z } from "zod";

const router = Router();

const ReportParams = z.object({ propertyId: z.string() });
const PdfQuery = z.object({ includeCosts: z.enum(["true", "false"]).optional() });

// Keeps the feature from being used to send mail in Casa Dossier's name at volume.
const DAILY_SEND_LIMIT = 10;

router.get("/properties/:propertyId/report", requireAuth(), async (req, res) => {
  const { propertyId } = ReportParams.parse(req.params);
  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.json(await buildPropertyReport(property));
});

function pdfFilename(address: string): string {
  return `Casa Dossier - ${address.replace(/[^\w\s.-]/g, "").trim() || "Property"}.pdf`;
}

// Personal copy for the owner's own records. Not in the OpenAPI spec (binary).
router.get("/properties/:propertyId/report/pdf", requireAuth(), async (req, res) => {
  const { propertyId } = ReportParams.parse(req.params);
  const { includeCosts } = PdfQuery.parse(req.query);
  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const pdf = renderReportPdf(await buildPropertyReport(property), {
    includeCosts: includeCosts !== "false",
    sentBy: null,
  });
  res
    .status(200)
    .setHeader("Content-Type", "application/pdf")
    .setHeader("Content-Disposition", `attachment; filename="${pdfFilename(property.address)}"`)
    .setHeader("Cache-Control", "no-store")
    .send(pdf);
});

router.post("/properties/:propertyId/report/email", requireAuth(), async (req, res) => {
  const { propertyId } = ReportParams.parse(req.params);
  const body = EmailPropertyReportBody.parse(req.body);
  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const recipients = [...new Set(body.recipients.map((r) => r.trim().toLowerCase()))];
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ sent }] = await db
    .select({ sent: count() })
    .from(reportSendsTable)
    .where(and(eq(reportSendsTable.senderUserId, req.userId), gte(reportSendsTable.createdAt, dayAgo)));
  if (sent >= DAILY_SEND_LIMIT) {
    res.status(429).json({ error: `You can email up to ${DAILY_SEND_LIMIT} reports a day. Try again tomorrow.` });
    return;
  }

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, req.userId));
  const senderEmail = await getVerifiedEmail(req.userId);
  const senderName = (profile ? `${profile.firstName} ${profile.lastName}`.trim() : "") || senderEmail || "A Casa Dossier homeowner";

  const report = await buildPropertyReport(property);
  const pdf = renderReportPdf(report, { includeCosts: body.includeCosts, sentBy: senderName });
  const all = [...report.activeAssets, ...report.retiredAssets];
  const verified = all.reduce((n, a) => n + a.records.filter((r) => r.verified).length, 0);
  const address = [property.address, property.city, property.state].filter(Boolean).join(", ");
  const message = body.message?.trim();

  const e = escapeHtml;
  const html = layout(`  <h2>${e(senderName)} shared a home report with you</h2>
  <p>The Casa Dossier report for <strong>${e(address)}</strong> is attached as a PDF.</p>
  ${message ? `<blockquote style="border-left: 3px solid #e5e7eb; margin: 16px 0; padding: 4px 12px; color: #374151;">${e(message).replace(/\n/g, "<br>")}</blockquote>` : ""}
  <p>It covers ${all.length} system${all.length === 1 ? "" : "s"} and ${report.totalEvents} service record${report.totalEvents === 1 ? "" : "s"}, ${verified} of them verified by the CasaService team. The rest were entered by the homeowner.</p>
  <p style="color: #6b7280; font-size: 13px;">This report was sent directly from Casa Dossier on behalf of ${e(senderName)}${senderEmail ? ` (${e(senderEmail)})` : ""}. Replies go to them.</p>
  <p>${button(getAppUrl(), "What is Casa Dossier?")}</p>`);
  const text = [
    `${senderName} shared the Casa Dossier report for ${address}. It's attached as a PDF.`,
    ...(message ? ["", message] : []),
    "",
    `${report.totalEvents} service records, ${verified} verified by CasaService.`,
    "",
    `Sent from Casa Dossier on behalf of ${senderName}${senderEmail ? ` (${senderEmail})` : ""}.`,
  ].join("\n");

  // Log first so the daily limit holds even if a send fails partway.
  const [logged] = await db
    .insert(reportSendsTable)
    .values({ propertyId, senderUserId: req.userId, recipients, includeCosts: body.includeCosts })
    .returning();

  const failed: string[] = [];
  for (const to of recipients) {
    try {
      await sendEmail({
        to,
        subject: `${senderName} shared the home report for ${property.address}`,
        html,
        text,
        replyTo: senderEmail ?? undefined,
        attachments: [{ filename: pdfFilename(property.address), content: pdf }],
      });
    } catch (err) {
      req.log.error({ err, to }, "Report email failed");
      failed.push(to);
    }
  }
  if (failed.length === recipients.length) {
    res.status(502).json({ error: "The report couldn't be sent. Please try again." });
    return;
  }
  res.status(201).json({ ...logged, failedRecipients: failed });
});

router.get("/properties/:propertyId/report/sends", requireAuth(), async (req, res) => {
  const { propertyId } = ReportParams.parse(req.params);
  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const sends = await db
    .select()
    .from(reportSendsTable)
    .where(eq(reportSendsTable.propertyId, propertyId))
    .orderBy(desc(reportSendsTable.createdAt))
    .limit(50);
  res.json(sends);
});

export default router;
