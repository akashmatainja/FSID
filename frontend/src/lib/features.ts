/**
 * Feature switches (set in .env.local / Vercel, then rebuild).
 *
 * GATEWAY_ENABLED — OPC UA edge gateway screens (Gateways page, the machine
 * page's "Live data source" card, node templates on the Modules page). Off
 * until the client approves the gateway; meanwhile the backend simulator
 * (SIMULATOR_ENABLED) supplies demo data. Enable with NEXT_PUBLIC_ENABLE_GATEWAY=true.
 */
export const GATEWAY_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GATEWAY === "true";
