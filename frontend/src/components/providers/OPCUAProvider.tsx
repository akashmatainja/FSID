"use client";
import { useEffect } from "react";
import { useRealtimeStore } from "@/store/useRealtimeStore";

// Global singleton WebSocket — lives outside React lifecycle
let globalWS: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isInitialized = false;

function connectToWS() {
  if (typeof window === "undefined") return;
  if (globalWS && (globalWS.readyState === WebSocket.CONNECTING || globalWS.readyState === WebSocket.OPEN)) {
    console.log("[OPCUAProvider] WebSocket already connecting/connected, skipping");
    return;
  }

  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080")
    .replace(/^https/, "wss")
    .replace(/^http/, "ws");

  console.log("[OPCUAProvider] connecting to", `${base}/ws?machine_id=all`);

  try {
    const ws = new WebSocket(`${base}/ws?machine_id=all`);
    globalWS = ws;

    ws.onopen = () => {
      console.log("[OPCUAProvider] connected");
      useRealtimeStore.getState().setLive(true);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (e: MessageEvent) => {
      try {
        const incoming = JSON.parse(e.data) as Array<{
          machine_id: string;
          company_id: string;
          metric_key: string;
          metric_value: number;
          timestamp: string;
          unit: string;
          source: string;
        }>;
        const { addStat } = useRealtimeStore.getState();
        incoming.forEach((m) => {
          addStat({
            id: crypto.randomUUID(),
            company_id: m.company_id,
            machine_id: m.machine_id,
            ts: m.timestamp,
            metric_key: m.metric_key,
            metric_value: m.metric_value,
            meta: { unit: m.unit, source: m.source },
          });
        });
      } catch (err) {
        console.error("[OPCUAProvider] parse error", err);
      }
    };

    ws.onerror = (err) => {
      console.error("[OPCUAProvider] WebSocket error:", err);
      console.error("[OPCUAProvider] WebSocket readyState:", ws?.readyState);
      console.error("[OPCUAProvider] WebSocket URL:", ws?.url);
      useRealtimeStore.getState().setLive(false);
    };

    ws.onclose = () => {
      console.log("[OPCUAProvider] disconnected, reconnecting in 3s…");
      useRealtimeStore.getState().setLive(false);
      globalWS = null;
      reconnectTimer = setTimeout(connectToWS, 3000);
    };
  } catch (err) {
    console.error("[OPCUAProvider] failed to open", err);
    reconnectTimer = setTimeout(connectToWS, 3000);
  }
}

/**
 * OPCUAProvider — mounts once in the app layout.
 *
 * Opens a single WebSocket to /ws?machine_id=all which receives data
 * for ALL machines and feeds it into the global useRealtimeStore.
 * Every page that reads from useRealtimeStore gets live OPC UA data
 * automatically without opening its own connection.
 *
 * Uses a global singleton WebSocket that lives outside React's lifecycle
 * to avoid Strict Mode double-invocation issues.
 */
export function OPCUAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (isInitialized) return;
    isInitialized = true;

    console.log("[OPCUAProvider] initializing global WebSocket connection");
    connectToWS();

    return () => {
      // Don't close on unmount — let the global connection persist
      console.log("[OPCUAProvider] component unmounted (WebSocket stays alive)");
    };
  }, []); // runs once on mount

  return <>{children}</>;
}
