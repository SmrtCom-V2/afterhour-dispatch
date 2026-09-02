import { s, URGENCY_COLOR } from './cockpitStyles';
import { Countdown } from './Countdown';

const BADGE_TEXT = (strings) => ({
  critical: strings.badgeEmergency,
  urgent: strings.badgeUrgent,
  unclear: strings.badgeUnsure,
  low: strings.badgeNotUrgent,
});

const RECOMMEND = (strings) => ({
  send_company: { text: strings.recommendSendCompany, icon: '🚒' },
  defer_morning: { text: strings.recommendDefer, icon: '🌙' },
});

/** Strip the AI's "UNSURE HOW URGENT — " headline prefix — the badge says that. */
function cleanHeadline(headline) {
  if (!headline) return '';
  return headline.replace(/^unsure how urgent\s*[—–-]\s*/i, '');
}

/**
 * ZONE 1 — the verdict. Badge, one-line verdict, recommended action, and the
 * live T+10 countdown. The on-call person should be able to decide from this
 * plus Zone 2 alone.
 */
export function Zone1Verdict({ data, derived, strings }) {
  const { incident, suggestedAction } = data;
  const { urgencyKey, isUnsure } = derived;
  const badge = BADGE_TEXT(strings)[urgencyKey] || strings.badgeUnsure;
  // When the AI could not judge urgency, never show a send/defer recommendation
  // — that would undercut "your call". Just tell them to read and decide.
  const recommend = isUnsure
    ? { text: strings.recommendReadAndDecide, icon: '👀' }
    : RECOMMEND(strings)[suggestedAction] || null;

  const verdictLine =
    cleanHeadline(incident.aiBrief?.headline) ||
    incident.description ||
    (incident.category ? incident.category.replace(/_/g, ' ') : '');

  const decisionPending = incident.decision === 'pending';

  return (
    <div>
      <div style={{ ...s.badge, background: URGENCY_COLOR[urgencyKey] || URGENCY_COLOR.unclear }}>
        {badge}
      </div>

      {verdictLine && <p style={s.verdictLine}>{verdictLine}</p>}

      {recommend && (
        <div style={s.recommendBanner}>
          <span style={s.recommendIcon}>{recommend.icon}</span>
          <span>{recommend.text}</span>
        </div>
      )}

      <Countdown
        failsafeAt={incident.failsafeAt}
        decisionPending={decisionPending}
        strings={strings}
      />
    </div>
  );
}
