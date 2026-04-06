-- ========================================
-- Add branch_id to company_users table
-- Migration to support branch-specific user assignment
-- ========================================

-- Add branch_id column to company_users table
ALTER TABLE company_users 
ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_company_users_branch_id ON company_users(branch_id);

-- Add comment
COMMENT ON COLUMN company_users.branch_id IS 'Branch assignment for the user within their company';
