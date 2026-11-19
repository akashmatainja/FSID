"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Cpu, Users, Shield, GitBranch,
  Building2, ChevronLeft, ChevronRight, ChevronDown, Activity, Settings, Package, FileClock, Router, /* Video, */
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/components/providers/ModuleAccessProvider";

interface NavItem {
  href?: string;
  label: string;
  icon: React.ElementType;
  permission: string | null;
  hideForSuperadmin?: boolean;
  children?: NavItem[];
  isChild?: boolean;
  isExpandable?: boolean;
}

const nav: NavItem[] = [
  { href: "/dashboard",     label: "Dashboard",   icon: LayoutDashboard, permission: "dashboard.read" },
  { label: "Branches",      icon: GitBranch, permission: "branches.read", hideForSuperadmin: true, isExpandable: true, children: [
    { href: "/branches", label: "All Branches", icon: GitBranch, permission: "branches.read", hideForSuperadmin: true, isChild: true },
    { href: "/subdivisions", label: "Subdivisions", icon: Activity, permission: "subdivisions.read", hideForSuperadmin: true, isChild: true }
  ]},
  { href: "/modules",       label: "Modules",     icon: Package, permission: "superadmin" },
  { href: "/machines",      label: "Machines",    icon: Cpu, permission: "machines.read", hideForSuperadmin: true },
  { href: "/gateways",      label: "Gateways",    icon: Router, permission: "machines.read", hideForSuperadmin: true },
  { href: "/logs",          label: "Data Logs",   icon: FileClock, permission: null }, // rows are scoped server-side
  // Expert Guided Remote Maintenance (Remote Camera) moved to a separate site.
  // { href: "/remote-camera", label: "Remote Camera", icon: Video, permission: null },
  { href: "/users",         label: "Users",       icon: Users, permission: "users.read", hideForSuperadmin: true },
  { href: "/roles",         label: "Roles",       icon: Shield, permission: "roles.read" },
  { href: "/assignments",   label: "Device Assignment", icon: GitBranch, permission: "assignments.read", hideForSuperadmin: true },
  { href: "/settings",      label: "Settings",    icon: Settings, permission: null }, // No permission required for own settings
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Teal pill that slides between active items (shared layoutId). */
function ActivePill() {
  return (
    <motion.span
      layoutId="sidebar-active-pill"
      className="absolute inset-0 rounded-lg bg-brand-500 shadow-[0_6px_18px_-6px_rgba(23,163,151,0.8)]"
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
    />
  );
}

function Label({ collapsed, children, className }: { collapsed: boolean; children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {!collapsed && (
        <motion.span
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ duration: 0.15 }}
          className={cn("whitespace-nowrap relative z-10", className)}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { permissions } = useAuth();
  const { list: moduleList } = useModuleAccess();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const visible = (item: NavItem) => {
    if (item.hideForSuperadmin && permissions["superadmin"]) return false;
    if (item.permission && !permissions[item.permission] && !permissions["superadmin"]) return false;
    return true;
  };
  const isActive = (href?: string) => !!href && pathname.startsWith(href);

  // Auto-expand a group when one of its children is the current page.
  useEffect(() => {
    nav.forEach((item) => {
      if (item.children?.some((c) => isActive(c.href))) {
        setExpanded((prev) => (prev.has(item.label) ? prev : new Set(prev).add(item.label)));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggle = (label: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const itemClass = (active: boolean) =>
    cn("sidebar-item group", active && "active", collapsed && "justify-center px-0 h-10 w-10 mx-auto");

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 248 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col h-screen shrink-0 z-40 bg-sidebar text-sidebar-foreground
                 bg-gradient-to-b from-sidebar to-sidebar-deep"
    >
      {/* Brand */}
      <div className="flex items-center h-16 px-5 gap-3 shrink-0 border-b border-white/[0.07] overflow-hidden">
        <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center shrink-0 shadow-[0_4px_14px_-4px_rgba(23,163,151,0.9)]">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col leading-tight"
            >
              <span className="font-extrabold text-[15px] tracking-tight text-white">FSID</span>
              <span className="text-xs uppercase tracking-[0.14em] font-semibold text-sidebar-muted">Energy Platform</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="px-3 pb-2 text-xs uppercase tracking-[0.14em] font-bold text-sidebar-muted/80">Monitoring</p>
        )}

        {nav.filter(visible).map((item) => {
          const { href, label, icon: Icon, children, isExpandable } = item;

          if (isExpandable && children) {
            const kids = children.filter(visible);
            const parentActive = kids.some((c) => isActive(c.href));
            const open = expanded.has(label);
            return (
              <div key={label}>
                <button
                  type="button"
                  onClick={() => (collapsed ? onToggle() : toggle(label))}
                  className={cn(itemClass(false), "w-full", parentActive && "text-white")}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0 relative z-10" />
                  <Label collapsed={collapsed} className="flex-1 text-left">{label}</Label>
                  {!collapsed && (
                    <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }} className="relative z-10">
                      <ChevronDown className="w-4 h-4" />
                    </motion.span>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {open && !collapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="ml-[22px] pl-3 border-l border-white/10 mt-1 space-y-1">
                        {kids.map((c) => {
                          const active = isActive(c.href);
                          const CIcon = c.icon;
                          return (
                            <Link key={c.label} href={c.href || "#"} className={cn(itemClass(active), "py-2 text-xs")}>
                              {active && <ActivePill />}
                              <CIcon className="w-4 h-4 shrink-0 relative z-10" />
                              <span className="relative z-10 whitespace-nowrap">{c.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          const active = isActive(href);
          return (
            <Link key={label} href={href || "#"} className={itemClass(active)} title={collapsed ? label : undefined}>
              {active && <ActivePill />}
              <Icon className="w-[18px] h-[18px] shrink-0 relative z-10" />
              <Label collapsed={collapsed}>{label}</Label>
            </Link>
          );
        })}

        {/* Monitoring modules the user can access (derived from their machines) */}
        {moduleList.length > 0 && (
          <>
            {!collapsed ? (
              <p className="px-3 pt-6 pb-2 text-xs uppercase tracking-[0.14em] font-bold text-sidebar-muted/80">Modules</p>
            ) : (
              <div className="my-4 mx-3 border-t border-white/10" />
            )}
            {moduleList.map(({ def }) => {
              const active = isActive(def.href);
              const MIcon = def.icon;
              return (
                <motion.div key={def.slug} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                  <Link href={def.href} className={itemClass(active)} title={collapsed ? def.navLabel : undefined}>
                    {active && <ActivePill />}
                    <MIcon className="w-[18px] h-[18px] shrink-0 relative z-10" />
                    <Label collapsed={collapsed}>{def.navLabel}</Label>
                  </Link>
                </motion.div>
              );
            })}
          </>
        )}

        {permissions["superadmin"] && (
          <>
            {!collapsed ? (
              <p className="px-3 pt-6 pb-2 text-xs uppercase tracking-[0.14em] font-bold text-sidebar-muted/80">Administration</p>
            ) : (
              <div className="my-4 mx-3 border-t border-white/10" />
            )}
            <Link href="/companies" className={itemClass(isActive("/companies"))} title={collapsed ? "Companies" : undefined}>
              {isActive("/companies") && <ActivePill />}
              <Building2 className="w-[18px] h-[18px] shrink-0 relative z-10" />
              <Label collapsed={collapsed}>Companies</Label>
            </Link>
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-white/[0.07]">
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs font-semibold text-sidebar-muted hover:text-white hover:bg-white/[0.06] transition-colors",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}
