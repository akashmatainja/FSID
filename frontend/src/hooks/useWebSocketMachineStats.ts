import { useEffect, useState, useRef, useCallback } from "react";
import type { MachineStat } from "@/types";

interface WsMetric {
  machine_id: string;
  company_id: string;
  metric_key: string;
  metric_value: number;
  timestamp: string;
  unit: string;
  source: string;
}

/**
 * Connects to the Go backend WebSocket at /ws?machine_id=<id>
 * and streams live OPC UA metrics.
 *
 * - Auto-reconnects every 3 s on disconnect.
 * - Keeps the last 200 readings in memory to avoid unbounded growth.
 * - Falls back gracefully when the backend is unreachable.
 */
export function useWebSocketMachineStats(machineId: string) {
  const [stats, setStats] = useState<MachineStat[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (typeof window === "undefined" || !machineId || !mountedRef.current) return;

    // Derive WebSocket URL from NEXT_PUBLIC_API_URL (http→ws, https→wss)
    const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080")
      .replace(/^https/, "wss")
      .replace(/^http/, "ws");
    const url = `${base}/ws?machine_id=${machineId}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setIsConnected(true);
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
      };

      ws.onmessage = (e: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const incoming: WsMetric[] = JSON.parse(e.data);
          const converted: MachineStat[] = incoming.map((m) => ({
            id: crypto.randomUUID(),
            company_id: m.company_id,
            machine_id: m.machine_id,
            ts: m.timestamp,
            metric_key: m.metric_key,
            metric_value: m.metric_value,
            meta: { unit: m.unit, source: m.source },
          }));

          setStats((prev) => {
            const combined = [...prev, ...converted];
            return combined.slice(-200); // keep last 200 readings
          });
        } catch (err) {
          console.error("[WS] parse error", err);
        }
      };

      ws.onerror = () => {
        if (mountedRef.current) setIsConnected(false);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        // Reconnect after 3 seconds
        reconnectRef.current = setTimeout(connect, 3000);
      };
    } catch (err) {
      console.error("[WS] failed to open", err);
      reconnectRef.current = setTimeout(connect, 3000);
    }
  }, [machineId]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  return { stats, isConnected };
}
