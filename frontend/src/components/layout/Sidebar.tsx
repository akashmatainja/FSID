"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  LayoutDashboard, Cpu, Users, Shield, GitBranch,
  Building2, ChevronLeft, ChevronRight, Activity, Settings, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  href?: string;
  label: string;
  icon: any;
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
  { href: "/machines",      label: "Machines",    icon: Cpu, permission: "machines.read" },
  { href: "/users",         label: "Users",       icon: Users, permission: "users.read" },
  { href: "/roles",         label: "Roles",       icon: Shield, permission: "roles.read" },
  { href: "/assignments",   label: "Device Assignment", icon: GitBranch, permission: "assignments.read" },
  { href: "/settings",      label: "Settings",    icon: Settings, permission: null }, // No permission required for own settings
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { permissions } = useAuth();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(label)) {
        newSet.delete(label);
      } else {
        newSet.add(label);
      }
      return newSet;
    });
  };

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

        {nav.map(({ href, label, icon: Icon, permission, hideForSuperadmin, children, isChild, isExpandable }) => {
          // Hide for superadmin if specified
          if (hideForSuperadmin && permissions["superadmin"]) {
            return null;
          }
          // Check permissions for non-superadmin
          if (permission && !permissions[permission] && !permissions["superadmin"]) {
            return null;
          }
          
          const active = href ? pathname.startsWith(href) : false;
          // For parent items, consider them active if any child is active
          const isParentActive = children ? children.some(child => child.href && pathname.startsWith(child.href)) : false;
          
          // Auto-expand if a child is active
          if (isParentActive && !expandedItems.has(label)) {
            setExpandedItems(prev => {
              const newSet = new Set(prev);
              newSet.add(label);
              return newSet;
            });
          }
          
          const isExpanded = expandedItems.has(label);
          
          return (
            <div key={label} className="mb-1">
              {isExpandable ? (
                // Expandable menu item (Parent)
                <div
                  className={cn(
                    "sidebar-item relative group overflow-hidden cursor-pointer transition-all duration-200",
                    isParentActive ? "active" : "hover:bg-accent text-muted-foreground hover:text-foreground",
                    collapsed && "justify-center px-0 h-11 w-11 mx-auto rounded-xl"
                  )}
                  title={collapsed ? label : undefined}
                  onClick={() => toggleExpanded(label)}
                >
                  {/* Parent Active indicator line */}
                  {isParentActive && (
                    <motion.div 
                      layoutId="activeParentIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-brand-500 rounded-r-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                  
                  <Icon className={cn(
                    "w-5 h-5 shrink-0 transition-colors duration-200 relative z-10",
                    isParentActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        className="whitespace-nowrap font-semibold relative z-10 flex-1"
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  
                  {/* Chevron for expandable items */}
                  {!collapsed && (
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "absolute right-3 -translate-y-1/2 transition-colors",
                        isParentActive ? "text-white" : "text-muted-foreground"
                      )}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 18 6-6 6 6"/>
                      </svg>
                    </motion.div>
                  )}
                </div>
              ) : (
                // Regular link
                <Link href={href || "#"}>
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
              )}
              
              {/* Render children with enhanced styling */}
              {children && !collapsed && isExpanded && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 4 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden flex flex-col gap-1 relative"
                  >
                    {/* Connecting line for visual hierarchy */}
                    <div className="absolute left-[22px] top-0 bottom-4 w-px bg-border/50 rounded-full" />
                    
                    {children.map(({ href: childHref, label: childLabel, icon: ChildIcon, permission: childPermission, hideForSuperadmin: childHideForSuperadmin }) => {
                      // Hide for superadmin if specified
                      if (childHideForSuperadmin && permissions["superadmin"]) {
                        return null;
                      }
                      // Check permissions for non-superadmin
                      if (childPermission && !permissions[childPermission] && !permissions["superadmin"]) {
                        return null;
                      }
                      
                      const childActive = childHref ? pathname.startsWith(childHref) : false;
                      
                      return (
                        <Link key={childLabel} href={childHref || "#"}>
                          <div
                            className={cn(
                              "relative group flex items-center py-2 pr-3 pl-11 rounded-xl transition-all duration-200 ml-2 mr-2",
                              childActive 
                                ? "bg-brand-500/10 text-brand-600 dark:text-brand-400" 
                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                          >
                            {/* Horizontal branch line */}
                            <div className="absolute left-[14px] top-1/2 -translate-y-1/2 w-3 h-px bg-border/50" />
                            
                            {/* Active dot indicator */}
                            {childActive && (
                              <motion.div 
                                layoutId="activeChildIndicator"
                                className="absolute left-[13px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-brand-500 rounded-full shadow-[0_0_8px_rgba(var(--brand-500),0.6)]"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              />
                            )}
                            
                            <ChildIcon className={cn(
                              "w-4 h-4 shrink-0 transition-colors duration-200 mr-3",
                              childActive ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground group-hover:text-foreground"
                            )} />
                            
                            <span className="whitespace-nowrap font-medium text-[13px]">
                              {childLabel}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
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
