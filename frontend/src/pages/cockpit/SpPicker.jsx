import { s } from './cockpitStyles';

function OpenNowPill({ sp, strings }) {
  if (sp.openNow === 'always') return <span style={{ ...s.pill, ...s.pill247 }}>{strings.open24h}</span>;
  if (sp.openNow === 'open') return <span style={{ ...s.pill, ...s.pillOpen }}>{strings.openNow}</span>;
  return (
    <span style={{ ...s.pill, ...s.pillClosed }}>
      {strings.closedNow(sp.availableFrom?.slice(0, 5) || '', sp.availableTo?.slice(0, 5) || '')}
    </span>
  );
}

/**
 * Context-rich SP list — the on-call person (often not a trades pro) needs
 * more than a bare name at 2am: is this one reachable now, what's the note,
 * which is the building's first choice.
 */
export function SpPicker({ companies, suggestedId, chosenId, onChoose, strings }) {
  if (!companies || companies.length === 0) {
    return <p style={s.note}>{strings.noProviderForTrade}</p>;
  }
  return (
    <div>
      <p style={s.sectionSubtitle}>{strings.pickProvider}</p>
      {companies.map((sp) => {
        const selected = chosenId === sp.id;
        return (
          <label
            key={sp.id}
            style={selected ? { ...s.spOption, ...s.spOptionSelected } : s.spOption}
          >
            <input
              type="radio"
              name="sp"
              style={s.spRadio}
              checked={selected}
              onChange={() => onChoose(sp.id)}
            />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={s.spName}>{sp.companyName}</span>
              <span style={s.spMeta}>
                <span>{(sp.trade || '').replace(/_/g, ' ')}</span>
                <OpenNowPill sp={sp} strings={strings} />
                {sp.id === suggestedId && (
                  <span style={{ ...s.pill, ...s.pillSuggested }}>{strings.suggestedTag}</span>
                )}
                {sp.priority != null && (
                  <span style={{ ...s.pill, ...s.pillRank }}>{strings.rankTag(sp.priority)}</span>
                )}
                <span>{sp.phone}</span>
              </span>
              {sp.usageNote && <span style={s.spNote}>{sp.usageNote}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
