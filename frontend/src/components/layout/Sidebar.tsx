"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Cpu, Users, Shield, GitBranch,
  Building2, ChevronLeft, ChevronRight, Activity, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const nav = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard, permission: "dashboard.read" },
  { href: "/branches",    label: "Branches",    icon: GitBranch, permission: "branches.read", hideForSuperadmin: true },
  { href: "/machines",    label: "Machines",    icon: Cpu, permission: "machines.read" },
  { href: "/users",       label: "Users",       icon: Users, permission: "users.read" },
  { href: "/roles",       label: "Roles",       icon: Shield, permission: "roles.read" },
  { href: "/assignments", label: "Device Assignment", icon: GitBranch, permission: "assignments.read" },
  { href: "/settings",    label: "Settings",    icon: Settings, permission: null }, // No permission required for own settings
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { permissions } = useAuth();

  return (
    <motion.aside
      initial={false}
      animate={{ 
        width: collapsed ? 80 : 280,
      }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col h-screen border-r border-border/50 bg-background/95 backdrop-blur-xl shrink-0 overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-40"
    >
      {/* Logo Area */}
      <div className="flex items-center h-20 px-6 border-b border-border/50 gap-3 shrink-0 relative overflow-hidden group">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shrink-0 shadow-sm shadow-brand-500/20 relative z-10">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col relative z-10"
            >
              <span className="font-bold text-base tracking-tight text-foreground">
                Energy Monitoring
              </span>
              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                Enterprise
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {/* Main Menu Label */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 pb-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70"
            >
              Main Menu
            </motion.div>
          )}
        </AnimatePresence>

        {nav.map(({ href, label, icon: Icon, permission, hideForSuperadmin }) => {
          // Hide for superadmin if specified
          if (hideForSuperadmin && permissions["superadmin"]) {
            return null;
          }
          // Check permissions for non-superadmin
          if (permission && !permissions[permission] && !permissions["superadmin"]) {
            return null;
          }
          
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href}>
              <div
                className={cn(
                  "sidebar-item relative group overflow-hidden",
                  active && "active",
                  collapsed && "justify-center px-0 h-11 w-11 mx-auto rounded-xl"
                )}
                title={collapsed ? label : undefined}
              >
                {/* Active indicator line */}
                {active && (
                  <motion.div 
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-brand-500 rounded-r-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
                
                <Icon className={cn(
                  "w-5 h-5 shrink-0 transition-colors duration-200 relative z-10",
                  active ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground group-hover:text-foreground"
                )} />
                
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className="whitespace-nowrap font-medium relative z-10"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </Link>
          );
        })}

        {/* Superadmin Section */}
        {permissions["superadmin"] && (
          <>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 pt-6 pb-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70"
                >
                  Administration
                </motion.div>
              )}
            </AnimatePresence>
            
            <Link href="/companies">
              <div
                className={cn(
                  "sidebar-item relative group",
                  pathname.startsWith("/companies") && "active",
                  collapsed && "justify-center px-0 h-11 w-11 mx-auto rounded-xl mt-6"
                )}
                title={collapsed ? "Companies" : undefined}
              >
                {pathname.startsWith("/companies") && (
                  <motion.div 
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-brand-500 rounded-r-full"
                  />
                )}
                
                <Building2 className={cn(
                  "w-5 h-5 shrink-0 transition-colors duration-200 relative z-10",
                  pathname.startsWith("/companies") ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className="whitespace-nowrap font-medium relative z-10"
                    >
                      Companies
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </Link>
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute z-50 top-1/2 right-0 translate-x-1/2 -translate-y-1/2 group focus:outline-none"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-background border border-border shadow-sm 
                        ring-4 ring-background transition-all duration-300 ease-out
                        group-hover:border-brand-500/50 group-hover:shadow-md
                        group-active:scale-95">
          
          {/* Elegant fill animation */}
          <div className="absolute inset-0 rounded-full bg-brand-50 dark:bg-brand-500/10 
                          opacity-0 scale-50 transition-all duration-300 ease-out 
                          group-hover:opacity-100 group-hover:scale-100"></div>

          {/* Icon */}
          <div className="relative z-10 flex items-center justify-center text-muted-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors duration-300">
            {collapsed ? (
              <ChevronRight className="w-4 h-4 transition-transform duration-300 ease-out group-hover:translate-x-[2px]" />
            ) : (
              <ChevronLeft className="w-4 h-4 transition-transform duration-300 ease-out group-hover:-translate-x-[2px]" />
            )}
          </div>
        </div>
      </button>
    </motion.aside>
  );
}
