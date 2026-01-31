CREATE TABLE IF NOT EXISTS support_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES fm_company(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES fm_admin(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_notes_company ON support_notes(company_id, created_at);
