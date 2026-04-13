"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Plus, Trash2, Building2, User, Shield, Cpu, AlertCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";
import CustomSelect from "@/components/ui/CustomSelect";
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
        <div className="flex flex-col gap-4">
          {users.map((user, index) => (
            <motion.div 
              key={user.id} 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ delay: index * 0.05 }}
              className="glass-card flex flex-col xl:flex-row items-start gap-6 p-5 hover:shadow-md hover:border-brand-500/30 transition-all duration-300"
            >
              {/* User Info Sidebar */}
              <div className="flex items-center gap-4 xl:w-72 shrink-0 w-full xl:border-r xl:border-border/50 xl:pr-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-md shadow-brand-500/20 shrink-0 transition-transform duration-300">
                  <span className="text-white font-bold text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-foreground truncate transition-colors">
                    {user.name}
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground truncate mb-2">{user.email}</p>
                  
                  {/* Context chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    {user.company && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-md border border-border/50 truncate max-w-[120px]">
                        <Building2 className="w-3 h-3 text-brand-500" />
                        {user.company.name}
                      </span>
                    )}
                    {user.branch && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-md border border-border/50 truncate max-w-[120px]">
                        <MapPin className="w-3 h-3 text-purple-500" />
                        {user.branch.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col md:flex-row gap-6 w-full min-w-0">
                {/* Roles Section */}
                <div className="flex-1 min-w-0 space-y-3">
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
                        className="text-[10px] font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 bg-brand-50 dark:bg-brand-500/10 px-2 py-1 rounded-md transition-colors"
                      >
                        + Assign
                      </button>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <AnimatePresence mode="popLayout">
                      {user.user_roles?.map((ur) => (
                        <motion.div 
                          key={ur.role_id} 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card shadow-sm group/item hover:border-brand-500/30 transition-colors"
                        >
                          <Shield className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                          <span className="text-xs font-bold text-foreground">{ur.role?.name || "Role"}</span>
                          {canManageRoles && (
                            <button 
                              onClick={() => unassignRole(user.id, ur.role_id)}
                              className="w-5 h-5 rounded bg-muted hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-all ml-1"
                              title="Remove role"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </motion.div>
                      ))}
                      {(!user.user_roles || user.user_roles.length === 0) && (
                        <motion.div className="px-3 py-1.5 rounded-lg border border-dashed border-border text-center">
                          <p className="text-[10px] font-medium text-muted-foreground italic">No roles</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="hidden md:block w-px bg-border/50"></div>

                {/* Machines Section */}
                <div className="flex-1 min-w-0 space-y-3">
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
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md transition-colors"
                      >
                        + Grant
                      </button>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <AnimatePresence mode="popLayout">
                      {user.machine_assignments?.map((um) => (
                        <motion.div 
                          key={um.machine_id} 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card shadow-sm group/item hover:border-emerald-500/30 transition-colors"
                        >
                          <Cpu className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-bold text-foreground truncate max-w-[120px]">{um.machine?.name || "Machine"}</span>
                          {canManageMachines && (
                            <button 
                              onClick={() => unassignMachine(user.id, um.machine_id)}
                              className="w-5 h-5 rounded bg-muted hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-all ml-1"
                              title="Revoke access"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </motion.div>
                      ))}
                      {(!user.machine_assignments || user.machine_assignments.length === 0) && (
                        <motion.div className="px-3 py-1.5 rounded-lg border border-dashed border-border text-center">
                          <p className="text-[10px] font-medium text-muted-foreground italic">No machines</p>
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
                <CustomSelect
                  value={selectedRole}
                  onChange={(v) => {
                    setSelectedRole(v);
                    if (roleError) setRoleError("");
                  }}
                  error={!!roleError}
                  iconLeft={<Shield className={`w-4 h-4 ${roleError ? 'text-red-500' : 'text-muted-foreground'}`} />}
                  placeholder="Choose a role..."
                  options={roles.map((r) => ({ value: r.id, label: r.name }))}
                />
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
                <CustomSelect
                  value={selectedMachine}
                  onChange={(v) => {
                    setSelectedMachine(v);
                    if (machineError) setMachineError("");
                  }}
                  error={!!machineError}
                  iconLeft={<Cpu className={`w-4 h-4 ${machineError ? 'text-red-500' : 'text-muted-foreground'}`} />}
                  placeholder="Choose a machine..."
                  options={machines.map((m) => ({ value: m.id, label: `${m.name} (${m.code})` }))}
                />
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
