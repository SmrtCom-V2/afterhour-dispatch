-- Indexes on columns that sit directly in the hottest paths but were never
-- indexed: every incident/building/dashboard query filters through
-- pm_company.fm_company_id and building.pm_company_id for tenant scoping;
-- the wake-up/push notification path looks up fm_admin.phone and
-- service_provider.phone on every notify. Not deployed yet as part of this
-- session's audit fixes — queued for a calmer moment, not applied same-night
-- as a real production outage.
CREATE INDEX IF NOT EXISTS idx_pm_company_fm_company ON pm_company(fm_company_id);
CREATE INDEX IF NOT EXISTS idx_building_pm_company ON building(pm_company_id);
CREATE INDEX IF NOT EXISTS idx_fm_admin_phone ON fm_admin(phone);
CREATE INDEX IF NOT EXISTS idx_service_provider_phone ON service_provider(phone);
