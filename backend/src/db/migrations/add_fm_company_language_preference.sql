-- FM company admins (the paying customer) never speak on a call, so their
-- language can't be detected the way tenant.language_preference is set from
-- call transcripts. Default to German (primary market); capture the real
-- value from the site's EN/DE toggle at signup time.
ALTER TABLE fm_company ADD COLUMN IF NOT EXISTS language_preference VARCHAR(10) DEFAULT 'de';
