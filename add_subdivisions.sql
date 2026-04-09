-- Add subdivisions table under branches
CREATE TABLE IF NOT EXISTS subdivisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(company_id, code)
);

-- Add index for faster queries
CREATE INDEX idx_subdivisions_company ON subdivisions(company_id);
CREATE INDEX idx_subdivisions_branch ON subdivisions(branch_id);
CREATE INDEX idx_subdivisions_status ON subdivisions(status);

-- Add subdivision_id to company_users table
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS subdivision_id UUID REFERENCES subdivisions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_company_users_subdivision ON company_users(subdivision_id);

-- Add subdivision_id to machines table
ALTER TABLE machines ADD COLUMN IF NOT EXISTS subdivision_id UUID REFERENCES subdivisions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_machines_subdivision ON machines(subdivision_id);
