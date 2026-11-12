# Casa Dossier — Improvement Checklist

From the investor-style review (2026-11-11), updated with decisions made 2026-11-11.
Tick the box next to each item you approve; nothing gets built until it's approved.

Size: **S** = under a day · **M** = 1–3 days · **L** = a week or more

## Decisions made

| Topic | Decision |
|---|---|
| Strategy | Homeowner first, then real estate agents, then insurers / home-warranty companies |
| Backdating | Allowed. Every homeowner record shows "Self-reported · added <date>", calculated on the server |
| Managed ($35) / Concierge ($99) | Hidden until the offerings are solid |
| Unclaimed homes | Next owner inherits the history once they prove ownership with a closing document or a photo of their ID. Only required when the address has existing records. Receipts, documents and notes don't pass on |
| Report sharing | "Generate report" emails the PDF directly from Casa Dossier to the addresses the user enters. Recipients know it came from Casa Dossier, so there's no check code |
| Assets | Can't be deleted, only retired. Retired assets are inactive: no new records or tasks, but their history stays on the report |
| Free tier | 5 AI scans and 5 AI plans |
| Marketplace | Casa Dossier's own Atlanta service business, not an open marketplace |
| Collaborators | Move to Basic |

## Still open

- [ ] **For you, not code:** confirm the Georgia licensing and liability insurance your service work needs before records get marked "Verified by CasaService".

---

## Phase 1 — Trust & legal exposure (do first)

### 1.1 Make "verified" mean something
- [x] **S** — Show the gold CasaService badge only when the record's `verified` flag is true, not when `companyName === "CasaService"` (`artifacts/casa-dossier/src/pages/report.tsx:31`). Apply the same fix in mobile.
- [x] **S** — Stop clients from typing "CasaService" as a company name. The server rejects it or rewrites it.
- [x] **S** — Label every record: **Verified by CasaService**, or **Self-reported · added <createdAt>** (it also shows the date the work was done). Calculate the label on the server from `createdAt`, which homeowners can't edit.
- [x] **S** — Remove the "Verified" stamp, "Audited Events", "Verified Logic" and "Chain of Custody" copy from the report (`en.json:1211-1220`, `report.tsx:179`). In their place, show counts: "X verified / Y self-reported".
- [x] **S** — Homeowners can no longer set an asset's `status` to `verified` (`routes/assets.ts:93`). The AI plan (`lens.ts:180`) and scout (`scout.ts:229`) also stop marking assets verified.
- [x] **S** — Verified records can't be edited.
- [x] **M** — Add an audit log table recording who created, changed or deleted assets and records, and when.
- [x] **S** — Add `createdByUserId` to `service_records`.
- [x] **S** — Encourage a receipt when entering work done more than 30 days ago (an optional prompt, not required).

### 1.1b Retire instead of delete
- [x] **S** — Remove asset deletion from the web and mobile apps; the delete action becomes "Retire". The API delete route is limited to admins, for support and abuse cases (`routes/assets.ts:112-122`).
- [x] **S** — Retiring asks for a reason (replaced / removed / failed / other) and a date, kept with the asset.
- [x] **S** — Retired assets are read-only: the server rejects new service records and new or completed maintenance tasks on them (`routes/service_records.ts`, `routes/maintenance.ts`).
- [x] **S** — Retiring closes the asset's open maintenance tasks and stops its reminders (`lib/maintenanceReminders.ts`).
- [x] **S** — Retired assets drop out of the health score and capital outlook, but stay in the report's "Retired" section (the report already supports this, `routes/report.ts:49`).
- [x] **S** — "Replaced" flow: retiring with reason "replaced" offers to add the new asset straight away.
- [x] **S** — Assets entered by mistake: allow "Remove — added by mistake" only if the asset has no service records and was created in the last 7 days. Anything else must be retired.
- [x] **S** — Keep "Reactivate" for owners, so a mistaken retirement can be undone; it's logged in the audit log.

### 1.2 Remove claims the product can't back up
- [x] **S** — Hide the Managed and Concierge plans in the web upgrade modal, mobile `upgrade.tsx`, the pricing copy, and `/stripe/plans`. Stripe products stay in place; existing subscribers, if any, keep their plan.
- [x] **S** — Remove the "Marcus T., Austin TX" testimonial and its stock photo from the landing page (`landing.tsx:265-291`).
- [x] **S** — Soften the landing-page claims "verified record" and "increase resale value" until the product supports them.
- [x] **S** — Move collaborators from Managed to Basic (`collaborators.ts:57`), plus the plan copy.

### 1.3 Keep the home's history (inheritance)
- [x] **M** — Deleting an account no longer hard-deletes owned properties (`user-profile.ts:245`). Instead, the property is detached from the user and kept as an unclaimed dossier.
- [x] **M** — When someone adds a property whose address matches an unclaimed dossier with existing records, offer to claim the history. If the address has no records, the property is added right away with no verification.
- [x] **M** — Claim flow: the user uploads a **closing document** (settlement statement or deed) or a **photo of their ID**. The history is held until approved.
- [x] **M** — Admin review queue: view the upload next to the property, approve or reject with a reason, and email the user the outcome.
- [x] **S** — For ID uploads, match the name on the ID against the property's owner of record (RentCast owner data or county records, checked by the reviewer). An ID proves who someone is, not that they own the home, and the address on a recent buyer's ID is often still their old one.
- [x] **M** — Handling the uploads: store them in a separate private bucket that only admins can read, record every view in the audit log, and **delete the file automatically once a decision is made** (keeping only "approved by X on date, document type"). Never shown to anyone else or kept long term.
- [x] **M** — Inherited history keeps only the facts: asset, brand/model, install date, service date, description, cost, and verified status. Receipt files, locker documents, photos and free-text notes are removed.
- [x] **S** — Normalize addresses so the same home matches reliably (unit numbers, abbreviations).
- [x] **S** — Privacy-policy text and an account-deletion notice: "Your home's service history stays with the house; receipts and documents are deleted."
- [x] **M** — Locker documents attach to a property, not just a user, so a deliberate transfer can include warranties and permits if the owner chooses (`routes/locker.ts`).

### 1.4 Close privacy gaps
- [x] **M** — Receipt and photo files require a login and access check, using short-lived signed URLs instead of public links (`routes/storage.ts:101-130`).
- [x] **S** — Before a job is accepted, its details hide service history, costs, receipts and notes (`marketplace.ts:231-265`).
- [x] **S** — In production, CORS no longer accepts `localhost` origins (`app.ts:63-88`).
- [x] **S** — Remove the hardcoded fallback demo token. If `DEMO_TOKEN` isn't set, demo mode is off (`requireAuth.ts:14`, `App.tsx:47`).
- [x] **S** — Stop sending RentCast's raw error text to the client (`scout.ts:92`).
- [x] **S** — Add privacy and terms pages to the web app (mobile already links to them).

---

## Phase 2 — Homeowner value

### 2.1 Emailed report
- [x] **M** — Generate the report as a PDF on the server, the same for web and mobile.
- [x] **M** — "Generate report" opens a form: recipient emails (up to 5), an optional message, and include costs on/off. Receipts are never included.
- [x] **S** — Send it through Resend from Casa Dossier's own address (e.g. `reports@casadossier.com`), with the PDF attached and "sent on behalf of <owner name>" in the email. The domain needs SPF/DKIM set up so the email isn't marked as spam or easily spoofed.
- [x] **S** — Keep a log of each send (who, when, to whom, report date) and show it to the owner as "Report history".
- [x] **S** — Limit sending (e.g. 10 sends a day per user) so the feature can't be used to spam people.
- [x] **S** — The owner can still download a copy for themselves, labelled "Personal copy — for official sharing, email it from Casa Dossier".

### 2.2 Better data behind the numbers
- [x] **M** — Lifespan and interval tables with cited sources (e.g. NAHB/InterNACHI), stored in one place.
- [x] **M** — Climate/region adjustment to lifespans, based on the property's state.
- [x] **M** — Default replacement-cost estimates per category, adjusted by region and inflation, used when the user hasn't entered one. Make it clear which figures are estimates.
- [x] **S** — Use one health-score formula across web and API (today `health-score.ts` and `asset-scoring.ts` differ), and include service history in it.
- [x] **S** — In the ledger, record entered and estimated cost separately so estimates don't count as actual spend (`maintenance.ts:205-210`).
- [x] **S** — Validate AI Lens output against a schema before returning it (`lens.ts`).

### 2.3 Onboarding & retention
- [x] **S** — Free tier: `FREE_AI_ALLOWANCE` 1 → 5 for scans and plans (`lib/subscription.ts:36`), plus the upgrade copy.
- [x] **M** — Suggested starter assets during onboarding based on year built and home type, so the dossier isn't empty after setup.
- [x] **S** — Seed data for the demo account, and let demo show Capital Outlook unlocked.

### 2.4 Maintenance email notifications (matching mobile)
Today's push reminders (`lib/maintenanceReminders.ts`) run daily for tasks due within 3 days. That means the same task repeats every day, overdue tasks are never mentioned, only the owner is notified, and nobody can opt out. Email gets the fixed version, and push gets the same fixes.

**What gets sent**
- [x] **M** — **"Due soon" email:** sent **once per task**, 3 days before it's due. If several tasks are due, they're grouped into one email per property ("3 tasks due this week at 123 Oak St").
- [x] **S** — **Overdue email:** once on the day after the due date, once more at 7 days overdue, then it only appears in the weekly summary. This fills the gap in today's reminders, which skip overdue tasks.
- [x] **M** — **Weekly summary (Monday morning):** tasks due in the next 7 days, everything overdue, and what was completed last week. Not sent if there's nothing to report.
- [x] **S** — Each task in an email shows the asset, the task, the due date, the estimated cost, and whether it's DIY, with an **"Open in Casa Dossier"** button that links to the task. *No one-click "mark done" link:* email security scanners open links automatically and would complete tasks by accident.

**Who gets it, and control**
- [x] **S** — Track what was sent per task and channel (a new `reminder_log` table: task, channel, kind, sent date), so nothing repeats. Push uses the same table, which ends today's daily repeats.
- [x] **M** — Notification settings on web and mobile: email on/off, push on/off, and weekly summary on/off. Default: all on.
- [x] **S** — One-click unsubscribe link in every email, plus the `List-Unsubscribe` header that Gmail and Yahoo now require for bulk senders. It turns off only reminder emails, not transfer or receipt emails.
- [x] **S** — Collaborators can opt in to reminders for a shared property; off by default.
- [x] **S** — Retired assets and completed tasks never trigger reminders (also applies to push).
- [x] **S** — Send at 8am in the property's local timezone, based on its state. Today everyone gets 8am ET (`SCHEDULE_TIMEZONE`).

**Content & delivery**
- [x] **S** — Use the existing admin email templates (`email_templates` / `email_triggers`; `overdue_maintenance` already exists). Add `maintenance_due_soon` and `weekly_summary` with default templates, so you can change wording in the admin panel without a code release.
- [x] **S** — Requires `RESEND_API_KEY` and `EMAIL_FROM` in Replit secrets, on a domain with SPF/DKIM set up (the same setup as emailed reports in 2.1).
- [x] **S** — Tests: once-only sending, overdue timing, opt-out respected, retired assets skipped.

---

## Phase 3 — CasaService as your Atlanta service business

- [x] **S** — Homeowners outside the service area can't submit a request; they see a "Not in your area yet — join the waitlist" message instead. Check this on the server, not just in the app.
- [x] **S** — Move the service area (center + radius) into one config value instead of hardcoding Atlanta in the tech portal and mobile (`tech-portal/src/pages/map.tsx:42`, mobile `open-jobs.tsx`).
- [x] **S** — Change the copy to "Request service from the Casa Dossier team (Atlanta area)" instead of "find a pro" / marketplace wording.
- [x] **S** — Remove the technician self-signup implication ("We'll review your account", `profile-setup.tsx:46`). Technician access stays admin-granted.
- [x] **M** — Job cancel by the homeowner, and decline/release by the technician.
- [x] **S** — Fix bugs: reschedule allowed on completed jobs and invalid dates cause a 500 (`marketplace.ts:279-302`); the "on the way" check uses UTC instead of local time (`:351`); merge the copy-pasted notification code (4 copies).
- [x] **S** — Notify you (email/push) when a new request comes in.
- *Later:* send quotes/invoices through Stripe so service income is tracked in the app.

---

## Phase 4 — Platform & engineering health

- [x] **M** — Switch from `drizzle-kit push` to versioned migrations. **Do this before the schema changes in 1.1 and 1.3.**
- [x] **M** — Tests for access control, verified-record rules, inheritance, health score and capital outlook.
- [ ] **S** — Add error monitoring (e.g. Sentry) to the API and apps. *(Not built — `@sentry/*` packages couldn't be installed from this machine; needs `pnpm add` with registry access.)*
- [x] **S** — Shared rate limiting (DB- or Redis-backed) instead of in-memory per instance; add limits to RentCast and scout calls.
- [x] **S** — Enforce upload size/type on the server, not just against values the client declares (`storage.ts:16-43`).
- [x] **S** — Fix the admin backfill bug that sets `firstName` to the Clerk user ID (`admin-extended.ts:67`).
- [x] **M** — Move file storage off the Replit sidecar to S3/GCS directly (`lib/objectStorage.ts`) so the app runs anywhere, including locally. *(Done for direct GCS and local disk; S3 not built — AWS SDK couldn't be installed from this machine.)*
- [x] **S** — OpenAI env vars no longer Replit-specific; the server boots without them and AI features degrade gracefully.

---

## Later — customers beyond the homeowner (parked)

1. **Real estate agents:** a closing-gift flow where the agent pays for N months and hands the dossier to the buyer. Revisit a live report link here, if emailed reports aren't enough for agents.
2. **Insurers**, then **home-warranty companies.**

---

## Suggested order

1. **4 → migrations**, then **Phase 1** (about 2–2.5 weeks with inheritance, the review queue and retire-only assets)
2. **Phase 3** quick wins (service-area gating, copy, bug fixes): 1–2 days, and can go alongside
3. **2.4 email notifications** right after Phase 1 (about 3–4 days): it's the main reason people come back, and 2.1 needs the same email domain setup anyway
4. The rest of **Phase 2**
5. The rest of **Phase 4** alongside
