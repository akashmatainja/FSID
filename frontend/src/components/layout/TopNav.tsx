"use client";
import { usePathname } from "next/navigation";
import { Moon, Sun, LogOut, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeStore } from "@/store/useRealtimeStore";
import { relativeTime } from "@/lib/utils";
import NotificationsDropdown from "@/components/notifications/NotificationsDropdown";
import LivePill from "@/components/ui/LivePill";

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  energy: "Energy Monitoring",
  environmental: "Environmental Monitoring",
  predictive: "Predictive Maintenance",
  machines: "Machines",
  branches: "Branches",
  subdivisions: "Subdivisions",
  modules: "Modules",
  users: "Users",
  roles: "Roles",
  assignments: "Device Assignment",
  settings: "Settings",
  companies: "Companies",
  superadmin: "Superadmin",
};

export default function TopNav() {
  const { toggle, theme } = useTheme();
  const { companyUser, signOut } = useAuth();
  const { isLive, lastUpdated } = useRealtimeStore();
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);
  const section = TITLES[segments[0]] ?? "Overview";
  const sub = segments.length > 1 ? "Details" : null;

  const iconBtn =
    "w-9 h-9 rounded-lg flex items-center justify-center border border-border bg-card text-muted-foreground hover:text-foreground hover:border-navy-400/60 transition-colors";

  return (
    <header className="h-16 border-b border-border bg-card/90 backdrop-blur-md flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
      {/* Left: breadcrumb + live status */}
      <div className="flex items-center gap-4 min-w-0">
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          <span className="text-muted-foreground font-medium truncate">{companyUser?.company?.name ?? "Platform"}</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          <motion.span key={section} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="font-bold text-foreground truncate">
            {section}
          </motion.span>
          {sub && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
              <span className="font-semibold text-muted-foreground">{sub}</span>
            </>
          )}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <LivePill live={isLive} />
          {lastUpdated && (
            <span className="text-xs text-muted-foreground tabular">Updated {relativeTime(lastUpdated.toISOString())}</span>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <button onClick={toggle} className={iconBtn} title="Toggle theme" aria-label="Toggle theme">
          <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.25 }}>
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </motion.span>
        </button>

        <NotificationsDropdown />

        <div className="w-px h-7 bg-border mx-2" />

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-navy-800 dark:bg-navy-600 flex items-center justify-center text-white text-sm font-bold">
            {companyUser?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground">{companyUser?.name}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{companyUser?.email}</span>
          </div>
        </div>

        <button
          onClick={signOut}
          className={`${iconBtn} ml-1 hover:!text-white hover:!bg-destructive hover:!border-destructive`}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
