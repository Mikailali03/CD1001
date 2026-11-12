import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

// DRAFT: plain-language summaries of how Casa Dossier actually handles data.
// Have a lawyer review both documents before relying on them.
const CONTACT_EMAIL = "help@casadossier.com";
const LAST_UPDATED = "November 2026";

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Casa Dossier
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated {LAST_UPDATED}</p>
        <div className="space-y-8 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Your account: name, email address and phone number (if you add one).</li>
          <li>Your home: address, property details, photos, and the systems and appliances you add.</li>
          <li>Your records: service history, maintenance tasks, receipts, costs and notes.</li>
          <li>Documents you file in the Digital Locker, such as warranties, manuals and permits.</li>
          <li>Service requests: the description and contact phone number you give us.</li>
          <li>Proof of ownership (a closing document or photo ID), only if you claim a previous owner's history.</li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To run your dossier: reminders, health scores, the capital outlook and reports.</li>
          <li>To scan appliance labels and suggest maintenance plans, using OpenAI. Photos you scan are sent to OpenAI for that purpose.</li>
          <li>To look up public property details for your address, using RentCast.</li>
          <li>To schedule and complete service work you request from the Casa Dossier team.</li>
          <li>To send emails and notifications about your homes, such as maintenance reminders, transfer invitations and collaborator invites.</li>
        </ul>
        <p className="mt-2">We don't sell your data or use it for advertising.</p>
      </section>

      <section>
        <h2>Who can see it</h2>
        <ul>
          <li>You, and anyone you invite as a collaborator on a home.</li>
          <li>A Casa Dossier technician, for the system you've requested service on, once they take the job. Before that, they see only the type of system and its make, model and age.</li>
                    <li>People you choose to email a report to. Reports never include receipts or photos, and you choose whether costs are included.</li>
          <li>Casa Dossier staff, to support you and review ownership claims.</li>
          <li>Service providers that run the app for us: Clerk (sign-in), Stripe (payments), Resend (email), OpenAI (AI features), RentCast (property data) and Replit/Google Cloud (hosting and file storage).</li>
        </ul>
      </section>

      <section>
        <h2>Your home's history when you delete your account</h2>
        <p>
          Casa Dossier is a record that belongs with the house. When you delete your account, we delete your account,
          Digital Locker documents, photos, receipts, notes, service requests and subscription. If a home has service history,
          we keep the facts of that history (the systems, the dates, the work done, costs and whether it was verified) without
          your name or contact details, so a future owner can claim it after proving they own the home.
        </p>
      </section>

      <section>
        <h2>Proof-of-ownership documents</h2>
        <p>
          If you claim a previous owner's history, the closing document or photo ID you upload is visible only to Casa Dossier
          staff, is used only to verify ownership, and is deleted as soon as we approve or reject the claim. We keep only a
          note of the decision and the type of document.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>You can edit or retire what you've added, and remove collaborators at any time.</li>
          <li>You can turn reminder emails, the weekly summary and push reminders on or off in Settings, or use the unsubscribe link in any reminder email.</li>
          <li>You can delete your account from Settings in the mobile app, or by emailing us.</li>
        </ul>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions or requests: <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </section>
    </LegalPage>
  );
}

export function TermsOfService() {
  return (
    <LegalPage title="Terms of Service">
      <section>
        <h2>Using Casa Dossier</h2>
        <p>
          Casa Dossier helps you keep a record of your home's systems, maintenance and service history. You're responsible
          for the information you add and for keeping your account secure. Only add homes you own or manage with the owner's permission.
        </p>
      </section>

      <section>
        <h2>Self-reported and verified records</h2>
        <p>
          Records you add are labelled self-reported, with the date you added them. Only work completed by the Casa Dossier
          service team is labelled "Verified by CasaService". Casa Dossier doesn't inspect homes or check the accuracy of
          self-reported records, and a dossier is not a home inspection, appraisal or warranty.
        </p>
      </section>

      <section>
        <h2>Estimates</h2>
        <p>
          Lifespans, replacement costs, health scores and AI-suggested maintenance plans are estimates to help you plan.
          They may be wrong for your home. Check with a qualified professional before making decisions based on them.
        </p>
      </section>

      <section>
        <h2>Service work</h2>
        <p>
          Service requests are available in the Atlanta area and are carried out by the Casa Dossier team. Pricing and
          scheduling are agreed with you before work begins.
        </p>
      </section>

      <section>
        <h2>Subscriptions</h2>
        <p>
          Paid plans renew monthly until you cancel. You can cancel any time from Settings; your plan stays active until the
          end of the period you've paid for. If you downgrade, you keep access to everything you've already added.
        </p>
      </section>

      <section>
        <h2>Transfers and ownership claims</h2>
        <p>
          When you transfer a home, its dossier moves to the new owner and you lose access to it. If you claim a previous
          owner's history, you confirm that you own the home and that the document you provide is genuine.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p><a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </section>
    </LegalPage>
  );
}
