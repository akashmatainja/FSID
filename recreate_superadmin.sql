-- Recreate Superadmin role and assign all permissions
BEGIN;

-- Create Superadmin role if it doesn't exist
INSERT INTO roles (id, company_id, name, description, created_at)
VALUES (
    '70c4bbd6-2605-48a8-ac17-3e9ed9c642dc',
    '00000000-0000-0000-0000-000000000000',
    'Superadmin',
    'Full system access',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Assign all permissions to superadmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    '70c4bbd6-2605-48a8-ac17-3e9ed9c642dc' as role_id,
    id as permission_id 
FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign superadmin role to superadmin user
INSERT INTO user_roles (user_id, role_id)
SELECT 
    u.id as user_id,
    '70c4bbd6-2605-48a8-ac17-3e9ed9c642dc' as role_id
FROM company_users u 
WHERE u.auth_user_id = 'e7033950-b3cf-404b-bc56-4d21f02bec07'
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;
