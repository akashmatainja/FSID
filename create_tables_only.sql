-- ========================================
-- MachineIQ Database Schema - Tables Only
-- ========================================

-- 1. Companies table (tenants)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Permissions table (global permissions)
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL
);

-- 3. Roles table (company-specific roles)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Role permissions junction table
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 5. Company users table
CREATE TABLE company_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. User roles junction table
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES company_users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- 7. Machines table
CREATE TABLE machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    location TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. User machines junction table (assignments)
CREATE TABLE user_machines (
    user_id UUID NOT NULL REFERENCES company_users(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, machine_id)
);

-- 9. Machine stats table (time-series data)
CREATE TABLE machine_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ DEFAULT now(),
    metric_key TEXT NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    meta JSONB DEFAULT '{}'
);

-- 10. Indexes for performance
CREATE INDEX idx_company_users_auth_user_id ON company_users(auth_user_id);
CREATE INDEX idx_company_users_company_id ON company_users(company_id);
CREATE INDEX idx_machines_company_id ON machines(company_id);
CREATE INDEX idx_machine_stats_company_id ON machine_stats(company_id);
CREATE INDEX idx_machine_stats_machine_id ON machine_stats(machine_id);
CREATE INDEX idx_machine_stats_ts ON machine_stats(ts);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_machines_user_id ON user_machines(user_id);

-- 11. Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_stats ENABLE ROW LEVEL SECURITY;
