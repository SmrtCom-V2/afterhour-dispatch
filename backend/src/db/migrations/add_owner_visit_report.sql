-- On-site visit report: captures what happened when the on-call person
-- chose to handle an incident themselves (night_outcome = 'owner_on_site')
-- instead of dispatching a service provider. Mirrors sp_report's shape
-- (description + photos) but authored by the fm_admin who went on-site,
-- not an external contractor, and has no token/link — the app already
-- knows who's logged in and which incident this is for.
CREATE TABLE IF NOT EXISTS owner_visit_report (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  fm_admin_id UUID NOT NULL REFERENCES fm_admin(id),
  description TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT true,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_owner_visit_report_incident ON owner_visit_report(incident_id);

CREATE TABLE IF NOT EXISTS owner_visit_report_attachment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_visit_report_id UUID NOT NULL REFERENCES owner_visit_report(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
