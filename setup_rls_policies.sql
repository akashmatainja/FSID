-- ========================================
-- RLS Policies for Tenant Isolation
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users can view company users" ON company_users;
DROP POLICY IF EXISTS "Users can view company roles" ON roles;
DROP POLICY IF EXISTS "Users can view user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view company machines" ON machines;
DROP POLICY IF EXISTS "Users can view user machine assignments" ON user_machines;
DROP POLICY IF EXISTS "Users can view all machine stats" ON machine_stats;
DROP POLICY IF EXISTS "Users can view assigned machine stats" ON machine_stats;

-- Companies: Superadmin can read all, users can read their own
CREATE POLICY "Superadmin can view all companies" ON companies
    FOR SELECT USING (current_setting('app.user_permissions', true) ? 'superadmin');

CREATE POLICY "Users can view their own company" ON companies
    FOR SELECT USING (id = current_setting('app.current_company_id', true)::UUID);

-- Company Users: Superadmin can read all, users can read their company's users
CREATE POLICY "Superadmin can view all company users" ON company_users
    FOR SELECT USING (current_setting('app.user_permissions', true) ? 'superadmin');

CREATE POLICY "Users can view company users" ON company_users
    FOR SELECT USING (company_id = current_setting('app.current_company_id', true)::UUID);

-- Users can insert their own company user (for registration)
CREATE POLICY "Users can insert company users" ON company_users
    FOR INSERT WITH CHECK (true);

-- Roles: Superadmin can read all, company-scoped for users
CREATE POLICY "Superadmin can view all roles" ON roles
    FOR SELECT USING (current_setting('app.user_permissions', true) ? 'superadmin');

CREATE POLICY "Users can view company roles" ON roles
    FOR SELECT USING (company_id = current_setting('app.current_company_id', true)::UUID);

-- User Roles: Superadmin can read all, company-scoped for users
CREATE POLICY "Superadmin can view all user roles" ON user_roles
    FOR SELECT USING (current_setting('app.user_permissions', true) ? 'superadmin');

CREATE POLICY "Users can view user roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM company_users cu 
            WHERE cu.id = user_roles.user_id 
            AND cu.company_id = current_setting('app.current_company_id', true)::UUID
        )
    );

-- Machines: Superadmin can read all, company-scoped for users
CREATE POLICY "Superadmin can view all machines" ON machines
    FOR SELECT USING (current_setting('app.user_permissions', true) ? 'superadmin');

CREATE POLICY "Users can view company machines" ON machines
    FOR SELECT USING (company_id = current_setting('app.current_company_id', true)::UUID);

-- User Machines: Superadmin can read all, company-scoped for users
CREATE POLICY "Superadmin can view all user machine assignments" ON user_machines
    FOR SELECT USING (current_setting('app.user_permissions', true) ? 'superadmin');

CREATE POLICY "Users can view user machine assignments" ON user_machines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM company_users cu 
            WHERE cu.id = user_machines.user_id 
            AND cu.company_id = current_setting('app.current_company_id', true)::UUID
        )
    );

-- Machine Stats: Superadmin can read all, permission-based for users
CREATE POLICY "Superadmin can view all machine stats" ON machine_stats
    FOR SELECT USING (current_setting('app.user_permissions', true) ? 'superadmin');

CREATE POLICY "Users can view all machine stats" ON machine_stats
    FOR SELECT USING (
        company_id = current_setting('app.current_company_id', true)::UUID
        AND current_setting('app.user_permissions', true) ? 'stats.read_all'
    );

CREATE POLICY "Users can view assigned machine stats" ON machine_stats
    FOR SELECT USING (
        company_id = current_setting('app.current_company_id', true)::UUID
        AND machine_id IN (
            SELECT machine_id FROM user_machines um 
            JOIN company_users cu ON um.user_id = cu.id 
            WHERE cu.auth_user_id = current_setting('app.auth_user_id', true)::UUID
        )
        AND current_setting('app.user_permissions', true) ? 'stats.read_assigned'
    );

-- Allow users to insert machine stats
CREATE POLICY "Users can insert machine stats" ON machine_stats
    FOR INSERT WITH CHECK (true);

COMMIT;
