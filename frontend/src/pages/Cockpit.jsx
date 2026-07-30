import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const URGENCY_LABEL = {
  critical: { text: 'NOTFALL', color: '#ef4444' },
  urgent: { text: 'DRINGEND', color: '#f97316' },
  unclear: { text: 'AI UNSICHER — DEINE EINSCHÄTZUNG', color: '#a855f7' },
};

/**
 * Decision Cockpit — Night Ops HITL, NIGHT_OPS_MASTER_PLAN.md §4.3.
 * Mobile-first, dark by default, large tap targets: built to be opened
 * one-handed at 3am from an SMS link. No login — the token is the auth.
 */
export function Cockpit() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionResult, setActionResult] = useState(null);
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const [chosenSpId, setChosenSpId] = useState(null);
  const [outcomeNote, setOutcomeNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/cockpit/${token}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error === 'expired' ? 'Dieser Link ist abgelaufen.' : 'Vorfall nicht gefunden.');
        return;
      }
      setData(json);
      setChosenSpId(json.suggestedCompany?.id || null);
    } catch (err) {
      setError('Verbindung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    // Auto-refresh so if the backup decider already acted, this screen
    // shows it without the primary having to reload.
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const decide = async (action) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/cockpit/${token}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, chosenSpId }),
      });
      const json = await res.json();
      if (res.status === 409) {
        setActionResult({ type: 'already_decided', ...json });
      } else if (res.ok) {
        setActionResult({ type: 'success', ...json });
      } else {
        setActionResult({ type: 'error' });
      }
      await load();
    } catch (err) {
      setActionResult({ type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const submitOutcome = async (outcome) => {
    setBusy(true);
    try {
      await fetch(`${API_URL}/cockpit/${token}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, note: outcomeNote }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Shell><Centered>Lädt…</Centered></Shell>;
  if (error) return <Shell><Centered><p style={s.errorText}>{error}</p></Centered></Shell>;
  if (!data) return null;

  const { incident, caller, building, history, suggestedCompany, allCompanies, wakeupAttempts, alreadyDecided } = data;
  const urgency = URGENCY_LABEL[incident.aiUrgency] || URGENCY_LABEL.urgent;

  return (
    <Shell>
      <div style={{ ...s.badge, background: urgency.color }}>{urgency.text}</div>

      {/* A. What happened */}
      <Section title="Was ist passiert">
        <Row label="Kategorie" value={incident.category?.replace(/_/g, ' ') || '—'} />
        <Row label="AI-Einschätzung" value={`${incident.aiConfidence ?? '?'}% sicher`} />
        <Row label="Zeit" value={new Date(incident.createdAt).toLocaleTimeString('de-DE')} />
        <p style={s.description}>{incident.description}</p>
        {incident.transcript && (
          <details style={s.details}>
            <summary>Gesprächsverlauf</summary>
            <p style={s.transcript}>{incident.transcript}</p>
          </details>
        )}
      </Section>

      {/* B. Where */}
      <Section title="Wo">
        <Row label="Objekt" value={building.name || '—'} />
        <Row label="Adresse" value={building.address || '—'} />
        {caller.phone && (
          <a href={`tel:${caller.phone}`} style={s.callButton}>
            📞 Mieter anrufen {caller.name ? `(${caller.name})` : ''}
          </a>
        )}
        {(building.gateCode || building.mainEntranceCode || building.keySafeCode) && (
          <p style={s.forwardWarning}>
            ⚠️ Enthält Zugangscodes — diesen Link nicht weiterleiten.
          </p>
        )}
        <div style={s.accessGrid}>
          <AccessItem label="Wasserhaupthahn" value={building.waterShutoff} />
          <AccessItem label="Gashaupthahn" value={building.gasShutoff} />
          <AccessItem label="Stromkasten" value={building.electricShutoff} />
          <AccessItem label="Schlüsseltresor" value={building.keySafeLocation} />
          <AccessItem label="Hoftor-Code" value={building.gateCode} />
          <AccessItem label="Hauseingang-Code" value={building.mainEntranceCode} />
        </div>
        {building.specialAccessInstructions && (
          <p style={s.note}>{building.specialAccessInstructions}</p>
        )}
        {building.janitorPhone && (
          <a href={`tel:${building.janitorPhone}`} style={s.secondaryLink}>
            🔑 Hausmeister: {building.janitorName || ''} {building.janitorPhone}
          </a>
        )}
      </Section>

      {/* C. History */}
      {history?.length > 0 && (
        <Section title="Verlauf an diesem Objekt">
          {history.map((h) => (
            <Row
              key={h.id}
              label={new Date(h.created_at).toLocaleDateString('de-DE')}
              value={h.issue_category?.replace(/_/g, ' ')}
            />
          ))}
        </Section>
      )}

      {wakeupAttempts?.length > 1 && (
        <Section title="Bereits kontaktiert">
          {wakeupAttempts.map((w, i) => (
            <Row key={i} label={w.stage} value={`${w.channel} — ${w.result}`} />
          ))}
        </Section>
      )}

      {/* D. Suggested company */}
      <Section title="Empfohlener Dienstleister">
        {suggestedCompany ? (
          <div style={s.spCard}>
            <strong>{suggestedCompany.company_name}</strong>
            <span style={s.spTrade}>{suggestedCompany.trade}</span>
            <span>{suggestedCompany.phone}</span>
          </div>
        ) : (
          <p style={s.note}>Kein Dienstleister für dieses Gewerk hinterlegt.</p>
        )}
        <button style={s.linkButton} onClick={() => setShowAllCompanies((v) => !v)}>
          {showAllCompanies ? 'Liste ausblenden' : 'Alle Dienstleister anzeigen'}
        </button>
        {showAllCompanies && (
          <div style={s.spList}>
            {allCompanies.map((sp) => (
              <label key={sp.id} style={s.spOption}>
                <input
                  type="radio"
                  name="sp"
                  checked={chosenSpId === sp.id}
                  onChange={() => setChosenSpId(sp.id)}
                />
                {sp.company_name} ({sp.trade}) — {sp.phone}
              </label>
            ))}
          </div>
        )}
      </Section>

      {/* E. Decision buttons */}
      {alreadyDecided || actionResult?.type === 'success' || actionResult?.type === 'already_decided' ? (
        <DecisionBanner incident={incident} actionResult={actionResult} onSubmitOutcome={submitOutcome} note={outcomeNote} setNote={setOutcomeNote} busy={busy} />
      ) : (
        <Section title="Entscheidung">
          <button disabled={busy} style={{ ...s.decisionButton, background: '#16a34a' }} onClick={() => decide('send_company')}>
            🚒 Dienstleister schicken
          </button>
          <button disabled={busy} style={{ ...s.decisionButton, background: '#2563eb' }} onClick={() => decide('owner_on_site')}>
            🚗 Ich fahre selbst hin
          </button>
          <button disabled={busy} style={{ ...s.decisionButton, background: '#64748b' }} onClick={() => decide('defer_morning')}>
            🌙 Kann bis morgen warten
          </button>
        </Section>
      )}
    </Shell>
  );
}

function DecisionBanner({ incident, actionResult, onSubmitOutcome, note, setNote, busy }) {
  const decidedBy = actionResult?.decidedByPerson || incident.decidedByPerson;
  const outcome = actionResult?.nightOutcome || incident.nightOutcome;

  if (incident.nightOutcome === 'stabilized_pending_repair' || incident.nightOutcome === 'resolved_night') {
    return (
      <Section title="Erledigt">
        <p>Status: {incident.nightOutcome === 'resolved_night' ? 'Heute Nacht vollständig gelöst' : 'Stabilisiert, Reparatur morgen'}</p>
      </Section>
    );
  }

  return (
    <Section title="Entscheidung getroffen">
      <p>{decidedBy ? `Bereits bearbeitet von ${decidedBy}.` : 'Bereits bearbeitet.'}</p>
      <p style={s.note}>Ergebnis: {outcome || '—'}</p>
      {outcome === 'dispatched' && (
        <>
          <p style={s.sectionSubtitle}>Ergebnis der Nacht festhalten:</p>
          <textarea
            style={s.textarea}
            placeholder="Notiz (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button disabled={busy} style={{ ...s.decisionButton, background: '#16a34a' }} onClick={() => onSubmitOutcome('stabilized_pending_repair')}>
            Stabilisiert — Reparatur morgen
          </button>
          <button disabled={busy} style={{ ...s.decisionButton, background: '#2563eb' }} onClick={() => onSubmitOutcome('resolved_night')}>
            Heute Nacht vollständig gelöst
          </button>
        </>
      )}
    </Section>
  );
}

function Shell({ children }) {
  return <div style={s.shell}>{children}</div>;
}
function Centered({ children }) {
  return <div style={s.centered}>{children}</div>;
}
function Section({ title, children }) {
  return (
    <div style={s.section}>
      <h2 style={s.sectionTitle}>{title}</h2>
      {children}
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowValue}>{value}</span>
    </div>
  );
}
function AccessItem({ label, value }) {
  if (!value) return null;
  return (
    <div style={s.accessItem}>
      <span style={s.accessLabel}>{label}</span>
      <span style={s.accessValue}>{value}</span>
    </div>
  );
}

const s = {
  shell: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#f1f5f9',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '16px',
    maxWidth: '600px',
    margin: '0 auto',
  },
  centered: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', fontSize: '18px' },
  errorText: { color: '#f87171' },
  badge: {
    padding: '12px 16px',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '18px',
    textAlign: 'center',
    marginBottom: '16px',
    color: '#fff',
  },
  section: {
    background: '#1e293b',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
  },
  sectionTitle: { fontSize: '14px', textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 12px 0', letterSpacing: '0.05em' },
  sectionSubtitle: { fontSize: '14px', color: '#cbd5e1', margin: '12px 0 8px' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #334155', fontSize: '15px' },
  rowLabel: { color: '#94a3b8' },
  rowValue: { fontWeight: 600, textAlign: 'right' },
  description: { fontSize: '16px', lineHeight: 1.5, margin: '12px 0 0' },
  details: { marginTop: '10px', fontSize: '14px', color: '#94a3b8' },
  transcript: { whiteSpace: 'pre-wrap', fontSize: '13px', color: '#cbd5e1' },
  callButton: {
    display: 'block',
    background: '#334155',
    color: '#fff',
    textDecoration: 'none',
    padding: '14px',
    borderRadius: '8px',
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: 600,
    margin: '12px 0',
  },
  accessGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' },
  accessItem: { background: '#0f172a', padding: '8px 10px', borderRadius: '6px' },
  accessLabel: { display: 'block', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' },
  accessValue: { fontSize: '15px', fontWeight: 600 },
  note: { fontSize: '14px', color: '#fbbf24', marginTop: '10px' },
  forwardWarning: {
    fontSize: '13px',
    color: '#fca5a5',
    background: '#450a0a',
    border: '1px solid #7f1d1d',
    borderRadius: '6px',
    padding: '8px 10px',
    marginTop: '10px',
    marginBottom: '4px',
  },
  secondaryLink: { display: 'block', color: '#60a5fa', textDecoration: 'none', marginTop: '10px', fontSize: '15px' },
  spCard: { display: 'flex', flexDirection: 'column', gap: '4px', background: '#0f172a', padding: '12px', borderRadius: '8px', fontSize: '16px' },
  spTrade: { fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase' },
  linkButton: { background: 'none', border: 'none', color: '#60a5fa', fontSize: '14px', padding: '10px 0', cursor: 'pointer' },
  spList: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' },
  spOption: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', background: '#0f172a', padding: '10px', borderRadius: '6px' },
  decisionButton: {
    display: 'block',
    width: '100%',
    border: 'none',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    padding: '18px',
    borderRadius: '10px',
    marginBottom: '10px',
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    minHeight: '60px',
    background: '#0f172a',
    color: '#f1f5f9',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '14px',
    marginBottom: '10px',
    boxSizing: 'border-box',
  },
};
