import { Link } from 'react-router-dom';
import { Placeholder } from './Placeholder';
import './LegalPage.css';

// German version of the refund policy — see Refund.jsx for the source
// of truth on billing behavior (14-day trial, cancel-at-period-end,
// 7-day dunning grace period, no proration). Entity details are
// placeholders until incorporation. Have a lawyer review before this is
// relied on for real customers — this is a technically accurate
// starting draft, not legal advice.
export function Erstattung() {
  return (
    <div className="legal-page">
      <Link to="/" className="legal-back">← Zurück</Link>
      <h1>Erstattungsrichtlinie</h1>
      <p className="legal-updated">Stand: [DATUM — bei Finalisierung aktualisieren]</p>

      <Placeholder label="Diese gesamte Seite von einem Anwalt prüfen lassen, bevor sie für echte Kunden verwendet wird — insbesondere das gesetzliche Widerrufsrecht bei verbraucherähnlichen B2B-Verträgen." />

      <h2>1. Kostenlose Testphase</h2>
      <p>
        Neue Konten starten mit einer 14-tägigen kostenlosen Testphase. Während der Testphase
        entstehen keine Kosten. Sie können jederzeit vor Ablauf der Testphase kündigen, ohne dass
        eine Zahlung erfolgt. Kündigen Sie nicht vor Ablauf und ist eine Zahlungsmethode
        hinterlegt, beginnt Ihr Abonnement gemäß Abschnitt 2.
      </p>

      <h2>2. Abonnement-Abrechnung</h2>
      <p>
        Abonnements werden über Stripe im Voraus abgerechnet, entweder monatlich oder jährlich,
        je nach beim Checkout gewähltem Plan. Bei Jahresverträgen entfällt die beim Checkout
        angezeigte einmalige Onboarding-Gebühr; bei Monatsverträgen nicht. Bereits bezahlte
        Zeiträume sind vorbehaltlich der folgenden Regelungen nicht erstattungsfähig.
      </p>

      <h2>3. Kündigung</h2>
      <p>
        Sie können Ihr Abonnement jederzeit in den Kontoeinstellungen oder durch Kontaktaufnahme
        mit uns kündigen. Die Kündigung wird zum Ende des aktuellen Abrechnungszeitraums wirksam —
        Sie behalten bis dahin vollen Zugriff und werden danach nicht erneut belastet. Für den
        ungenutzten Teil eines Abrechnungszeitraums bei Kündigung während der Laufzeit erfolgt
        keine anteilige Rückerstattung.
      </p>

      <h2>4. Fehlgeschlagene Zahlungen</h2>
      <p>
        Bei einer fehlgeschlagenen Zahlung wird der Zugang nicht sofort gesperrt. Ihr Konto bleibt
        für eine 7-tägige Karenzzeit nutzbar, während wir (und Stripes automatisches
        Wiederholungssystem) die Zahlung erneut zu belasten versuchen. Sie erhalten eine E-Mail
        bei fehlgeschlagener Zahlung sowie Erinnerungen vor Ablauf der Karenzzeit. Ist die Zahlung
        nach 7 Tagen weiterhin nicht erfolgt, wird der Zugang zu den Kernfunktionen gesperrt, bis
        die Zahlungsmethode aktualisiert und die ausstehende Zahlung erfolgreich verarbeitet
        wurde.
      </p>

      <h2>5. Erstattungsanfragen</h2>
      <Placeholder label="Klären, ob Ron ein kulanzweises Erstattungsfenster (z. B. 14 Tage ab erster Belastung) für echte Abrechnungsfehler/versehentliche Anmeldungen möchte, oder eine strikte Keine-Erstattung-Richtlinie. Aktuell als Einzelfallentscheidung formuliert, da im Code kein Erstattungsmechanismus existiert." />
      <p>
        Außerhalb der oben genannten Fälle werden Erstattungen im Einzelfall geprüft. Wenn Sie der
        Meinung sind, fälschlicherweise belastet worden zu sein — etwa durch eine
        Doppelbelastung oder eine Belastung nach Ihrer Kündigung — kontaktieren Sie uns bitte. Wir
        prüfen den Fall und erstatten bestätigte Abrechnungsfehler vollständig. Keine Erstattung
        erfolgt für ungenutzte Zeit bei einem aktiven, nicht gekündigten Abonnement oder bei
        Unzufriedenheit mit dem Service nach Ablauf der Testphase; passt der Service nicht,
        vermeidet eine Kündigung vor dem nächsten Abrechnungsdatum weitere Kosten.
      </p>

      <h2>6. Rückbuchungen (Chargebacks) und Zahlungsdisputes</h2>
      <p>
        Wenn Sie eine Belastung direkt bei Ihrer Bank oder Ihrem Kartenanbieter anfechten, anstatt
        uns zuerst zu kontaktieren, werden wir automatisch benachrichtigt und Ihr Konto kann
        während der Prüfung markiert werden. Wir lösen Abrechnungsprobleme lieber direkt —
        kontaktieren Sie uns bitte zuerst, damit wir das Problem klären können, ohne Ihre Bank
        einzuschalten.
      </p>

      <h2>7. So beantragen Sie eine Erstattung</h2>
      <Placeholder label="Support-/Abrechnungs-Kontakt-E-Mail, sobald festgelegt (kann dieselbe Adresse wie im Impressum sein)." />
      <p>
        Senden Sie uns eine E-Mail mit Ihrem Konto-/Firmennamen und dem Grund der Anfrage. Wir
        antworten in der Regel innerhalb weniger Werktage.
      </p>

      <div className="legal-footer-links">
        <Link to="/impressum">Impressum</Link>
        <Link to="/privacy">Datenschutzerklärung</Link>
        <Link to="/terms">Terms of Service</Link>
      </div>
    </div>
  );
}
