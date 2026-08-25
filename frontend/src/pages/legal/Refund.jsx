import { Link } from 'react-router-dom';
import { Placeholder } from './Placeholder';
import './LegalPage.css';

// Draft refund policy — describes actual billing behavior in this app
// (14-day free trial, cancel-at-period-end, 7-day dunning grace period,
// no proration on upgrade/downgrade or mid-cycle cancellation). Entity
// details are placeholders until incorporation. Have a lawyer review
// before this is relied on for real customers — this is a technically
// accurate starting draft, not legal advice.
export function Refund() {
  return (
    <div className="legal-page">
      <Link to="/" className="legal-back">← Back</Link>
      <h1>Refund Policy</h1>
      <p className="legal-updated">Last updated: [DATE — update when finalized]</p>

      <Placeholder label="Have a lawyer review this entire page before relying on it for real customers, especially EU/German statutory withdrawal rights (Widerrufsrecht) for consumer-like B2B contracts." />

      <h2>1. Free Trial</h2>
      <p>
        New accounts start with a 14-day free trial. You are not charged during the trial, and
        you can cancel at any time before it ends with no payment taken. If you do not cancel
        before the trial ends and a payment method is on file, your subscription begins and
        billing starts per Section 2.
      </p>

      <h2>2. Subscription Billing</h2>
      <p>
        Subscriptions are billed via Stripe in advance, either monthly or annually depending on
        the plan you choose at checkout. Annual plans waive the one-time onboarding fee shown at
        checkout; monthly plans do not. Charges are non-refundable for the period already paid
        for, except as described below.
      </p>

      <h2>3. Cancellation</h2>
      <p>
        You can cancel your subscription at any time from account settings or by contacting us.
        Cancellation takes effect at the end of your current billing period — you keep full
        access until then, and you are not charged again afterward. We do not provide partial
        refunds for the unused portion of a billing period when you cancel mid-cycle.
      </p>

      <h2>4. Failed Payments</h2>
      <p>
        If a payment fails, we do not suspend access immediately. Your account keeps working for
        a 7-day grace period while we (and Stripe's automatic retry system) attempt to charge
        your payment method again. You'll receive an email when a payment fails and reminders
        before the grace period ends. If payment still hasn't succeeded after 7 days, access to
        core platform features is suspended until you update your payment method and the
        outstanding charge succeeds.
      </p>

      <h2>5. Refund Requests</h2>
      <Placeholder label="Confirm whether Ron wants a discretionary refund window (e.g. 14 days from first charge) for genuine billing mistakes / accidental signups, or a strict no-refund policy. Currently written as case-by-case at our discretion, since no refund mechanism exists in the codebase today." />
      <p>
        Outside of the situations above, refunds are handled case by case. If you believe you
        were charged in error — for example, a duplicate charge or a charge after you cancelled —
        contact us and we will investigate and refund confirmed billing errors in full. We do not
        offer refunds for unused time on an active subscription you chose not to cancel, or for
        dissatisfaction with the Service after the trial period; if the Service isn't a fit,
        cancelling before your next billing date avoids further charges.
      </p>

      <h2>6. Chargebacks and Disputes</h2>
      <p>
        If you dispute a charge directly with your bank or card provider instead of contacting us
        first, we're notified automatically and your account may be flagged while the dispute is
        reviewed. We'd rather resolve a billing problem directly — please reach out to us first so
        we can fix it without involving your bank.
      </p>

      <h2>7. How to Request a Refund</h2>
      <Placeholder label="Support/billing contact email once decided (can reuse the Impressum contact address)." />
      <p>
        Email us with your account/company name and the reason for the request. We aim to
        respond within a few business days.
      </p>

      <div className="legal-footer-links">
        <Link to="/impressum">Impressum</Link>
        <Link to="/privacy">Datenschutzerklärung</Link>
        <Link to="/terms">Terms of Service</Link>
      </div>
    </div>
  );
}
