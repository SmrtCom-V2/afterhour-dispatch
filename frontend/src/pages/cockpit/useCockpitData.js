import { useState, useEffect, useCallback, useMemo } from 'react';
import { API_URL } from '../../utils/apiConfig';

// Pure, dependency-free helpers live in cockpitLogic.js so they can be unit
// tested under plain `node --test` without pulling in Vite's import.meta.env.
export {
  urgencyKeyFor,
  isOverrideOfAiSuggestion,
  aiHasImpliedAction,
  relativeTime,
  msRemaining,
  formatMs,
} from './cockpitLogic';
import { urgencyKeyFor } from './cockpitLogic';

export function useCockpitData(token) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/cockpit/${token}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error === 'expired' ? 'expired' : 'not_found');
        return;
      }
      setData(json);
      setError('');
    } catch {
      setError('connection');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    // Auto-refresh so if the backup decider acted, this screen catches up.
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const derived = useMemo(() => {
    if (!data) return null;
    const { incident } = data;
    const urgencyKey = urgencyKeyFor(incident);
    const assess = incident.aiBrief?.emergency_assessment || null;
    const isUnsure = assess?.is_emergency === 'unsure' || urgencyKey === 'unclear';
    const lowConfidence =
      isUnsure || (assess && assess.confidence_percent != null && assess.confidence_percent < 50);
    return { urgencyKey, assess, isUnsure, lowConfidence };
  }, [data]);

  return { data, loading, error, derived, reload: load };
}
