-- Cockpit decision-funnel rebuild — see
-- AFTERHOUR_ONCALL_COCKPIT_DECISION_FUNNEL_REBUILD_2026-09-02.md
--
-- Adds the new on-call decision actions (call SP yourself, escalate to FM,
-- call tenant back first) and the code-stripped "forward a safe brief" links.
-- All statements idempotent — this file re-runs on every deploy (migrate.js).
--
-- Ordering note: this file sorts BEFORE add_night_ops_hitl.sql alphabetically
-- ('c' < 'n'), so it widens incident.night_outcome's CHECK first; the later
-- add_night_ops_hitl.sql only does ADD COLUMN IF NOT EXISTS (a no-op on
-- re-run), so it does not re-narrow the constraint. Verified 2026-09-02.

-- 1. incident.decision — add the human-initiated FM escalation state.
--    The base schema.sql defines this column inline in CREATE TABLE, so the
--    auto-named constraint is incident_decision_check.
ALTER TABLE incident DROP CONSTRAINT IF EXISTS incident_decision_check;
ALTER TABLE incident ADD CONSTRAINT incident_decision_check CHECK (decision IN (
  'pending',
  'emergency_dispatch',
  'not_emergency',
  'unclear_escalated',
  'verification_failed',
  'escalated_to_fm_by_human'
));

-- 2. incident.night_outcome — add manual dispatch, human FM escalation, and
--    the non-terminal "calling the tenant back first" holding state.
--    Column + its CHECK were added by add_night_ops_hitl.sql (auto-named
--    incident_night_outcome_check).
ALTER TABLE incident DROP CONSTRAINT IF EXISTS incident_night_outcome_check;
ALTER TABLE incident ADD CONSTRAINT incident_night_outcome_check CHECK (night_outcome IN (
  'dispatched',
  'owner_on_site',
  'deferred_morning',
  'stabilized_pending_repair',
  'resolved_night',
  'dispatched_manual',
  'escalated_to_fm',
  'callback_pending'
));

-- 3. How a send-company decision was executed: 'auto' = system runs the
--    dispatch call loop (existing behaviour); 'manual' = the on-call person
--    is phoning the SP themselves, we only record it + still issue the
--    report token / "no report = no payment" SMS.
ALTER TABLE incident
  ADD COLUMN IF NOT EXISTS dispatch_mode VARCHAR(20)
    CHECK (dispatch_mode IN ('auto', 'manual'));

-- 4. Times the on-call person tapped "call the tenant back" before deciding.
--    Feeds the morning report ("took 2 callbacks to resolve").
ALTER TABLE incident
  ADD COLUMN IF NOT EXISTS callback_count INTEGER NOT NULL DEFAULT 0;

-- 5. Code-stripped, read-only forward links. A cockpit link carries building
--    access codes and must not be forwarded (existing warning in the UI);
--    this is the safe alternative the human can send to an SP or a colleague.
CREATE TABLE IF NOT EXISTS cockpit_forward_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  created_by_person VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cockpit_forward_link_token ON cockpit_forward_link(token);
CREATE INDEX IF NOT EXISTS idx_cockpit_forward_link_incident ON cockpit_forward_link(incident_id);

COMMENT ON COLUMN incident.dispatch_mode IS 'auto = system ran the SP dispatch call loop; manual = on-call person phoned the SP themselves (recorded only). NULL for non-dispatch decisions.';
COMMENT ON COLUMN incident.callback_count IS 'How many times the on-call person hit "call tenant back first" in the cockpit before making a decision.';
