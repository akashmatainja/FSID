-- ========================================
-- Complete Superadmin User Setup
-- ========================================

-- First, let's check if the auth user exists
SELECT id, email, created_at FROM auth.users WHERE email = 'superadmin@platform.com';

-- Create company_user record for superadmin
INSERT INTO company_users (
    company_id, 
    auth_user_id,
    name,
    email,
    status
) VALUES (
    '00000000-0000-0000-0000-000000000000', -- System company
    'e7033950-b3cf-404b-bc56-4d21f02bec07', -- Auth user ID from previous creation
    'Platform Superadmin',
    'superadmin@platform.com',
    'active'
) RETURNING id, email, company_id;

-- Get the superadmin role ID
SELECT id, name FROM roles WHERE name = 'Superadmin' AND company_id = '00000000-0000-0000-0000-000000000000';

-- Assign superadmin role to the user
INSERT INTO user_roles (user_id, role_id)
SELECT 
    cu.id,
    r.id
FROM company_users cu
CROSS JOIN roles r
WHERE cu.email = 'superadmin@platform.com'
AND r.name = 'Superadmin'
AND r.company_id = '00000000-0000-0000-0000-000000000000'
RETURNING user_id, role_id;

-- Verify the complete setup
SELECT 
    cu.id as company_user_id,
    cu.email,
    cu.name,
    c.name as company_name,
    r.name as role_name,
    array_agg(p.key) as permissions
FROM company_users cu
JOIN companies c ON cu.company_id = c.id
JOIN user_roles ur ON cu.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE cu.email = 'superadmin@platform.com'
GROUP BY cu.id, cu.email, cu.name, c.name, r.name;

COMMIT;
