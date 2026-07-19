-- Links a logged-in app user (fm_admin) to the on-call person the wake-up
-- engine resolves by phone (fm_employee.phone / on_call_schedule.contact_phone).
-- Nullable: most fm_admin rows won't be on-call people (e.g. office staff
-- who only use the web dashboard) and push simply isn't sent for those.
ALTER TABLE fm_admin ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
