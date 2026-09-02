import { s } from './cockpitStyles';
import { Section } from './primitives';

/**
 * ZONE 5 — after-action. Shows who decided what, and (when a provider was
 * dispatched) lets the decider record how the night ended.
 */
export function Zone5AfterAction({ data, actionResult, strings, busy, onSubmitOutcome, note, setNote }) {
  const { incident } = data;
  const decidedBy = actionResult?.decidedByPerson || incident.decidedByPerson;
  const outcome = actionResult?.nightOutcome || incident.nightOutcome;
  const label = (o) => strings.outcomeLabel[o] || o;

  if (incident.nightOutcome === 'stabilized_pending_repair' || incident.nightOutcome === 'resolved_night') {
    return (
      <Section title={strings.decisionMade}>
        <p>
          {strings.result}:{' '}
          {incident.nightOutcome === 'resolved_night'
            ? strings.outcomeLabel.resolved_night
            : strings.outcomeLabel.stabilized_pending_repair}
        </p>
      </Section>
    );
  }

  const dispatched = outcome === 'dispatched' || outcome === 'dispatched_manual';

  return (
    <Section title={strings.decisionMade}>
      <p>{decidedBy ? strings.decidedBy(decidedBy) : strings.decidedByUnknown}</p>
      <p style={s.note}>
        {strings.result}: {outcome ? label(outcome) : '—'}
      </p>

      {dispatched && (
        <>
          <p style={s.sectionSubtitle}>{strings.recordNightResult}</p>
          <textarea
            style={s.textarea}
            placeholder={strings.noteOptional}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            disabled={busy}
            style={{ ...s.decisionButton, background: '#16a34a' }}
            onClick={() => onSubmitOutcome('stabilized_pending_repair')}
          >
            {strings.outcomeStabilized}
          </button>
          <button
            disabled={busy}
            style={{ ...s.decisionButton, background: '#2563eb' }}
            onClick={() => onSubmitOutcome('resolved_night')}
          >
            {strings.outcomeResolved}
          </button>
        </>
      )}
    </Section>
  );
}
