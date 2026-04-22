"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Shield, Search, Loader2, Trash2, Pencil, Building2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Role, Permission } from "@/types";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";
import CustomSelect from "@/components/ui/CustomSelect";
import AnimatedPagination from "@/components/ui/AnimatedPagination";

export default function RolesPage() {
  const { permissions: userPerms, refreshPermissions } = useAuth();
  const canWrite = userPerms["roles.write"];
  const isSuperadmin = userPerms["superadmin"];
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", permissions: [] as string[] });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => Promise<boolean>>();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{name?: string; description?: string}>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  async function load() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api.get<Role[]>("/api/v1/roles"),
        api.get<Permission[]>("/api/v1/permissions"),
      ]);
      setRoles(r);
      setPermissions(p);
    } catch { toast.error("Failed to load roles"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", permissions: [] });
    setFieldErrors({});
    setShowModal(true);
  }

  function openEdit(r: Role) {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description || "",
      permissions: r.role_permissions?.map((rp) => rp.permission?.key || "") || [],
    });
    setFieldErrors({});
    setShowModal(true);
  }

  function validate() {
    const errors: {name?: string} = {};
    if (!form.name || !form.name.trim()) errors.name = "Role name is required";
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!validate()) return;
    
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/v1/roles/${editing.id}`, form);
        toast.success("Role updated successfully");
      } else {
        await api.post("/api/v1/roles", form);
        toast.success("Role created successfully");
      }
      setShowModal(false);
      load();
      // Refresh permissions to reflect any changes that affect the current user
      await refreshPermissions();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setConfirmMessage("Are you sure you want to delete this role? Users assigned to this role will lose its permissions.");
    setConfirmAction(() => async () => {
      try {
        await api.delete(`/api/v1/roles/${id}`);
        toast.success("Role deleted successfully");
        load();
        // Refresh permissions to reflect any changes that affect the current user
        await refreshPermissions();
        return true;
      } catch (e: unknown) { 
        toast.error(e instanceof Error ? e.message : "Failed to delete role"); 
        return false;
      }
    });
    setShowConfirmModal(true);
  }

  const filtered = roles.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || "").toLowerCase().includes(search.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRoles = filtered.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Role Management</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Define access control and permissions · {roles.length} total roles
          </p>
        </div>
        {canWrite && (
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Create New Role
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search roles by name or description..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md pl-11 pr-4 py-2.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 shadow-sm transition-all" />
      </div>

      {/* Roles Grid */}
      <div className="glass-card overflow-hidden animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        {loading ? (
          <EnergyPulseLoader text="Loading roles..." />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 glass-card">
            <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border/50">
              <Shield className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No roles found</h3>
            <p className="text-sm font-medium text-muted-foreground">Try adjusting your search terms or create a new role.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20 text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
                  <th className="p-4 pl-6">Role Identity</th>
                  {isSuperadmin && <th className="p-4">Organization</th>}
                  <th className="p-4">Privilege Matrix</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {paginatedRoles.map((r, i) => (
                  <motion.tr 
                    key={r.id} 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: i * 0.05 }}
                    className="group hover:bg-muted/10 transition-colors relative"
                  >
                    <td className="p-4 pl-6 relative">
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition-opacity bg-amber-500" />
                      <div className="flex items-center gap-4">
                        <div className="relative w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 overflow-hidden transition-colors bg-amber-500/10 border-amber-500/20 text-amber-500">
                          <Shield className="w-5 h-5 z-10 relative group-hover:scale-110 transition-transform" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-foreground text-sm group-hover:text-amber-500 transition-colors">
                              {r.name}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border/50 shrink-0">
                              {r.role_permissions?.length || 0} permissions
                            </span>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground truncate max-w-sm">
                            {r.description || "No description provided"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {isSuperadmin && (
                      <td className="p-4">
                        {r.company ? (
                          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <Building2 className="w-4 h-4 text-brand-500/70" />
                            {r.company.name}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground opacity-50 italic">System Default</span>
                        )}
                      </td>
                    )}

                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[400px]">
                        {r.role_permissions?.slice(0, 4).map((rp) => {
                          const permKey = rp.permission?.key || "?";
                          // Color code based on permission type
                          let colorClass = "bg-slate-100/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/50";
                          if (permKey === "superadmin") colorClass = "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
                          else if (permKey.includes("write")) colorClass = "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
                          else if (permKey.includes("read")) colorClass = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
                          
                          return (
                            <span 
                              key={rp.permission_id} 
                              className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-medium border ${colorClass} truncate max-w-[120px] uppercase tracking-wider`}
                              title={rp.permission?.description}
                            >
                              {permKey}
                            </span>
                          );
                        })}
                        {(r.role_permissions?.length || 0) > 4 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-muted text-muted-foreground border border-border/50 uppercase tracking-wider">
                            +{(r.role_permissions?.length || 0) - 4} more
                          </span>
                        )}
                        {(r.role_permissions?.length || 0) === 0 && (
                          <span className="text-[10px] text-muted-foreground italic">No privileges assigned</span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 pr-6 text-right">
                      {canWrite && (
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                          <button 
                            onClick={() => openEdit(r)} 
                            className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 border border-transparent transition-all"
                            title="Modify Matrix"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(r.id)} 
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-transparent hover:border-red-500/20 transition-all"
                            title="Revoke Role"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && !loading && (
          <AnimatedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative glass-card p-0 w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-amber-500/20">
              {/* Header with glowing effect */}
              <div className="relative p-6 border-b border-border/50 bg-muted/20 flex items-center gap-4 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50" />
                <div className="relative w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <Shield className="w-6 h-6 text-amber-500" />
                  <div className="absolute inset-0 bg-amber-500/20 blur-md animate-pulse rounded-2xl" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight">{editing ? "Modify Privilege Matrix" : "Initialize New Role"}</h2>
                  <p className="text-sm font-medium text-muted-foreground">Define role identity and assign system access levels.</p>
                </div>
              </div>
              
              <form onSubmit={handleSave} className="flex flex-col overflow-hidden flex-1" noValidate>
                <div className="p-6 overflow-y-auto space-y-8 bg-gradient-to-b from-transparent to-muted/5">
                  {/* Identity Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Role Identity
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Role Name <span className="text-amber-500">*</span></label>
                        <input 
                          value={form.name} 
                          onChange={(e) => {
                            setForm((f) => ({ ...f, name: e.target.value }));
                            if (fieldErrors.name) setFieldErrors({...fieldErrors, name: undefined});
                          }} 
                          placeholder="e.g. System Operator"
                          className={`w-full px-4 py-3 rounded-xl border bg-background/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                            fieldErrors.name 
                              ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                              : 'border-border/60 hover:border-amber-500/30 focus:ring-amber-500/30 focus:border-amber-500/50'
                          }`} 
                        />
                        {fieldErrors.name && <p className="text-xs font-medium text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.name}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</label>
                        <input 
                          value={form.description} 
                          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} 
                          placeholder="Brief description of responsibilities"
                          className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 hover:border-amber-500/30 transition-all" 
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Permissions Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Privilege Configuration
                      </h3>
                      <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs font-bold text-foreground">
                          {form.permissions.length} <span className="text-muted-foreground">Active Nodes</span>
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-5 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm">
                      {permissions.map((p) => {
                        const isSelected = form.permissions.includes(p.key);
                        const isSuperadminPerm = p.key === "superadmin";
                        const isWritePerm = p.key.includes("write");
                        
                        return (
                          <label 
                            key={p.id} 
                            className={`flex flex-col gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                              isSelected 
                                ? isSuperadminPerm ? 'bg-purple-500/10 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]' : 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                                : 'bg-background border-border/50 hover:bg-muted hover:border-border'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-bold truncate tracking-tight ${
                                isSelected 
                                  ? isSuperadminPerm ? 'text-purple-500' : 'text-emerald-500'
                                  : 'text-foreground'
                              }`}>
                                {p.key}
                              </p>
                              <div className="relative flex items-center justify-center shrink-0">
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                  isSelected 
                                    ? isSuperadminPerm ? 'border-purple-500 bg-purple-500' : 'border-emerald-500 bg-emerald-500'
                                    : 'border-muted-foreground/30 bg-transparent'
                                }`}>
                                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) setForm((f) => ({ ...f, permissions: [...f.permissions, p.key] }));
                                    else setForm((f) => ({ ...f, permissions: f.permissions.filter((k) => k !== p.key) }));
                                  }}
                                  className="absolute opacity-0 w-0 h-0" 
                                />
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-2 mt-auto">
                              <p className={`text-xs font-medium leading-relaxed line-clamp-2 ${
                                isSelected ? 'text-foreground/80' : 'text-muted-foreground'
                              }`}>
                                {p.description}
                              </p>
                              <div className="flex gap-1.5 mt-1">
                                {isWritePerm && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">Write Access</span>}
                                {isSuperadminPerm && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20 animate-pulse">Critical System Node</span>}
                                {!isWritePerm && !isSuperadminPerm && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">Read Access</span>}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                <div className="p-6 border-t border-border/50 bg-muted/20 flex gap-3 shrink-0 mt-auto">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl border border-border/60 bg-background hover:bg-muted text-sm font-bold text-foreground transition-all flex-1 md:flex-none">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all disabled:opacity-50 disabled:pointer-events-none flex-1 md:flex-none flex items-center justify-center gap-2 ml-auto">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Committing Matrix...</> : "Deploy Role Configuration"}
                  </button>
                </div>
              </form>
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
              <h2 className="text-xl font-bold text-foreground mb-2">Delete Role</h2>
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
                      // Error handling
                    } finally {
                      setConfirmLoading(false);
                    }
                  }}
                  disabled={confirmLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-medium shadow-sm transition-all duration-200 hover:bg-red-600 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {confirmLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                  ) : (
                    'Yes, Delete'
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
