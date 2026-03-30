"use client";
import { Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeStore } from "@/store/useRealtimeStore";
import { motion, AnimatePresence } from "framer-motion";
import { relativeTime } from "@/lib/utils";
import NotificationsDropdown from "@/components/notifications/NotificationsDropdown";

export default function TopNav() {
  const { toggle, theme } = useTheme();
  const { companyUser, signOut } = useAuth();
  const { isLive, lastUpdated } = useRealtimeStore();

  return (
    <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 sticky top-0 z-30 shadow-sm">
      {/* Left: Live indicator */}
      <div className="flex items-center gap-3">
        <AnimatePresence>
          {isLive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20
                         px-3 py-1.5 rounded-full text-xs font-semibold shadow-[0_0_15px_rgba(16,185,129,0.1)]"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              SYSTEM LIVE
            </motion.div>
          )}
        </AnimatePresence>
        {lastUpdated && (
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">Status</span>
            <span className="text-xs font-medium text-foreground">
              Updated {relativeTime(lastUpdated.toISOString())}
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-brand-500/30 text-muted-foreground hover:text-foreground transition-all duration-200"
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <NotificationsDropdown />

        <div className="w-px h-8 bg-border/50 mx-2" />

        <div className="flex items-center gap-3 bg-card border border-border/50 pl-1.5 pr-4 py-1.5 rounded-full shadow-sm">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-sm font-bold shadow-inner">
            {companyUser?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-sm font-semibold leading-tight text-foreground">{companyUser?.name}</span>
            <span className="text-[10px] font-medium text-muted-foreground leading-tight truncate max-w-[120px]">{companyUser?.email}</span>
          </div>
        </div>

        <button
          onClick={signOut}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-card border border-border/50 shadow-sm hover:bg-destructive hover:border-destructive hover:text-white text-muted-foreground transition-all duration-200 ml-1"
          title="Sign out"
        >
          <LogOut className="w-4 h-4 ml-0.5" />
        </button>
      </div>
    </header>
  );
}
