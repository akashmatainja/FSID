"use client";
// Real-time data is now provided by OPCUAProvider (WebSocket) mounted in the app layout.
// The global useRealtimeStore is fed directly by that provider.
// This hook is kept for API compatibility but is intentionally a no-op.
export function useRealtimeStats(
  _companyId: string | null,
  _allowedMachineIds: string[] | null
) {
  // no-op: OPCUAProvider in layout.tsx handles the WebSocket subscription
}
