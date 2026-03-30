"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { CompanyUser } from "@/types";
import { api } from "@/lib/api";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  companyUser: CompanyUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  permissions: Record<string, boolean>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, companyUser: null,
  loading: true, signOut: async () => {}, permissions: {}, refreshPermissions: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [companyUser, setCompanyUser] = useState<CompanyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  async function loadCompanyUser() {
    try {
      const me = await api.get<CompanyUser>("/api/v1/users/me").catch(() => null);
      
      if (me) {
        setCompanyUser(me);
        
        // Use permissions from the response if available (for superadmin), otherwise derive from roles
        let perms: Record<string, boolean> = {};
        
        if (me.permissions) {
          // Superadmin case - permissions are included directly in the response
          perms = me.permissions as Record<string, boolean>;
        } else {
          // Regular user case - derive permissions from roles
          me.user_roles?.forEach((ur) => {
            ur.role?.role_permissions?.forEach((rp) => {
              if (rp.permission?.key) perms[rp.permission.key] = true;
            });
          });
        }
        
        setPermissions(perms);
      }
    } catch {
      // user not in tenant
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session) loadCompanyUser();
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess) loadCompanyUser();
      else { setCompanyUser(null); setPermissions({}); }
    });
    return () => listener.subscription.unsubscribe();
  }, []); // eslint-disable-line

  const signOut = async () => {
    await supabase.auth.signOut();
    setCompanyUser(null);
    setPermissions({});
  };

  const refreshPermissions = async () => {
    if (session) {
      await loadCompanyUser();
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, companyUser, loading, signOut, permissions, refreshPermissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
