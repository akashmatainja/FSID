"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Alert, DashboardOverview, HealthHistory, PredictiveHealth } from "@/types";

const POLL_MS = 30_000;

/**
 * Limit-breach alerts from GET /api/v1/alerts, polled every 30 s.
 * `unavailable` is true when the endpoint fails (e.g. the alerts migration
 * hasn't been applied yet), so callers can show a setup hint instead of an error.
 */
export function useAlerts({
  status = "open",
  moduleId,
  machineId,
  limit = 50,
}: {
  status?: "open" | "resolved" | "all";
  moduleId?: string;
  machineId?: string;
  limit?: number;
} = {}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const alive = useRef(true);

  const query = new URLSearchParams({ status, limit: String(limit) });
  if (moduleId) query.set("module_id", moduleId);
  if (machineId) query.set("machine_id", machineId);
  const qs = query.toString();

  const reload = useCallback(async () => {
    try {
      const res = await api.get<Alert[]>(`/api/v1/alerts?${qs}`);
      if (!alive.current) return;
      setAlerts(res || []);
      setUnavailable(false);
    } catch {
      if (alive.current) setUnavailable(true);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    reload();
    const t = setInterval(reload, POLL_MS);
    return () => { alive.current = false; clearInterval(t); };
  }, [reload]);

  const acknowledge = useCallback(async (id: string) => {
    // optimistic
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged_at: new Date().toISOString() } : a)));
    try {
      await api.post(`/api/v1/alerts/${id}/acknowledge`, {});
    } finally {
      reload();
    }
  }, [reload]);

  return { alerts, loading, unavailable, reload, acknowledge };
}

/** Cross-module aggregates (compliance, alert counts) from GET /api/v1/dashboard/overview. */
export function useOverview(since: Date | null) {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const sinceIso = since?.toISOString() ?? "";
  // Round to the minute so a re-render doesn't refetch with a new timestamp
  const key = sinceIso.slice(0, 16);

  const reload = useCallback(async () => {
    try {
      const qs = key ? `?since=${encodeURIComponent(new Date(key + ":00Z").toISOString())}` : "";
      const res = await api.get<DashboardOverview>(`/api/v1/dashboard/overview${qs}`);
      setOverview(res);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    setLoading(true);
    reload();
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  return { overview, loading, unavailable, reload };
}

/** Predictive health scores from GET /api/v1/predictive/health, polled every 30 s. */
export function usePredictiveHealth(since: Date | null, enabled = true) {
  const [health, setHealth] = useState<PredictiveHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const key = since ? since.toISOString().slice(0, 16) : "";

  const reload = useCallback(async () => {
    try {
      const qs = key ? `?since=${encodeURIComponent(new Date(key + ":00Z").toISOString())}` : "";
      setHealth(await api.get<PredictiveHealth>(`/api/v1/predictive/health${qs}`));
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    reload();
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [reload, enabled]);

  return { health, loading, reload };
}

/** Health score history (hourly or daily) from GET /api/v1/predictive/health/history. */
export function useHealthHistory(machineId: string | undefined, days: number, enabled = true) {
  const [history, setHistory] = useState<HealthHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const bucket: "hour" | "day" = days > 14 ? "day" : "hour";

  const reload = useCallback(async () => {
    if (!machineId) return;
    try {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);
      since.setUTCMinutes(0, 0, 0);
      const qs = new URLSearchParams({ machine_id: machineId, since: since.toISOString(), bucket });
      setHistory(await api.get<HealthHistory>(`/api/v1/predictive/health/history?${qs}`));
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [machineId, days, bucket]);

  useEffect(() => {
    if (!enabled || !machineId) { setLoading(false); return; }
    setLoading(true);
    reload();
    const t = setInterval(reload, 5 * 60_000); // snapshots change every 15 min
    return () => clearInterval(t);
  }, [reload, enabled, machineId]);

  return { history, loading, unavailable, bucket, reload };
}

export interface BackfillStatus {
  running: boolean;
  from?: string;
  to?: string;
  hours_total: number;
  hours_done: number;
  rows_written: number;
  started_at?: string;
  finished_at?: string;
  error?: string;
}

/**
 * Superadmin: start/poll the health-history backfill. Polls every 3 s while a
 * run is in progress and calls onFinished once it completes.
 */
export function useHealthBackfill(enabled: boolean, onFinished?: (s: BackfillStatus) => void) {
  const [status, setStatus] = useState<BackfillStatus | null>(null);
  const wasRunning = useRef(false);
  const finishedCb = useRef(onFinished);
  finishedCb.current = onFinished;

  const poll = useCallback(async () => {
    try {
      const st = await api.get<BackfillStatus>("/api/v1/predictive/health/backfill");
      setStatus(st);
      if (wasRunning.current && !st.running) finishedCb.current?.(st);
      wasRunning.current = st.running;
    } catch { /* endpoint missing (e.g. serverless deploy) */ }
  }, []);

  useEffect(() => { if (enabled) poll(); }, [enabled, poll]);
  useEffect(() => {
    if (!enabled || !status?.running) return;
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [enabled, status?.running, poll]);

  const start = useCallback(async (days: number) => {
    try {
      const st = await api.post<BackfillStatus>(`/api/v1/predictive/health/backfill?days=${days}`, {});
      setStatus(st);
      wasRunning.current = st.running;
      if (!st.running) finishedCb.current?.(st);
      return st;
    } catch (e) {
      await poll();
      throw e;
    }
  }, [poll]);

  return { status, start };
}
