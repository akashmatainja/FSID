# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Multi-tenant industrial energy-monitoring SaaS. Two independent apps share one Supabase project:

- `backend/` — Go 1.24 + Fiber v2 + GORM (Postgres via Supabase). Module path `github.com/companyuser/backend`.
- `frontend/` — Next.js 14 App Router + TypeScript + Tailwind + Zustand + Recharts. Path alias `@/*` → `src/*`.
- `gateway/` — Go OPC UA edge gateway (separate module, `github.com/companyuser/gateway`): runs on a plant PC, reads the plant OPC UA server, pushes to the backend. See `gateway/README.md`.
- `opcua_local_demo/` — Python (`asyncua`) OPC UA server/client simulators for local data-flow testing.
- Root `*.sql` files are hand-applied Supabase migrations/fixes (schema, RLS, superadmin, subdivisions, etc.); root `*.py` scripts are one-off codemods for frontend files. There is no migration runner.

## Commands

Backend (from `backend/`, needs `.env` — see `.env.example`):
```bash
go mod tidy
go run .            # prefer over `go run main.go`: package main also includes simulator.go and opcua_client.go
go build -o main .  # Railway deploy runs ./main
go vet ./...
```
Required env vars (process exits if missing): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`. Optional: `PORT` (8080), `STUN_URL`/`TURN_*`, `OPCUA_ENDPOINT`/`OPCUA_USERNAME`/`OPCUA_PASSWORD`.

Frontend (from `frontend/`, needs `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`):
```bash
npm run dev     # binds 0.0.0.0:3000 (reachable from other LAN devices)
npm run build
npm run lint
```

There are no automated tests in either app.

Gateway (from `gateway/`): `go build -o fsid-gateway.exe .`; `fsid-gateway -config gateway.json -once` reads every tag once without sending. End-to-end test without the DB: run `opcua_local_demo/opcua_server.py` (nodes `ns=2;s=Temperature`, `ns=2;s=Voltage_V`, …) and point the gateway at a mock of `/gateway/v1/*`.

OPC UA local demo: `pip install asyncua websockets`, then `python opcua_local_demo/opcua_server.py` and `python opcua_local_demo/opcua_client.py` (see its README).

## Architecture

### Auth and tenancy
- Frontend logs in via Supabase Auth (`src/lib/supabase.ts`, `src/contexts/AuthContext.tsx`); `src/lib/api.ts` attaches the Supabase access token as `Authorization: Bearer` to every backend call.
- `backend/middleware/auth.go` `JWTAuth` verifies the token (ES256 via a PEM public key in `SUPABASE_JWT_SECRET` — literal `\n` are converted — falling back to HMAC), then loads `company_users` → `user_roles` → `role_permissions` → `permissions` and stores a `models.AuthContext` (`CompanyID`, `Permissions` map, `CompanyUser`) in `c.Locals("auth")`. Handlers read it with `middleware.GetAuth(c)`.
- Tenant isolation is enforced in Go handlers by scoping queries to `auth.CompanyID` — the backend connects directly to Postgres, so Supabase RLS does not protect backend queries. Never take `company_id` from the client on protected routes.
- Superadmin is identified by a hard-coded auth UUID in `JWTAuth`, gets a fixed all-permissions map and `CompanyID = uuid.Nil`. When adding a new permission key, add it to that map and to `database/seed.go`.
- Route-level authorization uses `middleware.RequirePermission("<resource>.write")`; reads are generally unguarded and filtered inside handlers (e.g. `stats.read_all` vs `stats.read_assigned`).

### Two backend entry points — keep routes in sync
- `backend/main.go` — long-running server (Railway, local dev). Also hosts WebSockets and hubs.
- `backend/api/index.go` — Vercel serverless adapter (`vercel.json`). It duplicates the REST route table but has **no** WebSocket/WebRTC/hub/OPC UA routes. New REST routes must be added to both files.

### Database
- `database/db.go` opens GORM with `PrepareStmt: false`, a **single** pooled connection, and runs `DEALLOCATE ALL` on startup — this works around prepared-statement conflicts with the Supabase pooler. Don't raise pool size or enable prepared statements without addressing that.
- No AutoMigrate in the startup path; schema changes go into a new root-level `.sql` file applied in Supabase. GORM models live in `backend/models/models.go`; request/response DTOs in `models/types.go`.

### Real-time machine data
- `hub/hub.go`: `GlobalHub` fans out `MetricPayload`s to WebSocket clients at `GET /ws?machine_id=<uuid|all>`.
- Data sources feeding the hub: the edge gateway (`POST /gateway/v1/ingest`, see below), legacy `POST /opcua/ingest` (now behind `middleware.GatewayAuth` → `handlers.IngestOPCUAData`), the in-process OPC UA client (`opcua_client.go`, `StartOPCUAClient`, commented out in `main.go`; production uses the gateway), and the simulator (`simulator.go`, `StartOPCUASimulator`, buffers and flushes to DB periodically). `POST /api/v1/dev/simulate` is the older stat simulator.
- Frontend: `components/providers/OPCUAProvider.tsx` holds a global singleton `/ws?machine_id=all` socket feeding `store/useRealtimeStore.ts`; `hooks/useWebSocketMachineStats.ts` is the per-machine socket used on machine detail pages; `hooks/useRealtime.ts` uses Supabase Realtime (Postgres CDC on `machine_stats`). WS URL is derived from `NEXT_PUBLIC_API_URL` (http→ws).
- WebSocket routes in `main.go` are registered before all middleware on purpose; keep new WS routes there too.

### Remote Camera / Expert Guided Remote Maintenance — DISABLED in this app
This module now lives on a separate site. Its code is kept but switched off:
- Backend: the signaling hub start and the `/rtc` and `/webrtc/ice` routes are commented out in `main.go` (`hub/signaling.go` and `handlers/webrtc.go` remain).
- Module lists: `handlers.HiddenModuleCode` (`remote_maintenance`) is filtered out of `ListModules`, `ListActiveModules`, and `GetMachineModules`.
- Frontend: pages renamed to `app/_camera/` and `app/(app)/_remote-camera/` (the `_` prefix makes Next.js skip them as routes); the sidebar entry and `remote_maintenance` style entries are commented out. `src/lib/webrtc.ts` is unused.

### Frontend layout
- `app/(app)/` is the authenticated shell (`layout.tsx` with `Sidebar`/`TopNav`); each subfolder is a CRUD page for a backend resource (companies, branches, subdivisions, machines, modules, users, roles, assignments, superadmin, settings).
- "Modules" (energy monitoring, predictive maintenance — specs in `docs/`; remote maintenance is hidden, see above) are per-company toggleable features with configurable metrics, assigned to machines via `/machines/:id/modules`.

### Monitoring module pages
- `src/lib/modules.ts` is the registry: it maps a module `code` (matched by regex: `energy`, `environment`, `predict`) to a route (`/energy`, `/environmental`, `/predictive`), sidebar label, icon and preferred primary metric. Add a module page by adding an entry there plus a one-line `app/(app)/<slug>/page.tsx` that renders `ModulePage`.
- `components/providers/ModuleAccessProvider.tsx` decides access: a module is visible when at least one machine the user can monitor has it assigned. Users with `superadmin` or `stats.read_all` monitor every machine; others only their `machine_assignments` (note `/api/v1/machines` itself returns all company machines, so this filtering is client-side). The sidebar "Modules" section, the module pages and the dashboard all read from this provider.
- `components/modules/ModulePage.tsx` is the shared page; the selected machine lives in `?machine=<code>`. The dashboard (`app/(app)/dashboard`) is a cross-module "Plant overview" built from the same provider.
- Chart building blocks live in `components/charts/` (`TrendChart`, `RankedBars`, `RangeOverview`, `ActivityFeed`, `moduleData.ts` helpers, `palette.ts` for theme-aware series colours).
### Current data source: simulator (gateway awaiting client approval)
- `simulator.go` (`StartOPCUASimulator`, started in `main.go` when `SIMULATOR_ENABLED` ≠ `false`, default on) broadcasts simulated values every 1 s, stores one sample per metric per minute in `machine_stats`, runs alerts, and reloads machines every 5 min. Machines assigned to a gateway are skipped.
- Demo OPC UA connection: `opcua_client.go` (`StartOPCUAClient`) reads `OPCUA_ENDPOINT` (default the ABExON test server, security None) for machines whose codes are in `OPCUA_DEMO_MACHINES`: 1 s live broadcast, a stored sample every 10 s, reload every 60 s. Node per metric: `machine_metric_nodes` override → metric template → `defaultChannelNodes` (ABExON `ns=2;i=2003+5*ch`). The simulator skips those metrics via `isRealMetric`. ABExON channels currently return test counters, not sensor values.
- Gateway UI is hidden behind `NEXT_PUBLIC_ENABLE_GATEWAY=true` (`src/lib/features.ts`); backend gateway routes stay registered. To go live: set `NEXT_PUBLIC_ENABLE_GATEWAY=true` (Vercel) and, once all machines are on gateways, `SIMULATOR_ENABLED=false` (Railway).

### OPC UA edge gateways (built, not yet enabled)
- Schema: `add_opcua_gateways.sql` — `opcua_gateways` (API key stored as SHA-256 only), `machine_opcua` (machine → gateway), `machine_metric_nodes` (per-machine node ID). `module_metrics.node_id` is a template (`{machine_code}`, `{machine_name}`, `{metric_code}`); per-machine overrides win; empty = not read. Resolution lives in `handlers/gateways.go` (`machineMetricNodes`).
- Gateway API (`/gateway/v1/config|ingest|status`, `middleware.GatewayAuth`, key in `X-Gateway-Key`) is registered before the JWT group in both `main.go` and `api/index.go`. Ingest only accepts machines assigned to that gateway, stores, broadcasts readings < 2 min old to the hub (nil-safe on Vercel) and calls `alerts.EvaluateStats`.
- Admin API: `/api/v1/gateways…` (writes need `machines.write`), `GET/PUT /api/v1/machines/:id/opcua`. Frontend: `app/(app)/gateways`, `components/machines/OpcuaMappingCard.tsx` on the machine page, node template field on the Modules page.
- The agent (`gateway/`) polls config every 60 s (cached to disk), reads in 500-node batches with reconnect backoff, buffers to `gateway-buffer.jsonl` when offline, and posts a status report every 30 s. Keep its `RemoteConfig`/`Reading` JSON in sync with `handlers/gateways.go`.

### Metric limits and alerts
- Schema: `add_metric_limits_and_alerts.sql` (root) adds `warn_min/warn_max/crit_min/crit_max` to `module_metrics` and creates `alerts` (one open alert per machine+metric+module, enforced by a partial unique index). Must be applied in Supabase before the backend can create metrics or alerts.
- `backend/alerts/` is the engine. Every ingest path (`IngestMachineStat`, `IngestOPCUAData`, `Simulate`, `opcua_client.go`, `simulator.go`) calls `alerts.Evaluate`/`EvaluateStats` after storing readings; a worker started in `main.go` opens, escalates and resolves alerts. On Vercel (`api/index.go`, no `Start()`) evaluation runs inline. Limits are cached per machine for 60 s; routes that change modules/metrics/assignments are wrapped in `handlers.InvalidateAlertRules`. Any new ingest path must call the engine too.
- API: `GET /api/v1/alerts`, `POST /api/v1/alerts/:id/acknowledge`, `GET /api/v1/dashboard/overview` (per-module compliance and alert counts). All use `handlers.machineScope`, which mirrors the frontend access rule.
- Predictive health score: `backend/health/` holds the pure scoring maths (unit-tested: `go test ./health/`); `handlers/health.go` serves `GET /api/v1/predictive/health` by bucketing `machine_stats` for metrics of the module whose code contains `predict`. Only metrics with limits contribute; no limits → `score: null`. Change weights/caps in `health.go` and keep the formula text in `HealthBreakdown.tsx` in sync. Scoring queries live in `health/compute.go` (`health.Compute`), shared by the API and the snapshot job.
- Health history: `add_health_snapshots.sql` creates `machine_health_snapshots` (one row per machine per hour, unique on `machine_id, captured_at`). `health.StartSnapshots()` (started in `main.go`, not on Vercel) recomputes every 15 min, upserts the current hour and prunes rows older than ~13 months. `GET /api/v1/predictive/health/history?machine_id=&since=&bucket=hour|day` serves it.
- Backfill: `health/backfill.go`, triggered by superadmins via `POST /api/v1/predictive/health/backfill?days=N` (progress: `GET` same path; button on the Predictive history card). It replays each past hour through `health.Compute` as of the hour's end and inserts with `ON CONFLICT DO NOTHING`, so live snapshots are never overwritten. One run at a time; pauses between hours because the DB pool is a single connection. Registered only in `main.go`.
- Data logs: `handlers/logs.go` serves `GET /api/v1/logs/readings` (paged raw `machine_stats` for a `from`/`to` window, max 366 days; filters `machine_id`, `module_id`, `metric_key`, `status`) and `/logs/readings/export` (CSV, max 100k rows), scoped with `machineScope`. The SQL status `CASE` mirrors `alerts.classify`, so keep the two in sync. Page: `app/(app)/logs`; it downloads through `api.download` because the export needs the auth header.
- Frontend: `hooks/useMonitoring.ts` (`useAlerts`, `useOverview`, `usePredictiveHealth`, 30 s polling), `components/alerts/AlertsList.tsx`, `components/charts/ThresholdStatus.tsx`; limits are edited on the superadmin Modules page. Chart reference lines prefer the metric's limit, then rated power, then the range average.

## Other docs
`DEPLOYMENT.md`, `VERCEL_DEPLOYMENT.md`, `LIVE_OPCUA_INTEGRATION_GUIDE.md`, `ENERGY_MONITORING_UPDATES.md`, and `docs/*_MODULE.md` hold deployment steps and module specs. `README.md` lists demo credentials.
