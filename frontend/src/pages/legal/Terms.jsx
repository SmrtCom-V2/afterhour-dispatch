import { Link } from 'react-router-dom';
import { Placeholder } from './Placeholder';
import './LegalPage.css';

// Draft ToS. Placeholders for entity name/jurisdiction until
// incorporation. Have a lawyer review before relying on this for real
// customers — this is a reasonable starting draft, not legal advice.
export function Terms() {
  return (
    <div className="legal-page">
      <Link to="/" className="legal-back">← Back</Link>
      <h1>Terms of Service</h1>
      <p className="legal-updated">Last updated: [DATE — update when finalized]</p>

      <Placeholder label="Have a lawyer review this entire page before relying on it for real customers." />

      <h2>1. These Terms</h2>
      <Placeholder label="Legal entity name (once incorporated) — used throughout this document in place of '[Company]'" />
      <p>
        These Terms of Service ("Terms") govern access to and use of the After Hour Dispatch
        platform (the "Service"), operated by [Company] ("we", "us"). By creating an account or
        using the Service, you agree to these Terms on behalf of yourself and the organization
        you represent ("Customer").
      </p>

      <h2>2. The Service</h2>
      <p>
        The Service provides after-hours emergency call handling for facility management
        companies, including AI-assisted call intake, incident logging, human-in-the-loop
        escalation to on-call staff, and related dispatch coordination tooling. The Service does
        not itself dispatch emergency responders without human decision — all dispatch and
        escalation actions require confirmation by a designated on-call person at Customer's
        organization.
      </p>

      <h2>3. Accounts and Access</h2>
      <ul>
        <li>Customer is responsible for maintaining the confidentiality of login credentials.</li>
        <li>Customer is responsible for the accuracy of data entered into the Service (building details, on-call schedules, contact information) — the Service's usefulness in a real emergency depends on this data being current.</li>
        <li>We may suspend access for non-payment, as described in Section 5.</li>
      </ul>

      <h2>4. Subscription and Trial</h2>
      <Placeholder label="Confirm actual trial length (code currently defaults new companies to a trial period) and pricing tiers before publishing" />
      <p>
        New accounts begin with a trial period. Continued access after the trial requires an
        active paid subscription. Subscription plans, pricing, and included features are
        described at checkout and may be updated from time to time with notice.
      </p>

      <h2>5. Payment and Suspension</h2>
      <p>
        Subscriptions are billed via Stripe on a recurring basis. If a payment fails or a
        subscription is cancelled, access to core platform features (incident management,
        on-call scheduling, building/tenant records) may be suspended until payment is
        resolved. Billing and account settings remain accessible during suspension so Customer
        can update payment details.
      </p>

      <h2>6. Emergency Service Limitations</h2>
      <p>
        <strong>The Service is a coordination and notification tool, not an emergency response
        service.</strong> It does not replace calling local emergency services (police, fire,
        ambulance) for life-threatening situations. Availability depends on functioning phone
        networks, third-party providers (Twilio, Retell AI, Anthropic), and Customer's on-call
        staff being reachable and properly configured in the system. We do not guarantee
        uninterrupted availability.
      </p>

      <h2>7. Data</h2>
      <p>
        Processing of personal data is described in our{' '}
        <Link to="/privacy">Datenschutzerklärung / Privacy Policy</Link>. Customer remains
        responsible for the accuracy and lawfulness of data it inputs about tenants, buildings,
        and staff.
      </p>

      <h2>8. Termination</h2>
      <p>
        Either party may terminate at any time via the account settings or by written notice.
        Upon termination, Customer's data will be retained per our data retention policy and
        may be deleted or exported per applicable GDPR data subject rights processes.
      </p>

      <h2>9. Liability</h2>
      <Placeholder label="Liability limitation clause needs lawyer drafting — especially important given this product handles building emergencies. Do not publish without legal review." />

      <h2>10. Governing Law</h2>
      <Placeholder label="Jurisdiction (likely Germany, specific city once incorporated)" />

      <div className="legal-footer-links">
        <Link to="/impressum">Impressum</Link>
        <Link to="/privacy">Datenschutzerklärung</Link>
      </div>
    </div>
  );
}
