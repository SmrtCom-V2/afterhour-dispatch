-- Risk #10 (2026-08-08 Go/No-Go audit, and already flagged as an open
-- backlog item in voice-brain/README.md: "Duplicate incident detection
-- (same building + category within 4h window)"). Distinct from Blocker #3's
-- webhook-retry dedupe: these are genuinely separate calls (different
-- callers, different call_provider_id) that should be recognized as
-- reports of the same real-world issue, so the on-call worker gets paged
-- once per issue, not once per caller. Ron's decision (Aug 8): match on
-- building + issue_category within a 15-minute window (narrower than the
-- backlog's original 4h — an incident's ai_urgency is only actionable
-- while genuinely current) so an unrelated second emergency in the same
-- building isn't silently swallowed by a stale earlier one.
ALTER TABLE incident
  ADD COLUMN IF NOT EXISTS linked_incident_id UUID REFERENCES incident(id),
  ADD COLUMN IF NOT EXISTS linked_reason VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_incident_linked_incident_id ON incident(linked_incident_id);

-- Used by findClusterPrimary()'s lookup: same building, same category,
-- recent, not itself already a linked child of something else.
CREATE INDEX IF NOT EXISTS idx_incident_building_category_recent
  ON incident (building_id, issue_category, created_at)
  WHERE linked_incident_id IS NULL;
