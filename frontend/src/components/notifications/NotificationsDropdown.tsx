"use client";
import { useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, AlertOctagon, CheckCircle2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAlerts } from "@/hooks/useMonitoring";
import { relativeTime } from "@/lib/utils";

/**
 * Top-bar bell: open limit-breach alerts. The badge counts alerts nobody has
 * acknowledged yet; acknowledging clears them from the count.
 */
export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { alerts, unavailable, acknowledge } = useAlerts({ status: "open", limit: 20 });

  const unacked = alerts.filter((a) => !a.acknowledged_at);
  const hasCritical = unacked.some((a) => a.severity === "critical");

  const ackAll = () => unacked.forEach((a) => acknowledge(a.id));

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-lg flex items-center justify-center border border-border bg-card text-muted-foreground hover:text-foreground hover:border-navy-400/60 transition-colors relative"
        title="Alerts"
        aria-label={`Alerts${unacked.length ? ` (${unacked.length} new)` : ""}`}
      >
        <motion.span
          key={unacked.length}
          animate={unacked.length ? { rotate: [0, -14, 12, -8, 6, 0] } : {}}
          transition={{ duration: 0.6 }}
        >
          <Bell className="w-4 h-4" />
        </motion.span>
        {unacked.length > 0 && (
          <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 text-white text-xs font-bold rounded-full flex items-center justify-center tabular ${hasCritical ? "bg-red-500" : "bg-amber-500"}`}>
            {unacked.length > 9 ? "9+" : unacked.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-glass-lg z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="section-title">Open alerts</h3>
                {unacked.length > 0 && (
                  <button onClick={ackAll} className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                    Acknowledge all
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {unavailable ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Alerts aren&apos;t set up yet.</p>
                ) : alerts.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-brand-500/60" />
                    <p className="text-sm font-medium">All clear</p>
                  </div>
                ) : (
                  alerts.map((a) => {
                    const Icon = a.severity === "critical" ? AlertOctagon : AlertTriangle;
                    return (
                      <div key={a.id} className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 ${a.acknowledged_at ? "opacity-60" : ""}`}>
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${a.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-2">{a.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {a.module_name ? `${a.module_name} · ` : ""}{relativeTime(a.started_at)}
                          </p>
                        </div>
                        {!a.acknowledged_at && (
                          <button
                            onClick={() => acknowledge(a.id)}
                            className="w-7 h-7 shrink-0 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-brand-600 hover:border-brand-500/60 transition-colors"
                            title="Acknowledge"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-border bg-muted/50">
                <Link href="/dashboard#alerts" onClick={() => setIsOpen(false)} className="block text-center text-xs font-semibold text-muted-foreground hover:text-foreground">
                  View all alerts
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
