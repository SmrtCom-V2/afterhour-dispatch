-- Add per-day after-hours configuration to pm_company table
-- This allows FM companies to set different after-hours for each day of the week

ALTER TABLE pm_company
ADD COLUMN IF NOT EXISTS same_hours_all_days BOOLEAN DEFAULT true;

ALTER TABLE pm_company
ADD COLUMN IF NOT EXISTS afterhours_by_day JSONB DEFAULT '{
  "monday": {"enabled": true, "start": "18:00", "end": "07:00"},
  "tuesday": {"enabled": true, "start": "18:00", "end": "07:00"},
  "wednesday": {"enabled": true, "start": "18:00", "end": "07:00"},
  "thursday": {"enabled": true, "start": "18:00", "end": "07:00"},
  "friday": {"enabled": true, "start": "18:00", "end": "07:00"},
  "saturday": {"enabled": true, "start": "00:00", "end": "23:59"},
  "sunday": {"enabled": true, "start": "00:00", "end": "23:59"}
}'::jsonb;

-- Add index for better query performance when filtering by afterhours settings
CREATE INDEX IF NOT EXISTS idx_pm_company_same_hours ON pm_company(same_hours_all_days);
