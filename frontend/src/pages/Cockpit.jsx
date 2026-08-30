import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { API_URL } from '../utils/apiConfig';

const URGENCY_LABEL = {
  critical: { text: 'NOTFALL', color: '#ef4444' },
  urgent: { text: 'DRINGEND', color: '#f97316' },
  unclear: { text: 'AI UNSICHER — DEINE EINSCHÄTZUNG', color: '#a855f7' },
  low: { text: 'NICHT DRINGEND', color: '#22c55e' },
};

// incident.aiUrgency is written only by the legacy web-system callFlow.js
// path (`critical`/`unclear`, never `urgent`) and is always NULL for
// incidents created by the live voice-brain-direct-twilio-poc path, which
// only ever writes `decision`/`ai_confidence` (see realTools.js
// tierToDecision() — the real T0-T3 tier itself isn't persisted). Deriving
// from `decision` instead means every incident gets a real badge instead of
// silently defaulting to "DRINGEND" whenever aiUrgency is unset.
function urgencyKeyFor(incident) {
  if (incident.aiUrgency) return incident.aiUrgency;
  if (incident.decision === 'emergency_dispatch') return 'critical';
  if (incident.decision === 'unclear_escalated' || incident.decision === 'verification_failed') return 'unclear';
  if (incident.decision === 'not_emergency') return 'low';
  return 'unclear';
}

// Override-reason capture (spec 2.3) — the cockpit already recorded WHAT a
// human decided, never WHY it differed from the AI. A human agreeing with
// the AI's own suggested action has nothing to explain, so the reason picker
// only appears when the chosen action actually disagrees with what the AI's
// urgency/decision implied — 'critical' AI urgency implies send_company,
// 'low' implies defer_morning, 'unclear' has no single implied action so no
// disagreement can be detected against it either way.
const AI_IMPLIED_ACTION = { critical: 'send_company', low: 'defer_morning' };
function isOverrideOfAiSuggestion(incident, chosenAction) {
  const implied = AI_IMPLIED_ACTION[urgencyKeyFor(incident)];
  return Boolean(implied) && implied !== chosenAction;
}

const SUGGESTED_ACTION_LABEL = {
  send_company: { text: 'Empfehlung: Dienstleister jetzt schicken', icon: '🚒' },
  defer_morning: { text: 'Empfehlung: kann bis morgen warten', icon: '🌙' },
};

// Relative time ("vor 4 Minuten") reads faster under stress at 3am than a
// clock time, which needs the reader to also know/compute the current time.
// Cockpit UX review, 2026-08-30.
function relativeTimeDe(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Minute${mins === 1 ? '' : 'n'}`;
  const hours = Math.round(mins / 60);
  return `vor ${hours} Stunde${hours === 1 ? '' : 'n'}`;
}

const OVERRIDE_REASON_OPTIONS = [
  { value: 'ai_missed_a_fact', label: 'AI hat eine Tatsache übersehen' },
  { value: 'ai_misjudged_severity', label: 'AI hat die Dringlichkeit falsch eingeschätzt' },
  { value: 'caller_gave_more_info_after_call', label: 'Anrufer gab nach dem Anruf mehr Infos' },
  { value: 'tier_right_tone_off', label: 'Einstufung war richtig, Tonfall daneben' },
  { value: 'other', label: 'Sonstiges' },
];

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
  const [overrideReason, setOverrideReason] = useState('');

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
        body: JSON.stringify({ action, chosenSpId, overrideReason: overrideReason || undefined }),
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

  const { incident, caller, building, history, suggestedAction, suggestedCompany, allCompanies, wakeupAttempts, alreadyDecided } = data;
  const urgencyKey = urgencyKeyFor(incident);
  const urgency = URGENCY_LABEL[urgencyKey] || URGENCY_LABEL.unclear;
  const actionLabel = SUGGESTED_ACTION_LABEL[suggestedAction];
  // Low-confidence/unclear calls are exactly the case where the human needs
  // the raw transcript fastest — don't make them click to open it. Cockpit
  // UX review, 2026-08-30.
  const isLowConfidence = urgencyKey === 'unclear' || (incident.aiConfidence ?? 100) < 50;

  return (
    <Shell>
      <div style={{ ...s.badge, background: urgency.color }}>{urgency.text}</div>
      {urgencyKey === 'unclear' && (
        <p style={s.unclearHint}>
          Die AI konnte die Dringlichkeit nicht sicher einschätzen — bitte Gesprächsverlauf unten lesen und selbst entscheiden.
        </p>
      )}
      {actionLabel && (
        <div style={s.actionBanner}>
          <span style={s.actionIcon}>{actionLabel.icon}</span>
          <span>{actionLabel.text}</span>
        </div>
      )}

      {/* A. What happened */}
      <Section title="Was ist passiert">
        <Row label="Kategorie" value={incident.category?.replace(/_/g, ' ') || '—'} />
        <Row label="AI-Einschätzung" value={`${incident.aiConfidence ?? '?'}% sicher`} />
        {incident.classificationReason && (
          <p style={s.reasonText}>{incident.classificationReason}</p>
        )}
        <Row label="Zeit" value={relativeTimeDe(incident.createdAt)} />
        <p style={s.description}>{incident.description}</p>
        {incident.transcript && (
          <details style={s.details} open={isLowConfidence}>
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
          {AI_IMPLIED_ACTION[urgencyKeyFor(incident)] && (
            <div style={s.overrideReasonBox}>
              <p style={s.sectionSubtitle}>
                Weicht deine Entscheidung von der AI-Einschätzung ab? Grund optional angeben (hilft, die AI zu verbessern):
              </p>
              <select style={s.select} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}>
                <option value="">— kein Grund angegeben —</option>
                {OVERRIDE_REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
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
  actionBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '12px 14px',
    marginBottom: '16px',
    fontSize: '15px',
    fontWeight: 600,
  },
  actionIcon: { fontSize: '20px' },
  unclearHint: {
    fontSize: '14px',
    color: '#e9d5ff',
    background: '#3b0764',
    border: '1px solid #6b21a8',
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '12px',
  },
  reasonText: { fontSize: '13px', color: '#94a3b8', margin: '2px 0 6px', fontStyle: 'italic' },
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
  overrideReasonBox: { marginBottom: '14px' },
  select: {
    width: '100%',
    background: '#0f172a',
    color: '#f1f5f9',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '14px',
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
