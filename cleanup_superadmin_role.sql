-- Clean up superadmin role and system company
-- This removes the database-based superadmin approach in favor of hardcoded superadmin

BEGIN;

-- Delete superadmin role assignments
DELETE FROM user_roles WHERE role_id IN (
    SELECT id FROM roles WHERE name = 'Superadmin'
);

-- Delete superadmin role
DELETE FROM roles WHERE name = 'Superadmin';

-- Optionally: Delete system company (only if no other data depends on it)
-- DELETE FROM companies WHERE id = '00000000-0000-0000-0000-000000000000';

-- Remove superadmin from company_users (if they exist there)
DELETE FROM company_users WHERE auth_user_id = 'e7033950-b3cf-404b-bc56-4d21f02bec07';

COMMIT;

-- Notes:
-- 1. Superadmin permissions are now hardcoded in middleware based on auth_user_id
-- 2. Regular users get permissions via their assigned roles
-- 3. This approach is cleaner and more secure for a single superadmin setup
