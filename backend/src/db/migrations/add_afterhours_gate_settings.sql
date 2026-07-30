-- After-hours runtime gate: two client-configurable checkboxes.
-- Both were previously saved to the DB but never read by any call-handling code.

-- Per-PM-company: what happens when a call comes in DURING business hours
-- (i.e. current time is outside this pm_company's afterhours window).
-- Default false = redirect to "contact your PM during business hours", no
-- incident/dispatch. Client can flip to true to always run full triage
-- regardless of the clock (their choice, exposed as a Settings checkbox).
ALTER TABLE pm_company
ADD COLUMN IF NOT EXISTS treat_all_as_emergency BOOLEAN NOT NULL DEFAULT false;

-- Company-wide (fm_company): what happens when a caller can't be matched to
-- any tenant on file, so we don't yet know which pm_company's schedule
-- applies. Default true = fail open toward safety (never risk turning away
-- a real emergency just because we can't identify the caller). Verified
-- name+address matching (existing verification_status logic) is the actual
-- abuse control here, not this flag -- an unverified caller already never
-- triggers auto-dispatch (SMS to FM on-call, human decides). Client can
-- flip to false if they'd rather unknown callers get the business-hours
-- redirect message instead of full triage.
ALTER TABLE fm_company
ADD COLUMN IF NOT EXISTS unknown_caller_always_emergency BOOLEAN NOT NULL DEFAULT true;
