import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { API_URL } from '../utils/apiConfig';
import { getStrings } from './cockpit/cockpitStrings';
import { s } from './cockpit/cockpitStyles';
import { Shell, Centered, Section } from './cockpit/primitives';
import { relativeTime } from './cockpit/useCockpitData';

/**
 * Read-only, code-stripped view of an incident brief. This is what the
 * "Forward a safe brief" link in the cockpit opens — safe to send to a
 * service provider or a colleague because it carries NO building access
 * codes, janitor phone, or special-access instructions (the backend route
 * GET /api/cockpit/forward/:token never sends them).
 */
export function CockpitForwardView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const strings = getStrings('en');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/cockpit/forward/${token}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error === 'expired' ? strings.linkExpired : strings.incidentNotFound);
          return;
        }
        setData(json);
      } catch {
        setError(strings.connectionFailed);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, strings]);

  if (loading) return <Shell><Centered>{strings.loading}</Centered></Shell>;
  if (error) return <Shell><Centered><p style={s.errorText}>{error}</p></Centered></Shell>;
  if (!data) return null;

  const { incident, building, requiredTrade } = data;
  const brief = incident.aiBrief;
  const assess = brief?.emergency_assessment;

  return (
    <Shell>
      <div style={{ ...s.badge, background: '#334155' }}>SHARED BRIEF · READ-ONLY</div>

      <Section title="What happened">
        {brief?.headline && <p style={s.verdictLine}>{brief.headline}</p>}
        {assess && (
          <div
            style={
              assess.is_emergency === 'unsure'
                ? s.assessUnsure
                : assess.is_emergency === 'yes'
                ? s.assessYes
                : s.assessNo
            }
          >
            <span style={s.assessStrong}>
              {assess.is_emergency === 'unsure'
                ? strings.aiCouldNotJudge
                : assess.is_emergency === 'yes'
                ? strings.aiThinksEmergency
                : strings.aiThinksNotEmergency}
            </span>
            {assess.one_liner && <span>{assess.one_liner}</span>}
            {assess.reasoning && <p style={s.assessReason}>{assess.reasoning}</p>}
          </div>
        )}
        {(brief?.reported || incident.description) && (
          <>
            <p style={s.sectionSubtitle}>{strings.whatCallerReported}</p>
            <p style={s.reportedText}>{brief?.reported || incident.description}</p>
          </>
        )}
        {brief?.story_summary && (
          <>
            <p style={s.sectionSubtitle}>{strings.callSummary}</p>
            <p style={s.reportedText}>{brief.story_summary}</p>
          </>
        )}
        {Array.isArray(brief?.qa) && brief.qa.length > 0 && (
          <>
            <p style={s.sectionSubtitle}>{strings.questionsAsked}</p>
            <div style={s.qaList}>
              {brief.qa.map((item, i) => (
                <div key={i} style={s.qaItem}>
                  <span style={s.qaQ}>{item.q}</span>
                  <span style={s.qaA}>{item.a}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <p style={{ ...s.confNote, marginTop: '12px' }}>{relativeTime(incident.createdAt, strings.lang)}</p>
      </Section>

      <Section title={strings.where}>
        <p style={s.reportedText}>{building?.name}</p>
        <p style={s.reportedText}>{building?.address}</p>
        {requiredTrade && (
          <p style={{ ...s.confNote, marginTop: '8px' }}>
            Trade needed: {requiredTrade.replace(/_/g, ' ')}
          </p>
        )}
      </Section>

      {incident.transcript && (
        <Section title={strings.fullTranscript}>
          <div style={s.transcript}>{incident.transcript}</div>
        </Section>
      )}
    </Shell>
  );
}
