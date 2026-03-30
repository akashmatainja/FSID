-- ========================================
-- Basic Data Setup - Permissions, Roles, Companies
-- ========================================

-- 1. Insert default permissions
INSERT INTO permissions (key, description) VALUES
('dashboard.read', 'View dashboard'),
('machines.read', 'View machines'),
('machines.write', 'Create/edit machines'),
('users.read', 'View users'),
('users.write', 'Create/edit users'),
('roles.read', 'View roles'),
('roles.write', 'Create/edit roles'),
('stats.read_all', 'Read all machine stats'),
('stats.read_assigned', 'Read assigned machine stats'),
('stats.write', 'Write machine stats'),
('companies.read', 'View companies'),
('companies.write', 'Edit companies'),
('superadmin', 'Superadmin access');

-- 2. Create system company for superadmin
INSERT INTO companies (id, name, slug, status) VALUES
('00000000-0000-0000-0000-000000000000', 'System', 'system', 'active');

-- 3. Create demo company
INSERT INTO companies (name, slug, status) VALUES
('Acme Corp', 'acme-corp', 'active');

-- 4. Create superadmin role (in system company)
INSERT INTO roles (company_id, name, description) VALUES
('00000000-0000-0000-0000-000000000000', 'Superadmin', 'Full system access');

-- 5. Create company roles (for Acme Corp)
INSERT INTO roles (company_id, name, description) VALUES
((SELECT id FROM companies WHERE slug = 'acme-corp'), 'Company Admin', 'Full company access'),
((SELECT id FROM companies WHERE slug = 'acme-corp'), 'Operator', 'Machine operator'),
((SELECT id FROM companies WHERE slug = 'acme-corp'), 'Analyst', 'Read-only analyst');

-- 6. Assign ALL permissions to superadmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.company_id = '00000000-0000-0000-0000-000000000000';

-- 7. Assign permissions to company roles
-- Company Admin gets most permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.company_id = (SELECT id FROM companies WHERE slug = 'acme-corp')
AND r.name = 'Company Admin'
AND p.key IN ('dashboard.read', 'machines.read', 'machines.write', 'users.read', 'users.write', 'roles.read', 'roles.write', 'stats.read_all', 'stats.write');

-- Operator gets limited permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.company_id = (SELECT id FROM companies WHERE slug = 'acme-corp')
AND r.name = 'Operator'
AND p.key IN ('dashboard.read', 'machines.read', 'stats.read_assigned', 'stats.write');

-- Analyst gets read-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.company_id = (SELECT id FROM companies WHERE slug = 'acme-corp')
AND r.name = 'Analyst'
AND p.key IN ('dashboard.read', 'machines.read', 'stats.read_all');

COMMIT;
