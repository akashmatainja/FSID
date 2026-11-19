"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { MODULE_DEFS, type ModuleDef, type ModuleSlug } from "@/lib/modules";
import type { Machine, Module } from "@/types";

export interface ModuleAccess {
  def: ModuleDef;
  module: Module;        // includes metrics
  machines: Machine[];   // visible machines that have this module
}

interface Ctx {
  loading: boolean;
  /** Machines this user may monitor (all company machines, or only assigned ones). */
  machines: Machine[];
  /** Modules the user can open, keyed by slug. Missing key = no access. */
  access: Partial<Record<ModuleSlug, ModuleAccess>>;
  /** Accessible modules in sidebar order. */
  list: ModuleAccess[];
  refresh: () => Promise<void>;
}

const ModuleAccessCtx = createContext<Ctx>({
  loading: true, machines: [], access: {}, list: [], refresh: async () => {},
});

/**
 * Works out which monitoring modules the signed-in user can see.
 *
 * Rule: a module is accessible when at least one machine the user can monitor
 * has that module assigned (and the module is active). Users with
 * `stats.read_all` (and superadmins) monitor every machine; everyone else only
 * their assigned machines.
 */
export function ModuleAccessProvider({ children }: { children: React.ReactNode }) {
  const { companyUser, permissions } = useAuth();
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [activeModules, setActiveModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [m, mods] = await Promise.all([
        api.get<Machine[]>("/api/v1/machines"),
        api.get<Module[]>("/api/v1/modules/active"),
      ]);
      setAllMachines(m || []);
      setActiveModules(mods || []);
    } catch {
      setAllMachines([]);
      setActiveModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (companyUser || permissions["superadmin"]) load();
  }, [companyUser, permissions, load]);

  const value = useMemo<Ctx>(() => {
    const seesAll = permissions["superadmin"] || permissions["stats.read_all"];
    const assigned = new Set(companyUser?.machine_assignments?.map((a) => a.machine_id) ?? []);
    const machines = seesAll ? allMachines : allMachines.filter((m) => assigned.has(m.id));

    const access: Partial<Record<ModuleSlug, ModuleAccess>> = {};
    for (const def of MODULE_DEFS) {
      const found = activeModules.find((mod) => def.matches(mod.code));
      if (!found) continue;
      const withModule = machines.filter((m) => m.modules?.some((mm) => mm.id === found.id));
      if (withModule.length) access[def.slug] = { def, module: found, machines: withModule };
    }
    const list = MODULE_DEFS.map((d) => access[d.slug]).filter((x): x is ModuleAccess => !!x);
    return { loading, machines, access, list, refresh: load };
  }, [allMachines, activeModules, companyUser, permissions, loading, load]);

  return <ModuleAccessCtx.Provider value={value}>{children}</ModuleAccessCtx.Provider>;
}

export const useModuleAccess = () => useContext(ModuleAccessCtx);
