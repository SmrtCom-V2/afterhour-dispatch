import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

const LANGUAGE_NAMES = { de: 'German', en: 'English', tr: 'Turkish', ar: 'Arabic', ru: 'Russian', pl: 'Polish' };

export function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language: operatorLanguage } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  // Translation state for the Summary card — separate from the main incident
  // load since it's a distinct, possibly-failing API call that must never
  // block or hide the original summary (see backend route's comment on why
  // failures surface, not silently fall back).
  const [translation, setTranslation] = useState(null); // { translated, targetLanguage } | null
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    loadIncident();
  }, [id]);

  const loadIncident = async () => {
    try {
      const result = await api.getIncident(id);
      setData(result);
    } catch (err) {
      console.error('Failed to load incident:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!confirm('Close this incident?')) return;
    try {
      await api.closeIncident(id, 'Manually closed');
      loadIncident();
    } catch (err) {
      alert('Failed to close incident');
    }
  };

  // Auto-translate the summary when the call happened in a language other
  // than the viewing operator's dashboard language. call_language is the
  // real source of truth (set by the voice gateway from the caller's actual
  // DTMF language selection), not a guess from the text itself. Only DE/EN
  // are real dashboard languages today (see LanguageContext) — a TR/AR/RU/PL
  // call always needs translating for any operator; a DE call only needs it
  // for an EN operator and vice versa.
  useEffect(() => {
    const incident = data?.incident;
    if (!incident) return;
    const callLang = (incident.call_language || 'de').toLowerCase();
    if (callLang === operatorLanguage) {
      setTranslation(null);
      setTranslateError(null);
      return;
    }
    if (!incident.issue_description) return;

    let cancelled = false;
    setTranslating(true);
    setTranslateError(null);
    api.translateIncidentSummary(id, operatorLanguage)
      .then((result) => {
        if (!cancelled) setTranslation(result);
      })
      .catch((err) => {
        if (!cancelled) setTranslateError(err.message || 'Translation failed');
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });
    return () => { cancelled = true; };
  }, [data?.incident?.id, data?.incident?.call_language, operatorLanguage]);

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  // Determine current responsibility state
  const getResponsibilityState = (incident, dispatchAttempts, spReport) => {
    if (['closed', 'sp_completed'].includes(incident.status)) {
      return { label: 'RESOLVED', class: 'resolved' };
    }
    if (spReport?.status === 'missing') {
      return { label: 'SP REPORT OVERDUE', class: 'alert' };
    }
    if (incident.status === 'sp_accepted') {
      return { label: 'SP RESPONSIBLE', class: 'pending' };
    }
    if (incident.status === 'sp_dispatched') {
      return { label: 'AWAITING SP RESPONSE', class: 'pending' };
    }
    if (incident.status === 'escalated_fm') {
      return { label: 'ESCALATED TO FM', class: 'alert' };
    }
    return { label: 'OPEN', class: 'open' };
  };

  // Format timeline event with actor information
  const formatTimelineEvent = (event) => {
    // event_data is a Postgres JSONB column — the backend's pg driver
    // already deserializes it before res.json() sends the response, so it
    // arrives here as a plain object, not a JSON string. JSON.parse on an
    // already-parsed object throws (toString() -> "[object Object]" ->
    // invalid JSON), crashing this render for every event with any data.
    const eventData = event.event_data || {};
    const type = event.event_type;

    const eventDescriptions = {
      call_received: 'Call received from tenant',
      tenant_verified: `Tenant verified: ${eventData.method || 'system'}`,
      tenant_verification_failed: 'Tenant verification failed',
      ai_classified: `AI classified as ${eventData.is_emergency ? 'EMERGENCY' : 'non-emergency'} (${eventData.confidence}% confidence)`,
      hard_rule_applied: `Hard rule applied: ${eventData.rule || 'emergency category'}`,
      sp_dispatch_started: 'SP dispatch initiated',
      sp_call_initiated: `Calling SP: ${eventData.spName || 'Unknown'}`,
      sp_called: `Called SP: ${eventData.sp_name || 'Unknown'}`,
      sp_call_no_answer: `SP did not answer: ${eventData.sp_name || 'Unknown'}`,
      sp_sms_sent: `SMS sent to SP: ${eventData.spName || eventData.sp_name || 'Unknown'}`,
      sp_accepted: `SP accepted: ${eventData.sp_name || 'Unknown'}`,
      sp_declined: `SP declined: ${eventData.spName || eventData.sp_name || 'Unknown'}`,
      sp_no_response: `SP did not respond: ${eventData.spName || eventData.sp_name || 'Unknown'}`,
      all_sp_unavailable: 'All service providers unavailable — escalating to facility manager',
      no_sp_available: 'No service provider configured for this building/trade — nobody could be dispatched',
      escalated_fm: 'Escalated to FM on-call',
      escalated_to_fm: `Escalated to facility manager${eventData.fmName ? ` — called ${eventData.fmName}` : ''}${eventData.fmPhone ? ` (${eventData.fmPhone})` : ''}`,
      report_link_sent: 'Report link sent to SP',
      report_submitted: 'SP report submitted',
      report_deadline_missed: 'Report deadline missed (9 AM)',
      report_missing: 'Follow-up report overdue',
      manually_closed: `Manually closed by ${eventData.closed_by || 'operator'}`,
      'wakeup.failsafe_triggered': `Nobody responded within the wake-up window — auto-escalated${eventData.requiredTrade ? ` (looking for: ${eventData.requiredTrade})` : ''}`,
      'cockpit.decision': `Decision made: ${(eventData.action || '').replace(/_/g, ' ') || 'decision recorded'}`,
      'cockpit.outcome': `Outcome recorded: ${(eventData.outcome || '').replace(/_/g, ' ') || 'outcome recorded'}`,
      'cockpit.codes_viewed': 'Building access codes viewed',
      'owner_visit_report.submitted': 'On-site report submitted',
      'notification.attempt': `Called ${eventData.recipient || 'on-call'} via ${(eventData.channel || '').replace(/_/g, ' ')}${eventData.purpose ? ` (${eventData.purpose.replace(/_/g, ' ')})` : ''} — ${eventData.result || 'pending'}`,
      created_by_voice_gateway: 'Incident created from tenant phone call',
      // The AI phone system calls back into an already-open incident as the
      // caller gives more detail (e.g. answering a clarifying question) —
      // each of these updates issue_description with a fresh summary, not a
      // new problem. Previously fell through to the generic type.replace()
      // fallback, showing the literal event type ("voice gateway followup
      // call") once per call-back with no content — read as meaningless
      // repeated noise. Surface the actual updated summary instead.
      'voice_gateway.followup_call': eventData.issueDescription
        ? `Caller follow-up — updated report: "${eventData.issueDescription}"`
        : 'Caller follow-up call',
    };

    return eventDescriptions[type] || (type ? type.replace(/_/g, ' ') : 'Unknown event');
  };

  // Top-line "what happened" — a single readable sentence built from data
  // that's already on the incident (created_at, decision_at, decided_by_person)
  // plus the last relevant timeline event (who was actually notified/dispatched),
  // instead of making an operator piece it together from raw event rows.
  const buildOutcomeSummary = (incident, timeline) => {
    const parts = [`Call in at ${formatTime(incident.created_at)}`];

    const lastEscalation = [...timeline].reverse().find(
      (e) => e.event_type === 'escalated_to_fm' || e.event_type === 'notification.attempt'
    );
    const spAccepted = [...timeline].reverse().find((e) => e.event_type === 'sp_accepted');

    if (spAccepted) {
      parts.push(`dispatched to ${spAccepted.event_data?.sp_name || 'service provider'} at ${formatTime(spAccepted.created_at)}`);
    } else if (incident.no_sp_available_at) {
      parts.push(`no service provider available at ${formatTime(incident.no_sp_available_at)}`);
      if (lastEscalation) {
        const who = lastEscalation.event_data?.fmName || lastEscalation.event_data?.recipient || 'on-call';
        const phone = lastEscalation.event_data?.fmPhone;
        parts.push(`escalated to ${who}${phone ? ` (${phone})` : ''} at ${formatTime(lastEscalation.created_at)}`);
      }
    } else if (incident.status === 'sp_dispatched') {
      parts.push('awaiting service provider response');
    }

    if (incident.decided_by_person === 'failsafe') {
      parts.push('— nobody responded in time, auto-escalated by the failsafe, not a human decision');
    } else if (incident.decided_by_person) {
      parts.push(`— decision made by ${incident.decided_by_person}`);
    }

    return parts.join(', ').replace(', —', ' —');
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!data) return <div className="error-message">Incident not found</div>;

  const { incident, timeline, dispatchAttempts, spReport } = data;
  const responsibility = getResponsibilityState(incident, dispatchAttempts, spReport);

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/incidents')}>
          Back to incidents
        </button>
      </div>

      {/* Header with Current State */}
      <div className="page-header-modern" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h1 className="page-title">{incident.building_name || 'Unknown Building'}</h1>
          <div className="page-subtitle">{incident.building_address}</div>
        </div>
        <div className={`current-state-box ${responsibility.class === 'alert' ? 'alert' : ''}`}>
          <div className="current-state-label">Current State</div>
          <div className={`current-state-value ${responsibility.class}`}>{responsibility.label}</div>
        </div>
      </div>
      <div className="flex items-center gap-4 mb-6">
        {incident.is_emergency ? (
          <span className="badge badge-emergency">EMERGENCY</span>
        ) : (
          <span className="badge badge-muted">Non-Emergency</span>
        )}
        <span className="text-sm text-secondary">
          AI Confidence: <span className={`confidence ${incident.ai_confidence >= 80 ? 'high' : 'low'}`}>
            {incident.ai_confidence}%
          </span>
        </span>
        <span className="text-sm text-muted">
          Created: {formatDateTime(incident.created_at)}
        </span>
      </div>

      {/* What Happened — one-line readable outcome (call time -> dispatch/
          escalation -> who), built from data already on the incident/timeline
          but previously left for the operator to reconstruct from raw event
          rows. This is the first thing read on the page, above the summary. */}
      <div className="card mb-6" style={{ borderLeft: '3px solid var(--color-primary, #1E40AF)' }}>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <div className="text-xs text-muted mb-4">What Happened</div>
          <p style={{ margin: 0, lineHeight: 1.6, fontWeight: 500 }}>{buildOutcomeSummary(incident, timeline)}</p>
        </div>
      </div>

      {/* Summary — the human-readable "what happened", not raw category tags.
          issue_description is the AI's own written summary from the call
          (e.g. "Tenant Ronald, Hauptstraße 10, reports a heating outage..."),
          already stored on every incident but previously never shown on this
          page at all — only the category chip and a raw audit log were
          visible, which is not enough to understand a case at a glance.

          Translation: this is a factual record of a real tenant call, so the
          translated text is shown as primary (what the operator reads first
          and acts on) but the original is always one click away, never
          hidden — the operator must be able to verify the exact source
          wording of a safety-relevant report, not just trust a black-box
          translation. Loading and error states never block or hide the
          original: if translation is in flight or fails, the original is
          shown immediately either way. */}
      {incident.issue_description && (
        <div className="card mb-6">
          <div className="card-header"><span className="card-title">Summary</span></div>
          <div className="card-body">
            {translating ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="skeleton-line" style={{ height: 14, width: '95%', background: 'var(--color-bg-hover)', borderRadius: 4 }} />
                <div className="skeleton-line" style={{ height: 14, width: '80%', background: 'var(--color-bg-hover)', borderRadius: 4 }} />
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                  Translating from {LANGUAGE_NAMES[(incident.call_language || 'de').toLowerCase()] || incident.call_language}…
                </div>
              </div>
            ) : translation && !showOriginal ? (
              <>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{translation.translated}</p>
                <div className="text-xs text-muted" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span title="Machine-translated from the original call language — verify against the original for anything safety-critical.">
                    Translated from {LANGUAGE_NAMES[(incident.call_language || 'de').toLowerCase()] || incident.call_language}
                  </span>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setShowOriginal(true)}
                    className="text-xs"
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary, #1E40AF)', textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    View original
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{incident.issue_description}</p>
                {translation && showOriginal && (
                  <div className="text-xs text-muted" style={{ marginTop: 8 }}>
                    Original ({LANGUAGE_NAMES[(incident.call_language || 'de').toLowerCase()] || incident.call_language}) ·{' '}
                    <button
                      type="button"
                      onClick={() => setShowOriginal(false)}
                      className="text-xs"
                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary, #1E40AF)', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      View translation
                    </button>
                  </div>
                )}
                {translateError && !translation && (
                  <div className="text-xs text-warning" style={{ marginTop: 8 }} title={translateError}>
                    Translation unavailable — showing original ({LANGUAGE_NAMES[(incident.call_language || 'de').toLowerCase()] || incident.call_language}).
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {!['closed', 'sp_completed'].includes(incident.status) && (
        <div className="page-actions" style={{ marginTop: 0, marginBottom: 24 }}>
          <button className="btn btn-danger btn-sm" onClick={handleClose}>
            Close incident
          </button>
        </div>
      )}

      {/* Three column layout: Tenant | Issue | Classification */}
      <div className="incident-info-grid">
        <div className="card">
          <div className="card-header"><span className="card-title">Caller / Tenant</span></div>
          <div className="card-body">
            <table className="info-table">
              <tbody>
                <tr><td>Name</td><td>{incident.tenant_name_given || '-'}</td></tr>
                <tr><td>Phone</td><td>{incident.tenant_phone_given || '-'}</td></tr>
                <tr><td>Unit</td><td>{incident.tenant_unit_given || '-'}</td></tr>
                <tr>
                  <td title="Whether the caller's spoken name and address matched a real tenant on file for this building.">
                    Verified <span className="text-muted" style={{ fontWeight: 'normal' }}>(name + address match)</span>
                  </td>
                  <td>
                    {incident.verification_status === 'verified' ? (
                      <span className="text-success" title="Caller's name and address matched a tenant on file.">Yes</span>
                    ) : incident.verification_status === 'failed' ? (
                      <span className="text-danger" title="Caller's name and/or address did not match any tenant on file. The FM on-call was notified to call back and assess.">Failed</span>
                    ) : incident.verification_status === 'partial_match' ? (
                      <span className="text-muted" title="Caller's name matched, but address verification was not completed (call ended before it finished).">Partial</span>
                    ) : (
                      <span className="text-muted" title="Verification has not completed yet, or this incident was created without a phone call (e.g. manual entry).">
                        {incident.verification_status || 'Pending'}
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Issue Details</span></div>
          <div className="card-body">
            <table className="info-table">
              <tbody>
                <tr><td>Category</td><td>{incident.issue_category?.replace(/_/g, ' ') || '-'}</td></tr>
                <tr><td>Decision</td><td>{incident.decision?.replace(/_/g, ' ') || '-'}</td></tr>
              </tbody>
            </table>
            {incident.guided_answers && (
              <div style={{ marginTop: 16 }}>
                <div className="text-xs text-muted mb-4">Guided Questions</div>
                <div className="text-xs" style={{ background: 'var(--color-bg-hover)', borderRadius: 'var(--radius-md)', padding: 8, fontFamily: 'var(--font-mono)' }}>
                  {Object.entries(incident.guided_answers).map(([q, a]) => {
                    // Each answer is {value, status, turn} (voiceBrain.js's slot
                    // shape), not a primitive — rendering `a` directly threw
                    // React error #31 ("Objects are not valid as a React
                    // child"), found live 2026-08-21 opening a real incident
                    // for the first time since the goal-driven DIAGNOSE engine
                    // started populating this shape.
                    const value = a && typeof a === 'object' ? a.value : a;
                    const display = value === null || value === undefined || value === ''
                      ? (a && a.status === 'unknown' ? '(caller did not know)' : '-')
                      : String(value);
                    return <div key={q}>{q}: {display}</div>;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">AI Classification</span></div>
          <div className="card-body">
            <table className="info-table">
              <tbody>
                <tr><td>Result</td><td style={{ fontWeight: 600 }}>{incident.is_emergency ? 'EMERGENCY' : 'Non-Emergency'}</td></tr>
                <tr><td>Confidence</td><td>{incident.ai_confidence}%</td></tr>
                <tr><td>Reason</td><td>{incident.classification_reason || '-'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dispatch Attempts Table */}
      {dispatchAttempts && dispatchAttempts.length > 0 && (
        <div className="card mb-6">
          <div className="card-header"><span className="card-title">Dispatch Attempts</span></div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Service Provider</th>
                  <th>Phone</th>
                  <th>Method</th>
                  <th>Time</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {dispatchAttempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{attempt.attempt_number}</td>
                    <td>{attempt.company_name}</td>
                    <td>{attempt.sp_phone}</td>
                    <td>{attempt.method === 'call' ? 'Phone Call' : 'SMS'}</td>
                    <td>{formatTime(attempt.created_at)}</td>
                    <td>
                      {attempt.result === 'accepted' ? (
                        <span className="text-success font-medium">Accepted</span>
                      ) : attempt.result === 'declined' ? (
                        <span className="text-danger">Declined</span>
                      ) : attempt.result === 'no_answer' ? (
                        <span className="text-muted">No Answer</span>
                      ) : attempt.result === 'timeout' ? (
                        <span className="text-muted">Timeout</span>
                      ) : (
                        <span>{attempt.result || 'Pending'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeline - Audit Trail */}
      <div className="card mb-6">
        <div className="card-header"><span className="card-title">Audit Trail</span></div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Time</th>
                <th>Event</th>
              </tr>
            </thead>
            <tbody>
              {timeline.length === 0 ? (
                <tr><td colSpan={2} className="text-muted">No events recorded</td></tr>
              ) : (
                timeline.map((event, i) => (
                  <tr key={i}>
                    <td className="text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{formatDateTime(event.created_at)}</td>
                    <td>{formatTimelineEvent(event)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SP Report */}
      {spReport && (
        <div className="card mb-6">
          <div className="card-header"><span className="card-title">Service Provider Report</span></div>
          <div className="card-body">
            <div className="flex gap-4 mb-6" style={{ gap: 32 }}>
              <div>
                <span className="text-xs text-muted">Status: </span>
                {spReport.status === 'submitted' ? (
                  <span className="text-success font-medium">Submitted</span>
                ) : spReport.status === 'missing' ? (
                  <span className="text-danger font-medium">MISSING - DEADLINE PASSED</span>
                ) : (
                  <span className="text-warning font-medium">Pending</span>
                )}
              </div>
              {spReport.finish_time && (
                <div>
                  <span className="text-xs text-muted">Completed: </span>
                  {formatDateTime(spReport.finish_time)}
                </div>
              )}
              <div>
                <span className="text-xs text-muted">Deadline: </span>
                9:00 AM
              </div>
            </div>
            {spReport.description && (
              <div className="mb-6">
                <div className="text-xs text-muted mb-4">Work Description</div>
                <div style={{ background: 'var(--color-bg-hover)', borderRadius: 'var(--radius-md)', padding: 12 }}>{spReport.description}</div>
              </div>
            )}
            {spReport.attachments && spReport.attachments.length > 0 && (
              <div>
                <div className="text-xs text-muted mb-4">Photos ({spReport.attachments.length})</div>
                <div className="photo-grid">
                  {spReport.attachments.map((att, i) => (
                    <img key={i} src={att.file_path} alt={att.file_name} className="photo-thumbnail" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
