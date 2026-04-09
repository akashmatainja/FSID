"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Plus, Trash2, Building2, User, Shield, Cpu, AlertCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";
import type { CompanyUser, Role, Machine } from "@/types";

export default function AssignmentsPage() {
  const { permissions } = useAuth();
  const canManageRoles = permissions["roles.write"];
  const canManageMachines = permissions["machines.write"];
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => Promise<boolean>>();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [roleError, setRoleError] = useState("");
  const [machineError, setMachineError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [u, r, m] = await Promise.all([
        api.get<CompanyUser[]>("/api/v1/users"),
        api.get<Role[]>("/api/v1/roles"),
        api.get<Machine[]>("/api/v1/machines"),
      ]);
      setUsers(u);
      setRoles(r);
      setMachines(m);
    } catch { toast.error("Failed to load data"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function assignRole() {
    if (!selectedUser) {
      toast.error("User not selected");
      return;
    }
    
    if (!selectedRole) {
      setRoleError("Please select a role to assign");
      return;
    }
    
    try {
      await api.post("/api/v1/assignments/roles", { user_id: selectedUser, role_id: selectedRole });
      toast.success("Role assigned successfully");
      setShowRoleModal(false);
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to assign role"); }
  }

  async function unassignRole(userId: string, roleId: string) {
    setConfirmMessage("Are you sure you want to remove this role assignment? The user will lose associated permissions.");
    setConfirmAction(() => async () => {
      try {
        await api.delete("/api/v1/assignments/roles", { user_id: userId, role_id: roleId });
        toast.success("Role removed successfully");
        load();
        return true;
      } catch (e: unknown) { 
        toast.error(e instanceof Error ? e.message : "Failed to remove role"); 
        return false;
      }
    });
    setShowConfirmModal(true);
  }

  async function assignMachine() {
    if (!selectedUser) {
      toast.error("User not selected");
      return;
    }
    
    if (!selectedMachine) {
      setMachineError("Please select a machine to assign");
      return;
    }
    
    try {
      await api.post("/api/v1/assignments/machines", { user_id: selectedUser, machine_id: selectedMachine });
      toast.success("Machine assigned successfully");
      setShowMachineModal(false);
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to assign machine"); }
  }

  async function unassignMachine(userId: string, machineId: string) {
    setConfirmMessage("Are you sure you want to remove this machine assignment? The user will lose access to this machine's data.");
    setConfirmAction(() => async () => {
      try {
        await api.delete("/api/v1/assignments/machines", { user_id: userId, machine_id: machineId });
        toast.success("Machine removed successfully");
        load();
        return true;
      } catch (e: unknown) { 
        toast.error(e instanceof Error ? e.message : "Failed to remove machine"); 
        return false;
      }
    });
    setShowConfirmModal(true);
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Assignments Management</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Manage user roles and machine access control
          </p>
        </div>
      </div>

      {loading ? (
        <EnergyPulseLoader text="Loading assignments..." />
      ) : users.length === 0 ? (
        <div className="text-center py-20 glass-card">
          <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border/50">
            <GitBranch className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">No users found</h3>
          <p className="text-sm font-medium text-muted-foreground">Add users first to manage their assignments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {users.map((user, index) => (
            <motion.div 
              key={user.id} 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: index * 0.05 }}
              className="glass-card flex flex-col h-full overflow-hidden group"
            >
              {/* User Header */}
              <div className="p-5 bg-muted/20 border-b border-border/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform duration-300">
                  <span className="text-white font-bold text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-foreground truncate group-hover:text-brand-600 transition-colors">
                    {user.name}
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col gap-6">
                {/* Company & Branch Context */}
                {user.company && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shadow-sm">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Company</p>
                        <p className="text-sm font-bold text-foreground leading-tight">{user.company.name}</p>
                      </div>
                    </div>
                    {user.branch && (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shadow-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Branch</p>
                          <p className="text-sm font-bold text-foreground leading-tight">{user.branch.name}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Roles Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-brand-500" />
                      <h4 className="text-sm font-bold text-foreground">Assigned Roles</h4>
                    </div>
                    {canManageRoles && (
                      <button 
                        onClick={() => { 
                          setSelectedUser(user.id); 
                          setSelectedRole("");
                          setRoleError("");
                          setShowRoleModal(true); 
                        }}
                        className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 rounded-md transition-colors"
                      >
                        + Assign Role
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {user.user_roles?.map((ur) => (
                        <motion.div 
                          key={ur.role_id} 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card shadow-sm group/item hover:border-brand-500/30 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                              <Shield className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                            </div>
                            <span className="text-xs font-bold text-foreground">{ur.role?.name || "Role"}</span>
                          </div>
                          {canManageRoles && (
                            <button 
                              onClick={() => unassignRole(user.id, ur.role_id)}
                              className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center text-muted-foreground hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all"
                              title="Remove role"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </motion.div>
                      ))}
                      {(!user.user_roles || user.user_roles.length === 0) && (
                        <motion.div className="p-4 border border-dashed border-border rounded-xl text-center">
                          <p className="text-xs font-medium text-muted-foreground italic">No roles assigned to this user</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Machines Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-emerald-500" />
                      <h4 className="text-sm font-bold text-foreground">Machine Access</h4>
                    </div>
                    {canManageMachines && (
                      <button 
                        onClick={() => { 
                          setSelectedUser(user.id); 
                          setSelectedMachine("");
                          setMachineError("");
                          setShowMachineModal(true); 
                        }}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-md transition-colors"
                      >
                        + Grant Access
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {user.machine_assignments?.map((um) => (
                        <motion.div 
                          key={um.machine_id} 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card shadow-sm group/item hover:border-emerald-500/30 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                              <Cpu className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="text-xs font-bold text-foreground">{um.machine?.name || "Machine"}</span>
                          </div>
                          {canManageMachines && (
                            <button 
                              onClick={() => unassignMachine(user.id, um.machine_id)}
                              className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center text-muted-foreground hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all"
                              title="Revoke access"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </motion.div>
                      ))}
                      {(!user.machine_assignments || user.machine_assignments.length === 0) && (
                        <motion.div className="p-4 border border-dashed border-border rounded-xl text-center">
                          <p className="text-xs font-medium text-muted-foreground italic">No machines accessible</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Role Assignment Modal */}
      <AnimatePresence>
        {showRoleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowRoleModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative glass-card p-0 w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-border/50 bg-muted/20 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center border border-brand-500/20">
                  <Shield className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Assign Role</h2>
                  <p className="text-sm font-medium text-muted-foreground">Select a role to grant permissions</p>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-4">
                <label className="block text-sm font-bold text-foreground mb-1.5">Available Roles <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Shield className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${roleError ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <select 
                    value={selectedRole} 
                    onChange={(e) => {
                      setSelectedRole(e.target.value);
                      if (roleError) setRoleError("");
                    }}
                    className={`w-full pl-11 pr-10 py-3 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 appearance-none cursor-pointer transition-all ${
                      roleError 
                        ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                        : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                    }`}
                  >
                    <option value="" disabled>Choose a role...</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
                {roleError && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {roleError}</p>}
              </div>
              
              <div className="p-6 border-t border-border/50 bg-muted/20 flex gap-3 shrink-0 mt-auto">
                <button onClick={() => setShowRoleModal(false)} className="btn-secondary flex-1 py-2.5">Cancel</button>
                <button onClick={assignRole} disabled={!selectedRole} className="btn-primary flex-1 py-2.5">Confirm Assignment</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Machine Assignment Modal */}
      <AnimatePresence>
        {showMachineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowMachineModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative glass-card p-0 w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-border/50 bg-muted/20 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                  <Cpu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Grant Machine Access</h2>
                  <p className="text-sm font-medium text-muted-foreground">Allow user to view machine data</p>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-4">
                <label className="block text-sm font-bold text-foreground mb-1.5">Available Machines <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Cpu className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${machineError ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <select 
                    value={selectedMachine} 
                    onChange={(e) => {
                      setSelectedMachine(e.target.value);
                      if (machineError) setMachineError("");
                    }}
                    className={`w-full pl-11 pr-10 py-3 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 appearance-none cursor-pointer transition-all ${
                      machineError 
                        ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                        : 'border-border/60 focus:ring-emerald-500/30 focus:border-emerald-500/50'
                    }`}
                  >
                    <option value="" disabled>Choose a machine...</option>
                    {machines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
                {machineError && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {machineError}</p>}
              </div>
              
              <div className="p-6 border-t border-border/50 bg-muted/20 flex gap-3 shrink-0 mt-auto">
                <button onClick={() => setShowMachineModal(false)} className="btn-secondary flex-1 py-2.5">Cancel</button>
                <button 
                  onClick={assignMachine} 
                  disabled={!selectedMachine} 
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium shadow-sm transition-all duration-200 hover:bg-emerald-600 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Grant Access
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative glass-card p-6 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Remove Assignment</h2>
              <p className="text-sm font-medium text-muted-foreground mb-8">{confirmMessage}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirmModal(false)} 
                  className="btn-secondary flex-1"
                  disabled={confirmLoading}
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (!confirmAction || typeof confirmAction !== 'function') return;
                    setConfirmLoading(true);
                    try {
                      const result = await confirmAction();
                      if (result) {
                        setShowConfirmModal(false);
                      }
                    } catch (error) {
                      // Error handling without console logging for production
                    } finally {
                      setConfirmLoading(false);
                    }
                  }}
                  disabled={confirmLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-medium shadow-sm transition-all duration-200 hover:bg-red-600 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {confirmLoading ? (
                    <>Removing...</>
                  ) : (
                    'Yes, Remove'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
