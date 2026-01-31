ALTER TABLE fm_admin
ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE fm_admin
SET is_platform_admin = TRUE
WHERE email = 'admin@demo.com';
