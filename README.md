# Energy Monitoring – Multi-Tenant Industrial SaaS Platform

A production-ready, multi-tenant SaaS platform for real-time energy monitoring with strict tenant isolation, role-based access control, and live dashboard updates.

## 🏗️ Architecture

**Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion + Recharts  
**Backend:** Go Fiber + GORM + Supabase Auth (JWT)  
**Database:** Supabase Postgres with Row Level Security (RLS)  
**Real-time:** Supabase Realtime (Postgres CDC)

## ✨ Features

- **Multi-tenant isolation** – Strict company-scoped data access via RLS
- **Role-based permissions** – Granular permission system (users.write, stats.read_all, etc.)
- **Real-time dashboard** – Live machine stats with animated charts and KPI cards
- **Machine management** – CRUD operations for machines with status tracking
- **User & role management** – Assign roles and machines to users
- **Superadmin panel** – Cross-tenant company management
- **Live data simulator** – Generate fake stats for testing realtime features
- **Dark/light mode** – Theme toggle with localStorage persistence
- **Responsive UI** – Mobile-friendly glassmorphism design

## 📁 Project Structure

```
companyUser/
├── backend/              # Go Fiber API
│   ├── config/          # Environment configuration
│   ├── database/        # GORM database connection
│   ├── handlers/        # API route handlers
│   ├── middleware/      # JWT auth & permission middleware
│   ├── models/          # GORM models & DTOs
│   ├── main.go          # Server entry point
│   └── .env.example     # Environment template
│
└── frontend/            # Next.js application
    ├── src/
    │   ├── app/         # App Router pages
    │   │   ├── (app)/   # Authenticated routes
    │   │   │   ├── dashboard/
    │   │   │   ├── machines/
    │   │   │   ├── users/
    │   │   │   ├── roles/
    │   │   │   └── assignments/
    │   │   ├── login/
    │   │   └── superadmin/
    │   ├── components/  # React components
    │   ├── contexts/    # Auth context
    │   ├── hooks/       # Custom hooks (realtime)
    │   ├── lib/         # Utilities & API client
    │   ├── store/       # Zustand realtime store
    │   └── types/       # TypeScript types
    └── .env.local.example
```

## 🚀 Setup Instructions

### Prerequisites

- **Node.js** 18+ and npm
- **Go** 1.21+
- **Supabase** project (already configured at `txodkzqzvyuukpnybrqb.supabase.co`)

### 1. Database Setup

The database schema, RLS policies, and seed data have already been created via Supabase MCP tools. The following are pre-configured:

- ✅ Tables: `companies`, `company_users`, `roles`, `permissions`, `machines`, `machine_stats`, etc.
- ✅ RLS policies enforcing tenant isolation
- ✅ Helper functions: `get_my_company_id()`, `has_permission()`, etc.
- ✅ Demo data: 1 company (Acme Corp), 4 users, 5 machines, 2 days of historical stats

**Demo Credentials:**
- **Admin:** `admin@acmecorp.com` / `Admin1234!` (full access)
- **Operator:** `bob@acmecorp.com` / `User1234!` (assigned machines only)
- **Analyst:** `carol@acmecorp.com` / `User1234!` (read-only, all machines)
- **Superadmin:** `superadmin@platform.com` / `Super1234!` (cross-tenant access)

**Supabase Project:** `https://byhnyrhltrqjzqhsajli.supabase.co`

### 2. Backend Setup

```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env and add your Supabase JWT secret
# Get it from: Supabase Dashboard → Settings → API → JWT Secret
nano .env

# Install dependencies
go mod tidy

# Run the server
go run main.go
```

The backend will start on `http://localhost:8080`

**Environment Variables:**
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.byhnyrhltrqjzqhsajli.supabase.co:5432/postgres
SUPABASE_URL=https://byhnyrhltrqjzqhsajli.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aG55cmhsdHJxanpxaHNhamxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDM2MjksImV4cCI6MjA4ODAxOTYyOX0.qex_-KP-vAF6TZ6e92xMuNdqm0SHfkoxGI3DVY5fUyI
SUPABASE_JWT_SECRET=your-jwt-secret-from-dashboard
PORT=8080
```

### 3. Frontend Setup

```bash
cd frontend

# Copy environment template
cp .env.local.example .env.local

# Install dependencies
npm install

# Run development server
npm run dev
```

The frontend will start on `http://localhost:3000`

**Environment Variables:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://byhnyrhltrqjzqhsajli.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aG55cmhsdHJxanpxaHNhamxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDM2MjksImV4cCI6MjA4ODAxOTYyOX0.qex_-KP-vAF6TZ6e92xMuNdqm0SHfkoxGI3DVY5fUyI
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 4. Enable Supabase Realtime

To enable live dashboard updates:

1. Go to **Supabase Dashboard** → **Database** → **Replication**
2. Enable replication for the `machine_stats` table
3. Refresh the dashboard page to start receiving live updates

## 🎯 Usage

### Login & Navigation

1. Navigate to `http://localhost:3000/login`
2. Sign in with one of the demo credentials
3. Explore the sidebar navigation:
   - **Dashboard** – Real-time KPI cards, charts, and live feed
   - **Machines** – View, create, edit, delete machines
   - **Users** – Manage company users
   - **Roles** – Create roles with permissions
   - **Assignments** – Assign roles and machines to users
   - **Companies** (Superadmin only) – View all companies

### Testing Real-time Features

1. Login as **admin@acmecorp.com**
2. Go to **Dashboard**
3. Click **"Run Simulator"** button
4. Watch the charts and live feed update in real-time
5. Open a second browser window as a different user to see multi-user realtime

### API Endpoints

**Authentication:** All API routes require `Authorization: Bearer <jwt>` header

**Dashboard:**
- `GET /api/v1/dashboard/summary` – Machine counts, total stats, latest values

**Machines:**
- `GET /api/v1/machines` – List all company machines
- `GET /api/v1/machines/:id` – Get machine details
- `POST /api/v1/machines` – Create machine (requires `machines.write`)
- `PUT /api/v1/machines/:id` – Update machine (requires `machines.write`)
- `DELETE /api/v1/machines/:id` – Delete machine (requires `machines.write`)
- `GET /api/v1/machines/:id/stats` – Get machine stats (filtered by permissions)
- `POST /api/v1/machines/:id/stats` – Ingest stat (requires `stats.write`)

**Users:**
- `GET /api/v1/users/me` – Get current user with roles & permissions
- `GET /api/v1/users` – List company users
- `GET /api/v1/users/:id` – Get user details
- `POST /api/v1/users` – Create user (requires `users.write`)
- `PUT /api/v1/users/:id` – Update user (requires `users.write`)

**Roles:**
- `GET /api/v1/roles` – List company roles
- `GET /api/v1/permissions` – List all available permissions
- `POST /api/v1/roles` – Create role (requires `roles.write`)
- `PUT /api/v1/roles/:id` – Update role (requires `roles.write`)
- `DELETE /api/v1/roles/:id` – Delete role (requires `roles.write`)

**Assignments:**
- `POST /api/v1/assignments/roles` – Assign role to user (requires `roles.write`)
- `DELETE /api/v1/assignments/roles` – Remove role from user (requires `roles.write`)
- `POST /api/v1/assignments/machines` – Assign machine to user (requires `machines.write`)
- `DELETE /api/v1/assignments/machines` – Remove machine from user (requires `machines.write`)

**Development:**
- `POST /api/v1/dev/simulate?machine_id=&seconds=30&rate=5` – Generate fake stats

## 🔒 Security

- **JWT validation** – All routes validate Supabase JWTs
- **Tenant isolation** – RLS policies enforce company_id scoping
- **Permission checks** – Middleware enforces granular permissions
- **No client trust** – Backend derives company_id from JWT, never from client
- **Prepared statements** – GORM prevents SQL injection
- **CORS configured** – Restrict origins in production

## 🛠️ Tech Stack Details

**Frontend:**
- Next.js 14 (App Router, React Server Components)
- TypeScript (strict mode)
- Tailwind CSS + custom design system
- Framer Motion (animations)
- Recharts (charts)
- Zustand (realtime state)
- Supabase JS Client (auth & realtime)
- Lucide React (icons)
- Sonner (toast notifications)

**Backend:**
- Go Fiber (HTTP framework)
- GORM (ORM)
- JWT validation (golang-jwt/jwt)
- Supabase Auth integration
- PostgreSQL driver

**Database:**
- Supabase Postgres
- Row Level Security (RLS)
- Realtime (Postgres CDC)
- UUID primary keys
- JSONB metadata columns

## 📊 Database Schema

**Key Tables:**
- `companies` – Tenant organizations
- `company_users` – Users scoped to companies
- `roles` – Company-specific roles
- `permissions` – Global permission definitions
- `role_permissions` – Many-to-many role ↔ permission
- `user_roles` – Many-to-many user ↔ role
- `machines` – Company machines
- `user_machines` – Machine assignments
- `machine_stats` – Time-series metrics (temperature, rpm, vibration, energy, pressure)

**RLS Policies:**
- All queries automatically filtered by `company_id`
- Stats access controlled by `stats.read_all` vs `stats.read_assigned`
- Write operations require specific permissions

## 🎨 UI Features

- **Glassmorphism design** – Modern frosted glass aesthetic
- **Dark/light mode** – Persistent theme toggle
- **Responsive layout** – Mobile-first design
- **Animated transitions** – Smooth Framer Motion animations
- **Live indicators** – Real-time connection status
- **Collapsible sidebar** – Space-efficient navigation
- **Modal forms** – Inline CRUD operations
- **Toast notifications** – User feedback for actions

## 🐛 Troubleshooting

**Backend won't start:**
- Verify `DATABASE_URL` and `SUPABASE_JWT_SECRET` in `.env`
- Run `go mod tidy` to install dependencies
- Check port 8080 is not in use

**Frontend won't start:**
- Run `npm install` to install dependencies
- Verify `.env.local` has correct Supabase keys
- Check port 3000 is not in use

**Realtime not working:**
- Enable replication for `machine_stats` in Supabase Dashboard
- Check browser console for WebSocket errors
- Verify user has permission to read stats

**Login fails:**
- Verify demo users exist in `auth.users` table
- Check `SUPABASE_JWT_SECRET` matches dashboard value
- Ensure backend is running and accessible

## 📝 License

MIT

## 👥 Demo Users Summary

| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| admin@acmecorp.com | Admin1234! | Company Admin | Full company access |
| bob@acmecorp.com | User1234! | Operator | Assigned machines only |
| carol@acmecorp.com | User1234! | Analyst | Read all stats |
| superadmin@platform.com | Super1234! | Superadmin | Cross-tenant access |

---

**Built with ❤️ using Next.js, Go Fiber, and Supabase**
