import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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
      all_sp_unavailable: 'All SPs unavailable - escalating',
      no_sp_available: 'No service provider was available',
      escalated_fm: 'Escalated to FM on-call',
      escalated_to_fm: 'Escalated to facility manager',
      report_link_sent: 'Report link sent to SP',
      report_submitted: 'SP report submitted',
      report_deadline_missed: 'Report deadline missed (9 AM)',
      report_missing: 'Follow-up report overdue',
      manually_closed: `Manually closed by ${eventData.closed_by || 'operator'}`,
      'wakeup.failsafe_triggered': 'Nobody responded — auto-dispatched',
      'cockpit.decision': `Decision made: ${(eventData.action || '').replace(/_/g, ' ') || 'decision recorded'}`,
      'cockpit.outcome': `Outcome recorded: ${(eventData.outcome || '').replace(/_/g, ' ') || 'outcome recorded'}`,
      'cockpit.codes_viewed': 'Building access codes viewed',
      'owner_visit_report.submitted': 'On-site report submitted',
    };

    return eventDescriptions[type] || (type ? type.replace(/_/g, ' ') : 'Unknown event');
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
                  {Object.entries(incident.guided_answers).map(([q, a]) => (
                    <div key={q}>{q}: {a}</div>
                  ))}
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
