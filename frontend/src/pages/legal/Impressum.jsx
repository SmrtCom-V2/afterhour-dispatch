import { Link } from 'react-router-dom';
import { Placeholder } from './Placeholder';
import './LegalPage.css';

// German TMG §5 requires this on any commercial website reachable from
// Germany, incorporated or not. Every field below is a placeholder until
// the company is incorporated — do not remove the TODO markers, replace
// them with real values as they become available.
export function Impressum() {
  return (
    <div className="legal-page">
      <Link to="/" className="legal-back">← Back</Link>
      <h1>Impressum</h1>
      <p className="legal-updated">Angaben gemäß § 5 TMG</p>

      <Placeholder label="Legal entity — fill in once incorporated">
        <p style={{ margin: '4px 0 0' }}>
          [Company legal name, e.g. "24-7 Dispatch GmbH"]<br />
          [Street address]<br />
          [Postal code, city]<br />
          [Country]
        </p>
      </Placeholder>

      <h2>Vertreten durch</h2>
      <Placeholder label="Managing director / authorized representative name" />

      <h2>Kontakt</h2>
      <Placeholder label="Business phone number" />
      <Placeholder label="Business email address" />

      <h2>Registereintrag</h2>
      <Placeholder label="Handelsregister entry — court + registration number (once incorporated)">
        <p style={{ margin: '4px 0 0' }}>
          Eintragung im Handelsregister.<br />
          Registergericht: [e.g. Amtsgericht Berlin (Charlottenburg)]<br />
          Registernummer: [HRB xxxxx]
        </p>
      </Placeholder>

      <h2>Umsatzsteuer-ID</h2>
      <Placeholder label="VAT ID (Umsatzsteuer-Identifikationsnummer gemäß §27a UStG) — issued after incorporation + VAT registration" />

      <h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
      <Placeholder label="Person responsible for editorial content (usually same as managing director)" />

      <h2>EU-Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
        <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer">
          https://ec.europa.eu/consumers/odr/
        </a>.
        Unsere E-Mail-Adresse finden Sie oben im Impressum.
      </p>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <div className="legal-footer-links">
        <Link to="/privacy">Datenschutzerklärung</Link>
        <Link to="/terms">AGB / Terms of Service</Link>
      </div>
    </div>
  );
}
