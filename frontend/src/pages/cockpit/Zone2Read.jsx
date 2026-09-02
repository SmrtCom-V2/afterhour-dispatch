import { s } from './cockpitStyles';
import { Section } from './primitives';
import { VerificationBadge } from './VerificationBadge';
import { relativeTime } from './useCockpitData';

/**
 * ZONE 2 — the 20-second read. The emergency assessment (with the percentage
 * fixed: hidden when unsure, relabelled otherwise), what the caller reported,
 * and a short "what's worth knowing" list.
 */
export function Zone2Read({ data, derived, strings }) {
  const { incident, caller, recurringPattern, building } = data;
  const { assess, isUnsure } = derived;
  const brief = incident.aiBrief;

  const hasCodes = Boolean(building?.keySafeCode || building?.gateCode || building?.mainEntranceCode);

  // "What's worth knowing" — computed, ordered by how much it should change the decision.
  const unusual = [];
  if (recurringPattern?.sameCategoryCount >= 1) {
    unusual.push({
      icon: '⚠',
      text: strings.recurringIssue(
        recurringPattern.sameCategoryCount + 1,
        (incident.category || 'similar').replace(/_/g, ' '),
      ),
    });
  } else if (recurringPattern?.count >= 2) {
    unusual.push({ icon: '↩', text: strings.recurringAny(recurringPattern.count) });
  }
  if (hasCodes) unusual.push({ icon: '🔑', text: strings.codesAttached });
  if (brief?.degraded) unusual.push({ icon: '⚠', text: strings.callDegraded });

  return (
    <Section>
      {/* verification badge always visible */}
      <div style={{ marginBottom: '12px' }}>
        <VerificationBadge
          verificationStatus={incident.verificationStatus}
          caller={caller}
          strings={strings}
        />
      </div>

      {/* emergency assessment */}
      {isUnsure ? (
        <div style={s.assessUnsure}>
          <span style={s.assessStrong}>{strings.aiCouldNotJudge}</span>
          <span>{strings.aiCouldNotJudgeSub}</span>
          {assess?.reasoning && <p style={s.assessReason}>{assess.reasoning}</p>}
        </div>
      ) : assess ? (
        <div style={assess.is_emergency === 'yes' ? s.assessYes : s.assessNo}>
          <span style={s.assessStrong}>
            {assess.is_emergency === 'yes' ? strings.aiThinksEmergency : strings.aiThinksNotEmergency}
          </span>
          {assess.one_liner && <span>{assess.one_liner}</span>}
          {assess.reasoning && <p style={s.assessReason}>{assess.reasoning}</p>}
          {assess.confidence_percent != null && (
            <p style={s.confNote}>
              {strings.aiConfidenceInProblem(assess.confidence_percent)}
              {assess.confidence_percent < 50 ? ` ${strings.aiLowConfidence}` : ''}
            </p>
          )}
        </div>
      ) : null}

      {/* what the caller reported */}
      {(brief?.reported || incident.description) && (
        <>
          <p style={s.sectionSubtitle}>{strings.whatCallerReported}</p>
          <p style={s.reportedText}>{brief?.reported || incident.description}</p>
        </>
      )}

      {/* what's worth knowing */}
      {unusual.length > 0 && (
        <>
          <p style={s.sectionSubtitle}>{strings.whatsUnusual}</p>
          <div style={s.unusualList}>
            {unusual.map((u, i) => (
              <div key={i} style={s.unusualItem}>
                <span>{u.icon}</span>
                <span>{u.text}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <p style={{ ...s.confNote, marginTop: '12px' }}>{relativeTime(incident.createdAt)}</p>
    </Section>
  );
}
