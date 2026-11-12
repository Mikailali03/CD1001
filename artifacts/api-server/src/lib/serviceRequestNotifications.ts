import { db, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendEmail, escapeHtml, layout, button } from "./email.js";
import { sendPushToUser } from "./pushNotifications.js";
import { getAppUrl } from "./appUrl.js";

export interface NewServiceRequest {
  jobId: string;
  assetName: string;
  assetCategory: string;
  description: string;
  urgency: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  /** False when the home's location couldn't be checked against the service area. */
  locationVerified: boolean;
}

/**
 * Tell the Casa Dossier team a homeowner asked for service: an email to
 * ADMIN_EMAIL, and a push to every admin with the mobile app installed.
 */
export async function notifyAdminsOfServiceRequest(request: NewServiceRequest): Promise<void> {
  const where = [request.city, request.state, request.zipCode].filter(Boolean).join(", ") || "Unknown location";
  const urgent = request.urgency === "emergency" || request.urgency === "high";
  const subject = `${urgent ? `[${request.urgency.toUpperCase()}] ` : ""}New service request: ${request.assetName} in ${where}`;

  const tasks: Promise<unknown>[] = [];

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const html = layout(`
  <h2 style="margin-top: 0;">New service request</h2>
  <p><strong>${escapeHtml(request.assetName)}</strong> (${escapeHtml(request.assetCategory)}) · ${escapeHtml(where)}</p>
  <p>Urgency: <strong>${escapeHtml(request.urgency)}</strong></p>
  <blockquote style="border-left: 3px solid #e5e7eb; margin: 16px 0; padding: 4px 12px; color: #374151;">${escapeHtml(request.description)}</blockquote>
  ${request.locationVerified ? "" : `<p style="color: #b45309;">We couldn't confirm this home's location, so it wasn't checked against the service area. Confirm the address before assigning a technician.</p>`}
  <p>${button(`${getAppUrl()}/tech/`, "Open the technician portal")}</p>`);
    tasks.push(sendEmail({ to: adminEmail, subject, html }));
  }

  const admins = await db
    .select({ userId: userProfilesTable.userId })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.role, "admin"));
  for (const admin of admins) {
    tasks.push(
      sendPushToUser(admin.userId, {
        title: urgent ? `New ${request.urgency} service request` : "New service request",
        body: `${request.assetName} · ${where}`,
      }),
    );
  }

  const results = await Promise.allSettled(tasks);
  const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed) throw failed.reason;
}
