"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users as UsersIcon, Search, Loader2, Trash2, Pencil, Shield, Building2, Calendar, Mail, Key, AlertCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { CompanyUser, Role, Company, Branch } from "@/types";

export default function UsersPage() {
  const { permissions, companyUser } = useAuth();
  const canWrite = permissions["users.write"];
  const isSuperadmin = permissions["superadmin"];
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CompanyUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role_id: "", password: "", company_id: "", branch_id: "" });
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; user: CompanyUser | null }>({ show: false, user: null });
  const [deleting, setDeleting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{name?: string; email?: string; role_id?: string; password?: string; company_id?: string; branch_id?: string}>({});

  async function load() {
    setLoading(true);
    try {
      const [usersData, rolesData] = await Promise.all([
        api.get<CompanyUser[]>("/api/v1/users"),
        api.get<Role[]>("/api/v1/roles")
      ]);
      
      setUsers(usersData);
      setRoles(rolesData);
      
      // Load companies and branches
      if (permissions["superadmin"]) {
        const companiesData = await api.get<Company[]>("/api/v1/companies");
        setCompanies(companiesData);
      }
      
      // Load branches for current company or all if superadmin
      const branchesData = await api.get<Branch[]>("/api/v1/branches");
      setBranches(branchesData);
    } catch { toast.error("Failed to load data"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [permissions]); // Reload when permissions change

  function openEdit(user: CompanyUser) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      role_id: user.user_roles?.[0]?.role_id || "",
      password: "", // Don't populate password for edit
      company_id: user.company_id || "",
      branch_id: user.branch_id || ""
    });
    setFieldErrors({});
    setShowModal(true);
  }

  function validate() {
    const errors: {name?: string; email?: string; role_id?: string; password?: string; company_id?: string; branch_id?: string} = {};
    if (!form.name || !form.name.trim()) errors.name = "Name is required";
    
    if (!form.email || !form.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = "Invalid email format";
    }

    if (!editing && !form.password) {
      errors.password = "Initial password is required";
    } else if (!editing && form.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (!form.role_id) errors.role_id = "Role assignment is required";
    
    if (isSuperadmin && !editing && !form.company_id) {
      errors.company_id = "Company selection is required";
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!validate()) return;
    
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/v1/users/${editing.id}`, form);
        toast.success("User updated successfully");
      } else {
        await api.post("/api/v1/users", form);
        toast.success("User created successfully");
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally { 
      setSaving(false); 
    }
  }

  function handleDelete(user: CompanyUser) {
    // Prevent self-deletion
    if (companyUser?.id === user.id) {
      toast.error("You cannot delete your own account");
      return;
    }

    // Show confirmation modal
    setDeleteModal({ show: true, user });
  }

  async function confirmDelete() {
    if (!deleteModal.user) return;
    
    setDeleting(true);
    try {
      await api.delete(`/api/v1/users/${deleteModal.user.id}`);
      toast.success("User deleted successfully");
      setDeleteModal({ show: false, user: null });
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (isSuperadmin && u.company?.name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">User Management</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {isSuperadmin ? "Superadmin Access" : "Company Admin Access"} · Managing {users.length} {users.length === 1 ? 'user' : 'users'}
            {isSuperadmin && ` across ${new Set(users.map(u => u.company?.name)).size} companies`}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => {
              setEditing(null);
              setForm({ name: "", email: "", role_id: "", password: "", company_id: "", branch_id: "" });
              setFieldErrors({});
              setShowModal(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add New User
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={isSuperadmin ? "Search users by name, email or company..." : "Search users by name or email..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md pl-11 pr-4 py-2.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 shadow-sm transition-all"
        />
      </div>

      {/* Users Grid */}
      <div className="glass-card overflow-hidden animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-brand-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <span className="text-sm font-medium animate-pulse">Loading users...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 glass-card">
            <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border/50">
              <UsersIcon className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No users found</h3>
            <p className="text-sm font-medium text-muted-foreground max-w-sm mx-auto">
              {search ? "We couldn't find any users matching your search terms. Please try another query." : "You haven't added any users yet. Click the button above to create your first user."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card flex flex-col h-full group"
              >
                <div className="p-6 flex-1">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-sm shadow-brand-500/20 group-hover:scale-105 transition-transform duration-300">
                        <span className="text-white font-bold text-lg">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground group-hover:text-brand-600 transition-colors">
                          {user.name}
                        </h3>
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Status Badge */}
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                        user.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user.status === "active" ? "bg-emerald-500" : "bg-slate-500"}`}></span>
                        {user.status === "active" ? "ACTIVE" : "SUSPENDED"}
                      </span>
                    </div>

                    {/* Company (for superadmin) */}
                    {isSuperadmin && user.company && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50 border border-border/50">
                        <div className="w-7 h-7 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                          <Building2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground leading-none mb-0.5">{user.company.name}</p>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">@{user.company.slug}</p>
                        </div>
                      </div>
                    )}

                    {/* Branch */}
                    {user.branch && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50 border border-border/50">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <MapPin className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground leading-none mb-0.5">{user.branch.name}</p>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{user.branch.code}</p>
                        </div>
                      </div>
                    )}

                    {/* Roles */}
                    <div>
                      <div className="flex flex-wrap gap-2">
                        {user.user_roles?.map((ur) => (
                          <span
                            key={ur.role_id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 border border-brand-100 dark:border-brand-500/20 text-xs font-bold"
                          >
                            <Shield className="w-3 h-3" />
                            {ur.role?.name || "Role"}
                          </span>
                        ))}
                        {(!user.user_roles || user.user_roles.length === 0) && (
                          <span className="text-xs font-medium text-muted-foreground italic">No roles assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border/50 bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button 
                        onClick={() => openEdit(user)} 
                        className="w-8 h-8 rounded-lg hover:bg-background border border-transparent hover:border-border shadow-sm flex items-center justify-center transition-all text-muted-foreground hover:text-foreground"
                        title="Edit user"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {companyUser?.id !== user.id && (
                        <button 
                          onClick={() => handleDelete(user)}
                          className="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/30 flex items-center justify-center transition-all text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative glass-card p-0 w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-border/50 bg-muted/20 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center border border-brand-500/20">
                  <UsersIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="text-xl font-bold text-foreground">{editing ? "Edit User Profile" : "Create New User"}</h2>
              </div>
              
              <form onSubmit={handleSave} className="flex flex-col overflow-hidden flex-1" noValidate>
                <div className="p-6 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">Full Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${fieldErrors.name ? 'text-red-500' : 'text-muted-foreground'}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <input 
                      value={form.name} 
                      onChange={(e) => {
                        setForm((f) => ({ ...f, name: e.target.value }));
                        if (fieldErrors.name) setFieldErrors({...fieldErrors, name: undefined});
                      }} 
                      placeholder="e.g. Jane Doe"
                      className={`w-full pl-11 pr-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                        fieldErrors.name 
                          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                          : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                      }`} 
                    />
                  </div>
                  {fieldErrors.name && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.name}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">Email Address <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${fieldErrors.email ? 'text-red-500' : 'text-muted-foreground'}`} />
                    <input 
                      type="email"
                      value={form.email} 
                      onChange={(e) => {
                        setForm((f) => ({ ...f, email: e.target.value }));
                        if (fieldErrors.email) setFieldErrors({...fieldErrors, email: undefined});
                      }} 
                      placeholder="jane.doe@company.com"
                      className={`w-full pl-11 pr-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                        fieldErrors.email 
                          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                          : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                      }`} 
                    />
                  </div>
                  {fieldErrors.email && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.email}</p>}
                </div>
                
                {isSuperadmin && !editing && (
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">Company <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Building2 className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${fieldErrors.company_id ? 'text-red-500' : 'text-muted-foreground'}`} />
                      <select 
                        value={form.company_id} 
                        onChange={(e) => {
                          setForm((f) => ({ ...f, company_id: e.target.value }));
                          if (fieldErrors.company_id) setFieldErrors({...fieldErrors, company_id: undefined});
                        }} 
                        className={`w-full pl-11 pr-10 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 appearance-none cursor-pointer transition-all ${
                          fieldErrors.company_id 
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                            : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                        }`}
                      >
                        <option value="" disabled>Assign to a company</option>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>
                    {fieldErrors.company_id && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.company_id}</p>}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">Branch Assignment</label>
                  <div className="relative">
                    <MapPin className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${fieldErrors.branch_id ? 'text-red-500' : 'text-muted-foreground'}`} />
                    <select 
                      value={form.branch_id} 
                      onChange={(e) => {
                        setForm((f) => ({ ...f, branch_id: e.target.value }));
                        if (fieldErrors.branch_id) setFieldErrors({...fieldErrors, branch_id: undefined});
                      }} 
                      className={`w-full pl-11 pr-10 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 appearance-none cursor-pointer transition-all ${
                        fieldErrors.branch_id 
                          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                          : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                      }`}
                    >
                      <option value="">No branch (company-wide access)</option>
                      {branches
                        .filter(branch => !isSuperadmin || !form.company_id || branch.company_id === form.company_id)
                        .map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name} ({branch.code})
                          </option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                  {fieldErrors.branch_id && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.branch_id}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">Role Assignment <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Shield className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${fieldErrors.role_id ? 'text-red-500' : 'text-muted-foreground'}`} />
                    <select 
                      value={form.role_id} 
                      onChange={(e) => {
                        setForm((f) => ({ ...f, role_id: e.target.value }));
                        if (fieldErrors.role_id) setFieldErrors({...fieldErrors, role_id: undefined});
                      }} 
                      className={`w-full pl-11 pr-10 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 appearance-none cursor-pointer transition-all ${
                        fieldErrors.role_id 
                          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                          : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                      }`}
                    >
                      <option value="" disabled>Select a role for this user</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                  {fieldErrors.role_id && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.role_id}</p>}
                </div>
                
                {!editing && (
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">Initial Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Key className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${fieldErrors.password ? 'text-red-500' : 'text-muted-foreground'}`} />
                      <input 
                        type="password"
                        value={form.password} 
                        onChange={(e) => {
                          setForm((f) => ({ ...f, password: e.target.value }));
                          if (fieldErrors.password) setFieldErrors({...fieldErrors, password: undefined});
                        }} 
                        placeholder="Minimum 8 characters"
                        className={`w-full pl-11 pr-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.password 
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                            : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                        }`} 
                      />
                    </div>
                    {fieldErrors.password && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.password}</p>}
                  </div>
                )}
                
                </div>
                
                <div className="p-6 border-t border-border/50 bg-muted/20 flex gap-3 shrink-0 mt-auto">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-2.5">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : editing ? "Update User" : "Add User"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.show && deleteModal.user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setDeleteModal({ show: false, user: null })} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative glass-card p-6 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Remove User</h2>
              <p className="text-sm font-medium text-muted-foreground mb-6">Are you sure you want to delete this user? This action cannot be undone.</p>
              
              <div className="bg-muted/50 border border-border/50 rounded-xl p-4 mb-8 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center font-bold text-muted-foreground">
                    {deleteModal.user.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{deleteModal.user.name}</p>
                    <p className="text-xs font-medium text-muted-foreground">{deleteModal.user.email}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteModal({ show: false, user: null })} 
                  className="btn-secondary flex-1"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete} 
                  disabled={deleting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-medium shadow-sm transition-all duration-200 hover:bg-red-600 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : "Yes, Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
