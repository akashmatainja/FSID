"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";
import TopNav from "@/components/layout/TopNav";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { OPCUAProvider } from "@/components/providers/OPCUAProvider";
import { ModuleAccessProvider } from "@/components/providers/ModuleAccessProvider";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-9 h-9 rounded-full border-[3px] border-navy-200 dark:border-navy-800 border-t-brand-500 animate-spin" />
      </div>
    );
  }
  if (!session) return null;

  return (
    <OPCUAProvider>
      <ModuleAccessProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopNav />
          <main className="flex-1 overflow-y-auto">
            <motion.div
              key={pathname}
              // Opacity only: a transform here would trap `position: fixed` modals.
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="p-6 max-w-[1600px] mx-auto"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
      </ModuleAccessProvider>
    </OPCUAProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppLayoutInner>{children}</AppLayoutInner>
      </AuthProvider>
    </ThemeProvider>
  );
}
