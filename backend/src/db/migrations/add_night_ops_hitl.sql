-- Night Ops HITL: human-in-the-loop dispatch system
-- Adds: incident decision-tracking columns, cockpit tokens, wake-up attempt log,
-- and on-call role/staffing-mode columns. See NIGHT_OPS_MASTER_PLAN.md §9.
-- All statements idempotent — this file re-runs on every deploy (see migrate.js).

-- 1. incident: decision-tracking columns (§9.1)
ALTER TABLE incident
  ADD COLUMN IF NOT EXISTS ai_urgency VARCHAR(20)
    CHECK (ai_urgency IN ('critical', 'urgent', 'unclear')),
  ADD COLUMN IF NOT EXISTS suggested_sp_id UUID REFERENCES service_provider(id),
  ADD COLUMN IF NOT EXISTS chosen_sp_id UUID REFERENCES service_provider(id),
  ADD COLUMN IF NOT EXISTS decided_by_person VARCHAR(255),
  ADD COLUMN IF NOT EXISTS decided_via VARCHAR(20)
    CHECK (decided_via IN ('cockpit', 'dtmf_ack', 'failsafe')),
  ADD COLUMN IF NOT EXISTS night_outcome VARCHAR(30)
    CHECK (night_outcome IN ('dispatched', 'owner_on_site', 'deferred_morning', 'stabilized_pending_repair', 'resolved_night'));

-- 2. cockpit_token: single-use magic links for the Decision Cockpit (§9.2)
CREATE TABLE IF NOT EXISTS cockpit_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('primary', 'backup')),
  person_name VARCHAR(255),
  phone VARCHAR(20),
  expires_at TIMESTAMPTZ NOT NULL,
  opened_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cockpit_token_incident ON cockpit_token(incident_id);
CREATE INDEX IF NOT EXISTS idx_cockpit_token_token ON cockpit_token(token);

-- 3. wakeup_attempt: log of every ring/SMS sent to on-call humans (§9.2, feeds morning report)
CREATE TABLE IF NOT EXISTS wakeup_attempt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  person_name VARCHAR(255),
  phone VARCHAR(20),
  stage VARCHAR(20) NOT NULL CHECK (stage IN ('t0', 't2', 't5_backup', 't10_failsafe')),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('voice_call', 'sms', 'push')),
  result VARCHAR(40),
  provider_message_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wakeup_attempt_incident ON wakeup_attempt(incident_id);
-- Widen in case the table already exists from an earlier deploy of this
-- migration (CREATE TABLE IF NOT EXISTS won't retroactively widen a column) —
-- 'no_recipient_configured' (24 chars) overflowed the original VARCHAR(20),
-- found live while testing the fail-safe drill.
ALTER TABLE wakeup_attempt ALTER COLUMN result TYPE VARCHAR(40);

-- 4. on_call_schedule: add role + staffing-mode columns (D3/D5 — reuse existing
-- weekly-slot table rather than building a parallel one; a slot becomes
-- "tonight's primary" or "tonight's backup" via the new `role` column, and
-- `staffing_mode` records whether this slot is filled by the PM company's own
-- employee or an outsourced FM company contact).
--
-- fm_employee_id was NOT NULL (verified live July 18, broke the first real
-- insert attempt) — that fit the old model where every on-call slot was
-- necessarily a known fm_employee row. Night Ops D3 requires supporting a
-- plain contact_name/contact_phone (e.g. an outsourced FM company's night
-- dispatcher who isn't a row in fm_employee at all), so the column must
-- allow NULL when contact_name/contact_phone are supplied instead.
ALTER TABLE on_call_schedule
  ALTER COLUMN fm_employee_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS role VARCHAR(10) DEFAULT 'primary'
    CHECK (role IN ('primary', 'backup')),
  ADD COLUMN IF NOT EXISTS staffing_mode VARCHAR(20) DEFAULT 'pm_employee'
    CHECK (staffing_mode IN ('pm_employee', 'fm_company')),
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);

ALTER TABLE on_call_schedule
  DROP CONSTRAINT IF EXISTS on_call_schedule_employee_or_contact_check;
ALTER TABLE on_call_schedule
  ADD CONSTRAINT on_call_schedule_employee_or_contact_check
    CHECK (fm_employee_id IS NOT NULL OR contact_phone IS NOT NULL);

-- 5. notify_call_content: short-lived content store for notifyHuman's
-- voice_call channel. Twilio's call webhook only posts CallSid/From/To —
-- it does not round-trip our metadata — so the message to speak is looked
-- up by a token in the webhook URL instead (same pattern dispatch.js uses
-- per dispatch_attempt, generalized for any notifyHuman caller).
CREATE TABLE IF NOT EXISTS notify_call_content (
  token UUID PRIMARY KEY,
  purpose VARCHAR(30) NOT NULL,
  title VARCHAR(255),
  body TEXT NOT NULL,
  dtmf_prompt TEXT,
  correlation JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notify_call_content_expires ON notify_call_content(expires_at);

-- 6. morning_report: fix a pre-existing bug (unrelated to Night Ops, found
-- while testing the new handoff section) — generateMorningReport's
-- `ON CONFLICT (pm_company_id, report_date)` had no matching unique
-- constraint (only a plain non-unique index existed), so EVERY morning
-- report generation has been failing with a hard Postgres error. This
-- likely means no morning report has ever successfully sent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'morning_report_pm_company_date_unique'
  ) THEN
    ALTER TABLE morning_report
      ADD CONSTRAINT morning_report_pm_company_date_unique UNIQUE (pm_company_id, report_date);
  END IF;
END $$;

COMMENT ON COLUMN incident.ai_urgency IS 'AI triage label at intake — human always decides regardless of this value (Night Ops D1)';
COMMENT ON COLUMN incident.decided_via IS 'cockpit = human decision; dtmf_ack = phone keypad acknowledgement only (does not count as a decision); failsafe = T+10 auto-dispatch, nobody answered';
