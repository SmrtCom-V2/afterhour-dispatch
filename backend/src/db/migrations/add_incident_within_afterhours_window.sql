-- Tags every incident with whether it was created inside the pm_company's
-- CONFIGURED after-hours window (pm_company.afterhours_start/end,
-- same_hours_all_days, afterhours_by_day), Europe/Berlin time.
--
-- Purely additive/informational (Ron, July 31): does NOT gate, block, or
-- change whether a human gets paged -- that logic (Night Ops D1, human
-- always decides) is untouched. This column exists so reporting can
-- distinguish "real after-hours call" from "call arrived outside the
-- client's configured window but was still routed to a human anyway" (per
-- the product decision: never silently drop or end a call without human
-- contact). NULL means the tag was never computed for that row (rows
-- created before this migration, or any future incident-creation path that
-- doesn't set it) -- NULL is deliberately distinct from false, not backfilled.
ALTER TABLE incident
ADD COLUMN IF NOT EXISTS within_configured_afterhours_window BOOLEAN;

COMMENT ON COLUMN incident.within_configured_afterhours_window IS
  'Computed at incident-creation time from the resolved pm_company''s after-hours schedule (Europe/Berlin). NULL = not computed (pre-migration row, or no building/pm_company resolved yet). Informational tag only -- never gates human paging (Night Ops D1 unaffected).';
