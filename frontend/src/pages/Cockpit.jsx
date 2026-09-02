import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { API_URL } from '../utils/apiConfig';
import { getStrings } from './cockpit/cockpitStrings';
import { s } from './cockpit/cockpitStyles';
import { Shell, Centered } from './cockpit/primitives';
import { useCockpitData } from './cockpit/useCockpitData';
import { Zone1Verdict } from './cockpit/Zone1Verdict';
import { Zone2Read } from './cockpit/Zone2Read';
import { Zone3Detail } from './cockpit/Zone3Detail';
import { Zone4Decide } from './cockpit/Zone4Decide';
import { Zone5AfterAction } from './cockpit/Zone5AfterAction';

/**
 * Decision Cockpit — Night Ops HITL. Mobile-first, dark, large tap targets,
 * built to be opened one-handed at 3am from an SMS link. No login — the token
 * is the auth.
 *
 * Structure: AFTERHOUR_ONCALL_COCKPIT_DECISION_FUNNEL_REBUILD_2026-09-02.md
 *   Zone 1 verdict · Zone 2 the 20-second read · Zone 3 detail on demand
 *   Zone 4 decide (the branch set) · Zone 5 after-action
 *
 * English-first (Ron, 2026-09-02). German is added later via cockpitStrings.js.
 * Language is chosen by the call, not a UI toggle — until the call carries
 * one, everything is English.
 */
export function Cockpit() {
  const { token } = useParams();
  const { data, loading, error, derived, reload } = useCockpitData(token);

  const [busy, setBusy] = useState(false);
  const [actionResult, setActionResult] = useState(null);
  const [actionError, setActionError] = useState('');
  const [outcomeNote, setOutcomeNote] = useState('');
  const [callbackCount, setCallbackCount] = useState(0);

  const lang = data?.incident?.callLanguage || 'en';
  const strings = getStrings(lang);

  const decide = useCallback(
    async (action, { chosenSpId, overrideReason } = {}) => {
      setBusy(true);
      setActionError('');
      try {
        const res = await fetch(`${API_URL}/cockpit/${token}/decision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, chosenSpId, overrideReason: overrideReason || undefined }),
        });
        const json = await res.json();

        if (action === 'callback_tenant') {
          if (res.status === 409) {
            setActionResult({ type: 'already_decided', ...json });
          } else if (res.ok) {
            setCallbackCount(json.callbackCount ?? callbackCount + 1);
          }
          await reload();
          return;
        }

        if (res.status === 409) {
          setActionResult({ type: 'already_decided', ...json });
        } else if (res.status === 422 && json.error === 'no_fm_oncall_configured') {
          setActionError(strings.noFmConfigured);
        } else if (res.ok) {
          setActionResult({ type: 'success', ...json });
        } else {
          setActionError(strings.actionFailed);
        }
        await reload();
      } catch {
        setActionError(strings.actionFailed);
      } finally {
        setBusy(false);
      }
    },
    [token, reload, strings, callbackCount],
  );

  const forward = useCallback(async () => {
    const res = await fetch(`${API_URL}/cockpit/${token}/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    return res.ok ? res.json() : null;
  }, [token]);

  const submitOutcome = useCallback(
    async (outcome) => {
      setBusy(true);
      try {
        await fetch(`${API_URL}/cockpit/${token}/outcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome, note: outcomeNote }),
        });
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [token, outcomeNote, reload],
  );

  if (loading) return <Shell><Centered>{strings.loading}</Centered></Shell>;
  if (error) {
    const msg =
      error === 'expired'
        ? strings.linkExpired
        : error === 'connection'
        ? strings.connectionFailed
        : strings.incidentNotFound;
    return (
      <Shell>
        <Centered>
          <p style={s.errorText}>{msg}</p>
        </Centered>
      </Shell>
    );
  }
  if (!data || !derived) return null;

  const decided =
    data.alreadyDecided ||
    actionResult?.type === 'success' ||
    actionResult?.type === 'already_decided';

  return (
    <Shell>
      <Zone1Verdict data={data} derived={derived} strings={strings} />
      <Zone2Read data={data} derived={derived} strings={strings} />
      <Zone3Detail data={data} strings={strings} forceOpen={derived.lowConfidence} />

      {decided ? (
        <Zone5AfterAction
          data={data}
          actionResult={actionResult}
          strings={strings}
          busy={busy}
          onSubmitOutcome={submitOutcome}
          note={outcomeNote}
          setNote={setOutcomeNote}
        />
      ) : (
        <Zone4Decide
          data={data}
          derived={derived}
          strings={strings}
          busy={busy}
          onDecide={decide}
          onForward={forward}
          callbackCount={callbackCount || data.incident.callbackCount || 0}
          actionError={actionError}
        />
      )}
    </Shell>
  );
}
