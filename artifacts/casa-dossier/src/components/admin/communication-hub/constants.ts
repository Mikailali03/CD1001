// Shared labels and starter content for the admin Communication Hub.
// Trigger events mirror TRIGGER_EVENTS in lib/db/src/schema/email_triggers.ts.

export const CATEGORY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  notification: "Notification",
  transactional: "Transactional",
};

export const CATEGORY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  marketing: "default",
  notification: "secondary",
  transactional: "outline",
};

export const TRIGGER_EVENT_LABELS: Record<string, { label: string; description: string }> = {
  technician_accepted_job: {
    label: "Technician Accepts a Job",
    description: "Sent when a technician accepts a marketplace job",
  },
  job_completed: {
    label: "Job Completed",
    description: "Sent when a technician marks a job as complete",
  },
  overdue_maintenance: {
    label: "Overdue Maintenance Item",
    description: "Sent when a maintenance task becomes overdue",
  },
  asset_end_of_life: {
    label: "Asset Reaching End of Life",
    description: "Sent when an asset is nearing its expected end of life",
  },
  property_transfer_initiated: {
    label: "Property Transfer Initiated",
    description: "Sent when a dossier transfer is requested",
  },
  collaborator_invited: {
    label: "Collaborator Invited",
    description: "Sent when a homeowner invites someone to co-manage a property",
  },
  new_feature_announcement: {
    label: "New Feature Announcement",
    description: "Manual blast to announce a new platform feature",
  },
  monthly_update: {
    label: "Monthly Update",
    description: "Scheduled monthly digest with upcoming maintenance items",
  },
  custom: {
    label: "Custom Trigger",
    description: "Fully configurable trigger with custom conditions",
  },
};

export const STARTER_TEMPLATES: Record<string, { subject: string; body: string }> = {
  marketing: {
    subject: "Exciting news from Casa Dossier",
    body: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="color: #2563eb;">Hello {{firstName}},</h1>
  <p>We have some exciting news to share with you!</p>
  <p><!-- Add your message here --></p>
  <a href="{{ctaUrl}}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Learn More</a>
  <p style="margin-top: 32px; color: #6b7280; font-size: 13px;">You're receiving this because you're a Casa Dossier member.<br>
  <a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
</body>
</html>`,
  },
  notification: {
    subject: "Action required for your property",
    body: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h2 style="color: #1a1a1a;">Hi {{firstName}},</h2>
  <p>This is a notification about your property at <strong>{{propertyAddress}}</strong>.</p>
  <p><!-- Describe the notification here --></p>
  <a href="{{actionUrl}}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View Details</a>
  <p style="margin-top: 32px; color: #6b7280; font-size: 13px;">Casa Dossier — Your Home Maintenance OS</p>
</body>
</html>`,
  },
  transactional: {
    subject: "Your Casa Dossier update",
    body: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h2>Hi {{firstName}},</h2>
  <p>Here's a summary of recent activity on your account.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Item</td>
      <td style="padding: 8px 0; font-size: 14px;">Details</td>
    </tr>
  </table>
  <p style="color: #6b7280; font-size: 13px;">— The Casa Dossier Team</p>
</body>
</html>`,
  },
};
