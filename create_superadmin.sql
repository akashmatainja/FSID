-- ========================================
-- Create Superadmin User
-- ========================================

-- First, create the auth user (you'll need to do this via Supabase Dashboard or API)
-- For now, let's assume the auth user exists and create the company_user record

-- Create company_user record for superadmin
INSERT INTO company_users (
    id,
    company_id, 
    auth_user_id,
    name,
    email,
    status
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000', -- System company
    'SUPERADMIN_AUTH_USER_ID', -- Replace with actual auth user ID
    'Platform Superadmin',
    'superadmin@platform.com',
    'active'
) RETURNING id;

-- Assign superadmin role to the user
-- Note: This assumes we know the company_user ID from the insert above
-- You'll need to replace the user_id with the actual ID returned

-- For now, let's create a placeholder that you can update:
-- INSERT INTO user_roles (user_id, role_id)
-- SELECT 
--     (SELECT id FROM company_users WHERE email = 'superadmin@platform.com'),
--     (SELECT id FROM roles WHERE name = 'Superadmin' AND company_id = '00000000-0000-0000-0000-000000000000');

COMMIT;

-- ========================================
-- Instructions:
-- 1. First create the auth user via Supabase Dashboard:
--    - Go to Authentication → Users → Add user
--    - Email: superadmin@platform.com
--    - Password: Super1234!
--    - Disable email confirmation
--
-- 2. Get the auth user ID from the dashboard
--
-- 3. Update this script with the actual auth_user_id
--
-- 4. Run this script to create the company_user record
--
-- 5. Run the role assignment (uncomment and update user_id)
-- ========================================
