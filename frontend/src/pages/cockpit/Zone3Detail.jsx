import { useState } from 'react';
import { s } from './cockpitStyles';
import { Section, Row, AccessItem } from './primitives';

/**
 * ZONE 3 — detail on demand. Story summary, the Q&A the AI asked, the full
 * transcript, where the property is + access, history at this property, and
 * who's been contacted so far. Collapsed by default; auto-expanded when the
 * AI was low-confidence (that's exactly when the human needs the raw call).
 */
export function Zone3Detail({ data, strings, forceOpen }) {
  const [open, setOpen] = useState(Boolean(forceOpen));
  const { incident, building, caller, history, wakeupAttempts } = data;
  const brief = incident.aiBrief;

  return (
    <div>
      <button style={s.detailToggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? strings.detailToggleHide : strings.detailToggleShow}
      </button>

      {open && (
        <>
          {/* call summary / Q&A / transcript */}
          <Section title={strings.callSummary}>
            {brief?.story_summary && <p style={s.reportedText}>{brief.story_summary}</p>}
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
            {!brief?.qa?.length &&
              Array.isArray(incident.guidedAnswers) &&
              incident.guidedAnswers.length > 0 && (
                <>
                  <p style={s.sectionSubtitle}>{strings.questionsAsked}</p>
                  <div style={s.qaList}>
                    {incident.guidedAnswers.map((item, i) => (
                      <div key={i} style={s.qaItem}>
                        <span style={s.qaQ}>{item.question}</span>
                        <span style={s.qaA}>{item.answer}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            {incident.transcript && (
              <>
                <p style={s.sectionSubtitle}>{strings.fullTranscript}</p>
                <div style={s.transcript}>{incident.transcript}</div>
              </>
            )}
          </Section>

          {/* where */}
          <Section title={strings.where}>
            <Row label={strings.property} value={building?.name} />
            <Row label={strings.address} value={building?.address} />
            {caller?.phone && (
              <a href={`tel:${caller.phone}`} style={s.callButton}>
                📞 {strings.callTenant(caller.name)}
              </a>
            )}
            {(building?.gateCode || building?.mainEntranceCode || building?.keySafeCode) && (
              <p style={s.forwardWarning}>⚠ Contains access codes — do not forward this link.</p>
            )}
            <div style={s.accessGrid}>
              <AccessItem label={strings.waterShutoff} value={building?.waterShutoff} />
              <AccessItem label={strings.gasShutoff} value={building?.gasShutoff} />
              <AccessItem label={strings.electricShutoff} value={building?.electricShutoff} />
              <AccessItem label={strings.keySafe} value={building?.keySafeLocation} />
              <AccessItem label={strings.gateCode} value={building?.gateCode} />
              <AccessItem label={strings.entranceCode} value={building?.mainEntranceCode} />
            </div>
            {building?.specialAccessInstructions && (
              <p style={s.note}>{building.specialAccessInstructions}</p>
            )}
            {building?.janitorPhone && (
              <a href={`tel:${building.janitorPhone}`} style={s.secondaryLink}>
                🔑 {strings.janitor}: {building.janitorName || ''} {building.janitorPhone}
              </a>
            )}
          </Section>

          {/* history */}
          <Section title={strings.history}>
            {history?.length > 0 ? (
              history.map((h) => (
                <Row
                  key={h.id}
                  label={new Date(h.created_at).toLocaleDateString('en-GB')}
                  value={
                    `${(h.issue_category || '').replace(/_/g, ' ')}` +
                    (h.night_outcome && strings.outcomeLabel[h.night_outcome]
                      ? ` · ${strings.outcomeLabel[h.night_outcome]}`
                      : '')
                  }
                />
              ))
            ) : (
              <p style={s.confNote}>{strings.noHistory}</p>
            )}
          </Section>

          {/* who's been contacted */}
          {wakeupAttempts?.length > 1 && (
            <Section title={strings.contactedSoFar}>
              {wakeupAttempts.map((w, i) => (
                <Row key={i} label={w.stage} value={`${w.channel} — ${w.result}`} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
