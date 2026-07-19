-- Race-breaker for overlapping wake-up cron ticks. node-cron does not
-- guarantee the previous minute's tick finished before the next fires; if a
-- tick handling several concurrent incidents takes >60s, two ticks can both
-- see a stage as "not yet done" (wakeup_attempt has no row yet, since that
-- table is only written AFTER a successful notify) and both dial/text the
-- same person for the same stage. This table is claimed atomically via
-- INSERT ... ON CONFLICT DO NOTHING BEFORE any call/SMS goes out, so only
-- the first tick to reach it proceeds.
CREATE TABLE IF NOT EXISTS wakeup_stage_claim (
  incident_id UUID NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  stage VARCHAR(20) NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (incident_id, stage)
);
