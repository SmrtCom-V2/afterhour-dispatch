import { useState, useEffect } from 'react';
import { s } from './cockpitStyles';
import { msRemaining, formatMs } from './useCockpitData';

/**
 * ⏱ Live countdown to the T+10 fail-safe auto-dispatch. The on-call person
 * needs to know the clock is running — if nobody decides, the system sends
 * someone automatically 10 minutes after the call.
 *
 * Hidden once a decision is made or the clock has run out (the fail-safe has
 * either fired or been beaten — the 15s poll will reflect the real state).
 */
export function Countdown({ failsafeAt, decisionPending, strings, explain = true }) {
  const [ms, setMs] = useState(() => msRemaining(failsafeAt));

  useEffect(() => {
    if (!decisionPending) return undefined;
    const id = setInterval(() => setMs(msRemaining(failsafeAt)), 1000);
    return () => clearInterval(id);
  }, [failsafeAt, decisionPending]);

  if (!decisionPending || ms == null || ms <= 0) return null;

  const urgent = ms < 3 * 60 * 1000;
  return (
    <div>
      <div style={urgent ? { ...s.countdown, ...s.countdownUrgent } : s.countdown}>
        <span>⏱</span>
        <span>
          {urgent ? strings.autoDispatchImminent : `${strings.autoDispatchIn} ${formatMs(ms)}`}
        </span>
      </div>
      {explain && <p style={s.countdownExplain}>{strings.autoDispatchExplain}</p>}
    </div>
  );
}
