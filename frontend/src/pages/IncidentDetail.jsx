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
    const eventData = event.event_data ? JSON.parse(event.event_data) : {};
    const type = event.event_type;

    const eventDescriptions = {
      call_received: 'Call received from tenant',
      tenant_verified: `Tenant verified: ${eventData.method || 'system'}`,
      tenant_verification_failed: 'Tenant verification failed',
      ai_classified: `AI classified as ${eventData.is_emergency ? 'EMERGENCY' : 'non-emergency'} (${eventData.confidence}% confidence)`,
      hard_rule_applied: `Hard rule applied: ${eventData.rule || 'emergency category'}`,
      sp_dispatch_started: 'SP dispatch initiated',
      sp_called: `Called SP: ${eventData.sp_name || 'Unknown'}`,
      sp_call_no_answer: `SP did not answer: ${eventData.sp_name || 'Unknown'}`,
      sp_sms_sent: `SMS sent to SP: ${eventData.sp_name || 'Unknown'}`,
      sp_accepted: `SP accepted: ${eventData.sp_name || 'Unknown'}`,
      sp_declined: `SP declined: ${eventData.sp_name || 'Unknown'}`,
      all_sp_unavailable: 'All SPs unavailable - escalating',
      escalated_fm: 'Escalated to FM on-call',
      report_link_sent: 'Report link sent to SP',
      report_submitted: 'SP report submitted',
      report_deadline_missed: 'Report deadline missed (9 AM)',
      manually_closed: `Manually closed by ${eventData.closed_by || 'operator'}`,
    };

    return eventDescriptions[type] || type.replace(/_/g, ' ');
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!data) return <div className="error-message">Incident not found</div>;

  const { incident, timeline, dispatchAttempts, spReport } = data;
  const responsibility = getResponsibilityState(incident, dispatchAttempts, spReport);

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-secondary btn-small" onClick={() => navigate('/incidents')}>
          Back to incidents
        </button>
      </div>

      {/* Header with Current State */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">{incident.building_name || 'Unknown Building'}</h1>
            <div style={{ color: '#666' }}>{incident.building_address}</div>
          </div>
          {/* Current Responsibility Box */}
          <div style={{
            padding: '12px 20px',
            border: responsibility.class === 'alert' ? '2px solid #C00000' : '1px solid #E5E5E5',
            background: responsibility.class === 'alert' ? '#FFF5F5' : '#F9F9F9',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>CURRENT STATE</div>
            <div style={{
              fontWeight: 600,
              color: responsibility.class === 'alert' ? '#C00000' :
                     responsibility.class === 'resolved' ? '#00A000' : '#000'
            }}>
              {responsibility.label}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 24 }}>
          {incident.is_emergency ? (
            <span className="badge badge-emergency">EMERGENCY</span>
          ) : (
            <span className="badge badge-muted">Non-Emergency</span>
          )}
          <span>
            AI Confidence: <span className={`confidence ${incident.ai_confidence >= 80 ? 'high' : 'low'}`}>
              {incident.ai_confidence}%
            </span>
          </span>
          <span style={{ color: '#666' }}>
            Created: {formatDateTime(incident.created_at)}
          </span>
        </div>
      </div>

      {/* Actions */}
      {!['closed', 'sp_completed'].includes(incident.status) && (
        <div className="actions-row">
          <button className="btn btn-danger btn-small" onClick={handleClose}>
            Close incident
          </button>
        </div>
      )}

      {/* Three column layout: Tenant | Issue | Classification */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Tenant Info */}
        <div style={{ borderRight: '1px solid #E5E5E5', paddingRight: 24 }}>
          <h3 style={{ marginBottom: 16, fontSize: 14, textTransform: 'uppercase', color: '#666' }}>Caller / Tenant</h3>
          <table style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              <tr><td style={{ color: '#666', padding: '4px 0', width: 80 }}>Name</td><td style={{ padding: '4px 0' }}>{incident.tenant_name_given || '-'}</td></tr>
              <tr><td style={{ color: '#666', padding: '4px 0' }}>Phone</td><td style={{ padding: '4px 0' }}>{incident.tenant_phone_given || '-'}</td></tr>
              <tr><td style={{ color: '#666', padding: '4px 0' }}>Unit</td><td style={{ padding: '4px 0' }}>{incident.tenant_unit_given || '-'}</td></tr>
              <tr>
                <td style={{ color: '#666', padding: '4px 0' }}>Verified</td>
                <td style={{ padding: '4px 0' }}>
                  {incident.verification_status === 'verified' ? (
                    <span style={{ color: '#00A000' }}>Yes</span>
                  ) : incident.verification_status === 'failed' ? (
                    <span style={{ color: '#C00000' }}>Failed</span>
                  ) : (
                    <span style={{ color: '#666' }}>{incident.verification_status || '-'}</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Issue Details */}
        <div style={{ borderRight: '1px solid #E5E5E5', paddingRight: 24 }}>
          <h3 style={{ marginBottom: 16, fontSize: 14, textTransform: 'uppercase', color: '#666' }}>Issue Details</h3>
          <table style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              <tr><td style={{ color: '#666', padding: '4px 0', width: 80 }}>Category</td><td style={{ padding: '4px 0' }}>{incident.issue_category?.replace(/_/g, ' ') || '-'}</td></tr>
              <tr><td style={{ color: '#666', padding: '4px 0' }}>Decision</td><td style={{ padding: '4px 0' }}>{incident.decision?.replace(/_/g, ' ') || '-'}</td></tr>
            </tbody>
          </table>
          {incident.guided_answers && (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Guided Questions</div>
              <div style={{ fontSize: 12, background: '#f5f5f5', padding: 8, fontFamily: 'monospace' }}>
                {Object.entries(incident.guided_answers).map(([q, a]) => (
                  <div key={q}>{q}: {a}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Classification */}
        <div>
          <h3 style={{ marginBottom: 16, fontSize: 14, textTransform: 'uppercase', color: '#666' }}>AI Classification</h3>
          <table style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              <tr><td style={{ color: '#666', padding: '4px 0', width: 80 }}>Result</td><td style={{ padding: '4px 0', fontWeight: 600 }}>{incident.is_emergency ? 'EMERGENCY' : 'Non-Emergency'}</td></tr>
              <tr><td style={{ color: '#666', padding: '4px 0' }}>Confidence</td><td style={{ padding: '4px 0' }}>{incident.ai_confidence}%</td></tr>
              <tr><td style={{ color: '#666', padding: '4px 0' }}>Reason</td><td style={{ padding: '4px 0' }}>{incident.classification_reason || '-'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch Attempts Table */}
      {dispatchAttempts && dispatchAttempts.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 16, fontSize: 14, textTransform: 'uppercase', color: '#666' }}>Dispatch Attempts</h3>
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
                      <span style={{ color: '#00A000', fontWeight: 500 }}>Accepted</span>
                    ) : attempt.result === 'declined' ? (
                      <span style={{ color: '#C00000' }}>Declined</span>
                    ) : attempt.result === 'no_answer' ? (
                      <span style={{ color: '#666' }}>No Answer</span>
                    ) : attempt.result === 'timeout' ? (
                      <span style={{ color: '#666' }}>Timeout</span>
                    ) : (
                      <span>{attempt.result || 'Pending'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Timeline - Audit Trail */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 16, fontSize: 14, textTransform: 'uppercase', color: '#666' }}>Audit Trail</h3>
        <table>
          <thead>
            <tr>
              <th style={{ width: 140 }}>Time</th>
              <th>Event</th>
            </tr>
          </thead>
          <tbody>
            {timeline.length === 0 ? (
              <tr><td colSpan={2} style={{ color: '#666' }}>No events recorded</td></tr>
            ) : (
              timeline.map((event, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{formatDateTime(event.created_at)}</td>
                  <td>{formatTimelineEvent(event)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* SP Report */}
      {spReport && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 16, fontSize: 14, textTransform: 'uppercase', color: '#666' }}>Service Provider Report</h3>
          <div style={{ border: '1px solid #E5E5E5', padding: 16 }}>
            <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
              <div>
                <span style={{ color: '#666', fontSize: 12 }}>Status: </span>
                {spReport.status === 'submitted' ? (
                  <span style={{ color: '#00A000', fontWeight: 500 }}>Submitted</span>
                ) : spReport.status === 'missing' ? (
                  <span style={{ color: '#C00000', fontWeight: 500 }}>MISSING - DEADLINE PASSED</span>
                ) : (
                  <span style={{ color: '#FFA500', fontWeight: 500 }}>Pending</span>
                )}
              </div>
              {spReport.finish_time && (
                <div>
                  <span style={{ color: '#666', fontSize: 12 }}>Completed: </span>
                  {formatDateTime(spReport.finish_time)}
                </div>
              )}
              <div>
                <span style={{ color: '#666', fontSize: 12 }}>Deadline: </span>
                9:00 AM
              </div>
            </div>
            {spReport.description && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Work Description</div>
                <div style={{ background: '#f5f5f5', padding: 12 }}>{spReport.description}</div>
              </div>
            )}
            {spReport.attachments && spReport.attachments.length > 0 && (
              <div>
                <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>Photos ({spReport.attachments.length})</div>
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
