import { Link } from 'react-router-dom';
import { Placeholder } from './Placeholder';
import './LegalPage.css';

// Draft privacy policy — describes actual data processing in this app
// (auth, incidents, on-call, voice AI, Stripe, cookies). Entity details
// are placeholders until incorporation. Have a lawyer review before
// this is relied on for real customers — this is a technically accurate
// starting draft, not legal advice.
export function Datenschutz() {
  return (
    <div className="legal-page">
      <Link to="/" className="legal-back">← Back</Link>
      <h1>Datenschutzerklärung</h1>
      <p className="legal-updated">Stand: [DATE — update when finalized]</p>

      <Placeholder label="Have a lawyer review this entire page before relying on it for real customers." />

      <h2>1. Verantwortlicher</h2>
      <Placeholder label="Legal entity + address (same as Impressum, once incorporated)" />
      <Placeholder label="Data protection contact email (can be the same as business email initially)" />

      <h2>2. Welche Daten wir verarbeiten</h2>
      <p>Im Rahmen der Nutzung dieser Plattform verarbeiten wir folgende Datenkategorien:</p>
      <ul>
        <li><strong>Kontodaten:</strong> Name, E-Mail-Adresse, Passwort (gehasht), Firmenzugehörigkeit</li>
        <li><strong>Betriebsdaten:</strong> Gebäude-, Mieter- und Dienstleisterinformationen, die von Ihnen als Kunde eingegeben werden</li>
        <li><strong>Notfalldaten:</strong> Anrufaufzeichnungen und -transkripte, Vorfallsbeschreibungen, Standortdaten von Gebäuden (inkl. Absperr- und Zugangsinformationen für Notfälle)</li>
        <li><strong>Nutzungsdaten:</strong> Login-Zeitpunkte, IP-Adressen, Geräteinformationen</li>
        <li><strong>Zahlungsdaten:</strong> Werden über Stripe verarbeitet — wir speichern keine vollständigen Zahlungskartendaten selbst</li>
      </ul>

      <h2>3. Sprachassistent (Voice AI)</h2>
      <p>
        Eingehende Notrufe werden über einen KI-gestützten Sprachassistenten (Retell AI in
        Verbindung mit Anthropic Claude) entgegengenommen und verarbeitet. Anrufe können
        aufgezeichnet und automatisch in Text umgewandelt werden, um Vorfälle zu erfassen und
        an die zuständige Bereitschaftsperson weiterzuleiten. Eine automatische Entscheidung
        über die Entsendung von Dienstleistern erfolgt nicht — dies obliegt stets einem
        Menschen (Human-in-the-Loop-Prinzip).
      </p>

      <h2>4. Zweck der Verarbeitung</h2>
      <ul>
        <li>Bereitstellung der Notfall-Dispatch-Plattform (Vertragserfüllung, Art. 6 Abs. 1 lit. b DSGVO)</li>
        <li>Abrechnung und Zahlungsabwicklung über Stripe (Art. 6 Abs. 1 lit. b DSGVO)</li>
        <li>Sicherheit, Missbrauchsprävention, Rate-Limiting (berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO)</li>
        <li>Gesetzliche Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO)</li>
      </ul>

      <h2>5. Cookies</h2>
      <p>
        Wir verwenden technisch notwendige Cookies (z. B. Session-Authentifizierung). Ein
        Cookie-Consent-Banner informiert Sie beim ersten Besuch. Details zu einzelnen Cookies:
      </p>
      <Placeholder label="List actual cookie names/purposes if any tracking/analytics cookies get added beyond the session token" />

      <h2>6. Auftragsverarbeiter / Drittanbieter</h2>
      <p>Zur Erbringung unserer Dienstleistung setzen wir folgende Auftragsverarbeiter ein:</p>
      <ul>
        <li><strong>Twilio</strong> — Telefonie und SMS-Benachrichtigungen</li>
        <li><strong>Retell AI</strong> — Sprachassistent-Infrastruktur</li>
        <li><strong>Anthropic (Claude)</strong> — KI-Verarbeitung von Anrufinhalten</li>
        <li><strong>Stripe</strong> — Zahlungsabwicklung</li>
        <li><strong>Amazon Web Services (AWS)</strong> — Server-Hosting</li>
        <li><strong>Vercel</strong> — Hosting der Weboberfläche</li>
      </ul>
      <Placeholder label="Confirm this vendor list is complete and current, and that AVVs (Art. 28 DSGVO data processing agreements) are signed with each before real customer data flows" />

      <h2>7. Speicherdauer</h2>
      <p>
        Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke
        erforderlich ist oder gesetzliche Aufbewahrungsfristen dies verlangen.
      </p>
      <Placeholder label="Define concrete retention periods (e.g. call recordings X months, incident records X years) and confirm they match actual DB/backup behavior" />

      <h2>8. Ihre Rechte</h2>
      <p>Sie haben das Recht auf:</p>
      <ul>
        <li>Auskunft über die von uns verarbeiteten Daten (Art. 15 DSGVO)</li>
        <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
        <li>Löschung Ihrer Daten (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
        <li>Beschwerde bei einer Aufsichtsbehörde</li>
      </ul>
      <p>
        Sie können Auskunfts- und Löschanfragen direkt über Ihre Kontoeinstellungen stellen
        oder uns unter der oben genannten Kontaktadresse erreichen.
      </p>

      <h2>9. Zuständige Aufsichtsbehörde</h2>
      <Placeholder label="Regional data protection authority once the company's registered address is known (e.g. Berliner Beauftragte für Datenschutz und Informationsfreiheit if HQ is in Berlin)" />

      <div className="legal-footer-links">
        <Link to="/impressum">Impressum</Link>
        <Link to="/terms">AGB / Terms of Service</Link>
        <Link to="/erstattung">Erstattungsrichtlinie</Link>
      </div>
    </div>
  );
}
