"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCircle2, Settings2 } from "lucide-react";
import { useAlerts } from "@/hooks/useMonitoring";
import { relativeTime } from "@/lib/utils";
import { moduleDefForCode } from "@/lib/modules";
import type { Alert } from "@/types";

const SEVERITY_BADGE: Record<string, string> = {
  critical: "badge-danger",
  warning: "badge-warning",
  resolved: "badge-success",
};

/**
 * Limit-breach alerts (open or resolved), newest and most severe first.
 * Open alerts can be acknowledged inline.
 */
export default function AlertsList({
  title,
  moduleId,
  machineId,
  showModule = false,
  limit = 8,
  id,
}: {
  title: string;
  moduleId?: string;
  machineId?: string;
  showModule?: boolean;
  limit?: number;
  id?: string;
}) {
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const { alerts, loading, unavailable, acknowledge } = useAlerts({ status: tab, moduleId, machineId, limit });

  return (
    <section className="glass-card p-5" id={id}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="section-title flex items-center gap-2">
          {title}
          {tab === "open" && alerts.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs font-extrabold bg-red-500/10 text-red-600 dark:text-red-400 tabular">
              {alerts.length}{alerts.length >= limit ? "+" : ""}
            </span>
          )}
        </h2>
        <div className="inline-flex p-0.5 rounded-md bg-muted border border-border">
          {(["open", "resolved"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-3 py-1 text-xs font-bold capitalize rounded transition-colors ${tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab === t && <motion.span layoutId={`alerts-tab-${title}`} className="absolute inset-0 rounded bg-card shadow-sm" />}
              <span className="relative">{t}</span>
            </button>
          ))}
        </div>
      </div>

      {unavailable ? (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4 text-sm">
          <Settings2 className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Alerts aren&apos;t set up yet</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Apply <code className="font-mono">add_metric_limits_and_alerts.sql</code> in Supabase, then set limits on the Modules page.
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-9" />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center py-7 text-center">
          <CheckCircle2 className="w-9 h-9 text-brand-500/60 mb-2" />
          <p className="text-sm font-semibold text-foreground">
            {tab === "open" ? "All clear — no open alerts" : "No resolved alerts yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Alerts open automatically when a reading crosses a metric limit.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          <AnimatePresence initial={false}>
            {alerts.map((a, i) => (
              <AlertRow key={a.id} alert={a} index={i} showModule={showModule} onAck={() => acknowledge(a.id)} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function AlertRow({ alert: a, index, showModule, onAck }: { alert: Alert; index: number; showModule: boolean; onAck: () => void }) {
  const open = a.status === "open";
  const badgeKey = open ? a.severity : "resolved";
  const mod = showModule && a.module_code ? moduleDefForCode(a.module_code) : undefined;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className={`flex items-center gap-3 sm:gap-4 py-2.5 px-1 ${open && a.acknowledged_at ? "opacity-70" : ""}`}
    >
      <span className={`badge ${SEVERITY_BADGE[badgeKey]} min-w-[104px] shrink-0`}>
        {open ? a.severity : "resolved"}
      </span>
      {mod && (
        <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
          <mod.icon className="w-3 h-3" />{mod.navLabel}
        </span>
      )}
      <p className="text-sm text-foreground min-w-0 flex-1 truncate" title={a.message}>{a.message}</p>
      <span className="text-xs text-muted-foreground tabular shrink-0 hidden sm:inline" title={new Date(a.started_at).toLocaleString()}>
        {open ? relativeTime(a.started_at) : `resolved ${relativeTime(a.resolved_at ?? a.last_seen_at)}`}
      </span>
      {open && (
        a.acknowledged_at ? (
          <span className="text-xs font-bold uppercase text-muted-foreground w-[52px] text-right shrink-0">Ack&apos;d</span>
        ) : (
          <button
            onClick={onAck}
            className="w-[52px] shrink-0 inline-flex items-center justify-center gap-1 text-xs font-bold uppercase rounded border border-border px-1.5 py-1 text-muted-foreground hover:text-brand-600 hover:border-brand-500/60 transition-colors"
            title="Acknowledge"
          >
            <Check className="w-3 h-3" /> Ack
          </button>
        )
      )}
    </motion.li>
  );
}
