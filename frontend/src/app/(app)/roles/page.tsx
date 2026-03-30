"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Shield, Search, Loader2, Trash2, Pencil, Building2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Role, Permission } from "@/types";

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
  const [fieldErrors, setFieldErrors] = useState<{name?: string}>({});

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
      <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass-card p-6 h-64 skeleton"></div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 glass-card">
            <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border/50">
              <Shield className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No roles found</h3>
            <p className="text-sm font-medium text-muted-foreground">Try adjusting your search terms or create a new role.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((r, i) => (
              <motion.div 
                key={r.id} 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.05 }}
                className="glass-card flex flex-col h-full group"
              >
                <div className="p-6 flex-1 flex flex-col">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center border border-brand-100 dark:border-brand-500/20 group-hover:scale-105 transition-transform duration-300">
                        <Shield className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground group-hover:text-brand-600 transition-colors">
                          {r.name}
                        </h3>
                        <p className="text-xs font-medium text-muted-foreground line-clamp-1 mt-0.5">
                          {r.description || "No description provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Company Badge (Superadmin) */}
                  {isSuperadmin && r.company && (
                    <div className="flex items-center gap-2 mb-4 p-2 rounded-xl bg-muted/50 border border-border/50">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Building2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{r.company.name}</p>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">@{r.company.slug}</p>
                      </div>
                    </div>
                  )}

                  {/* Permissions Summary */}
                  <div className="mt-2 flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Permissions</span>
                      <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full text-foreground">
                        {r.role_permissions?.length || 0}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {r.role_permissions?.slice(0, 5).map((rp) => {
                        const permKey = rp.permission?.key || "?";
                        // Color code based on permission type
                        let colorClass = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
                        if (permKey === "superadmin") colorClass = "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800";
                        else if (permKey.includes("write")) colorClass = "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800";
                        else if (permKey.includes("read")) colorClass = "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
                        
                        return (
                          <span 
                            key={rp.permission_id} 
                            className={`text-[10px] px-2 py-1 rounded-md font-mono font-medium border ${colorClass}`}
                            title={rp.permission?.description}
                          >
                            {permKey}
                          </span>
                        );
                      })}
                      {(r.role_permissions?.length || 0) > 5 && (
                        <span className="text-[10px] px-2 py-1 rounded-md font-bold bg-muted text-muted-foreground border border-border/50">
                          +{(r.role_permissions?.length || 0) - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                {canWrite && (
                  <div className="px-6 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button 
                      onClick={() => openEdit(r)} 
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-background border border-transparent hover:border-border shadow-sm text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(r.id)} 
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/30 text-xs font-bold text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative glass-card p-0 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-border/50 bg-muted/20 flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-500/10 rounded-2xl flex items-center justify-center border border-brand-500/20">
                  <Shield className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{editing ? "Edit Role Configuration" : "Create New Role"}</h2>
                  <p className="text-sm font-medium text-muted-foreground">Define role details and assign specific permissions.</p>
                </div>
              </div>
              
              <form onSubmit={handleSave} className="flex flex-col overflow-hidden flex-1" noValidate>
                <div className="p-6 overflow-y-auto space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">Role Name <span className="text-red-500">*</span></label>
                    <input 
                      value={form.name} 
                      onChange={(e) => {
                        setForm((f) => ({ ...f, name: e.target.value }));
                        if (fieldErrors.name) setFieldErrors({...fieldErrors, name: undefined});
                      }} 
                      placeholder="e.g. Area Manager"
                      className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                        fieldErrors.name 
                          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                          : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                      }`} 
                    />
                    {fieldErrors.name && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">Description</label>
                    <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description of this role's responsibilities"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/50 transition-all" />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-bold text-foreground">Permissions Configuration</label>
                    <span className="text-xs font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 px-2.5 py-1 rounded-lg border border-brand-500/20">
                      {form.permissions.length} selected
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border border-border/50 rounded-2xl bg-card/30">
                    {permissions.map((p) => {
                      const isSelected = form.permissions.includes(p.key);
                      const isSuperadminPerm = p.key === "superadmin";
                      const isWritePerm = p.key.includes("write");
                      
                      return (
                        <label 
                          key={p.id} 
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected 
                              ? isSuperadminPerm ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/10 dark:border-purple-800' : 'bg-brand-50 border-brand-200 dark:bg-brand-900/10 dark:border-brand-800'
                              : 'bg-card border-border/50 hover:bg-muted/50 hover:border-border'
                          }`}
                        >
                          <div className="pt-0.5 relative flex items-center justify-center">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setForm((f) => ({ ...f, permissions: [...f.permissions, p.key] }));
                                else setForm((f) => ({ ...f, permissions: f.permissions.filter((k) => k !== p.key) }));
                              }}
                              className="w-4 h-4 rounded border-border/80 text-brand-500 focus:ring-brand-500/30 transition-all appearance-none bg-background cursor-pointer" 
                            />
                            {isSelected && <CheckCircle2 className={`absolute pointer-events-none w-4 h-4 ${isSuperadminPerm ? 'text-purple-500' : 'text-brand-500'} bg-white dark:bg-slate-900 rounded-full`} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${
                              isSelected 
                                ? isSuperadminPerm ? 'text-purple-700 dark:text-purple-400' : 'text-brand-700 dark:text-brand-400'
                                : 'text-foreground'
                            }`}>
                              {p.key}
                            </p>
                            <p className="text-xs font-medium text-muted-foreground mt-0.5 leading-tight">{p.description}</p>
                            {isWritePerm && !isSelected && <span className="inline-block mt-1.5 text-[9px] uppercase tracking-wider font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">Write Access</span>}
                            {isSuperadminPerm && !isSelected && <span className="inline-block mt-1.5 text-[9px] uppercase tracking-wider font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded">Critical Permission</span>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                </div>
                
                <div className="p-6 border-t border-border/50 bg-muted/20 flex gap-3 shrink-0 mt-auto">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-3">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 py-3">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving Configuration...</> : "Save Role Configuration"}
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
