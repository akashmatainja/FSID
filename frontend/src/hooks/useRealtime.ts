"use client";
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeStore } from "@/store/useRealtimeStore";
import type { MachineStat } from "@/types";

export function useRealtimeStats(
  companyId: string | null,
  allowedMachineIds: string[] | null // null = all machines
) {
  const addStat = useRealtimeStore((s) => s.addStat);
  const setLive = useRealtimeStore((s) => s.setLive);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingRef = useRef<MachineStat[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!companyId) return;

    function flush() {
      if (pendingRef.current.length > 0) {
        pendingRef.current.forEach(addStat);
        pendingRef.current = [];
      }
      rafRef.current = null;
    }

    const channel = supabase
      .channel(`machine_stats:${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "machine_stats",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const stat = payload.new as MachineStat;
          // Filter client-side if allowed list is provided
          if (
            allowedMachineIds === null ||
            allowedMachineIds.includes(stat.machine_id)
          ) {
            pendingRef.current.push(stat);
            // Batch via requestAnimationFrame
            if (!rafRef.current) {
              rafRef.current = requestAnimationFrame(flush);
            }
          }
        }
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      supabase.removeChannel(channel);
      setLive(false);
    };
  }, [companyId, JSON.stringify(allowedMachineIds), addStat, setLive]); // eslint-disable-line
}
