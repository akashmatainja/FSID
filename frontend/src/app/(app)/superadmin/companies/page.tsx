"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Loader2, Search, Plus, Users, Cpu, Calendar, Eye, Edit, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Company } from "@/types";

export default function SuperadminCompaniesPage() {
  const { permissions } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "trial">("all");
  const [sortBy, setSortBy] = useState<"name" | "created_at">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", status: "active" });
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; company: Company | null }>({ show: false, company: null });
  const [fieldErrors, setFieldErrors] = useState<{name?: string; slug?: string}>({});

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Company[]>("/api/v1/companies");
      setCompanies(data);
    } catch { toast.error("Failed to load companies"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!permissions["superadmin"]) {
      toast.error("Access denied");
      return;
    }
    load();
  }, [permissions]);

  const filtered = companies
    .filter((c) => {
      const searchMatch = 
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.toLowerCase().includes(search.toLowerCase());
      
      const statusMatch = statusFilter === "all" || c.status === statusFilter;
      
      return searchMatch && statusMatch;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

  function openCreateModal() {
    setForm({ name: "", slug: "", status: "active" });
    setEditingCompany(null);
    setFieldErrors({});
    setShowModal(true);
  }

  function openEditModal(company: Company) {
    setEditingCompany(company);
    setForm({
      name: company.name,
      slug: company.slug,
      status: company.status || "active"
    });
    setFieldErrors({});
    setShowModal(true);
  }

  function openDeleteModal(company: Company) {
    setDeleteModal({ show: true, company });
  }

  function validate() {
    const errors: {name?: string; slug?: string} = {};
    if (!form.name || !form.name.trim()) errors.name = "Company name is required";
    
    if (!form.slug || !form.slug.trim()) {
      errors.slug = "URL slug is required";
    } else if (!/^[a-z0-9-]+$/.test(form.slug)) {
      errors.slug = "Slug can only contain lowercase letters, numbers, and hyphens";
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!validate()) return;
    
    setSaving(true);
    try {
      if (editingCompany) {
        await api.put(`/api/v1/companies/${editingCompany.id}`, form);
        toast.success("Company updated successfully");
      } else {
        await api.post("/api/v1/companies", form);
        toast.success("Company created successfully");
      }
      setShowModal(false);
      setEditingCompany(null);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save company");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteModal.company) return;
    
    try {
      await api.delete(`/api/v1/companies/${deleteModal.company.id}`);
      toast.success("Company deleted successfully");
      setDeleteModal({ show: false, company: null });
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete company");
    }
  }

  function handleView(company: Company) {
    // Navigate to company dashboard or show company overview
    toast.success(`Opening dashboard for ${company.name}`);
    // Later: router.push(`/app/companies/${company.id}`);
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  function handleNameChange(name: string) {
    setForm({ 
      ...form, 
      name, 
      slug: form.slug || generateSlug(name) 
    });
    if (fieldErrors.name) setFieldErrors({...fieldErrors, name: undefined});
    if (fieldErrors.slug && generateSlug(name)) setFieldErrors({...fieldErrors, slug: undefined, name: undefined});
  }

  if (!permissions["superadmin"]) {
    return (
      <div className="flex items-center justify-center h-96 animate-fade-in">
        <div className="text-center max-w-md p-8 glass-card">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20 shadow-sm">
            <Building2 className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Access Denied</h3>
          <p className="text-sm text-muted-foreground">You don't have permission to access the companies directory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
        <span>Dashboard</span>
        <span>/</span>
        <span className="text-brand-600 dark:text-brand-400">Superadmin</span>
        <span>/</span>
        <span className="text-foreground">Companies</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Registered Companies</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Global management · {companies.length} {companies.length === 1 ? 'company' : 'companies'}
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Company
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search companies by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 shadow-sm transition-all"
          />
        </div>
        <div className="flex gap-3">
          {/* Status Filter */}
          <div className="relative min-w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 shadow-sm cursor-pointer transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          
          {/* Sort Filter */}
          <div className="relative min-w-[160px]">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split("-");
                setSortBy(field as "name" | "created_at");
                setSortOrder(order as "asc" | "desc");
              }}
              className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 shadow-sm cursor-pointer transition-all"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Companies Grid */}
      <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass-card p-6 h-64 skeleton"></div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 glass-card">
            <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border/50">
              <Building2 className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No companies found</h3>
            <p className="text-sm font-medium text-muted-foreground">
              {search ? "No matches found for your search criteria." : "Get started by adding the first company."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((company, index) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group glass-card flex flex-col h-full overflow-hidden"
              >
                <div className="p-6 flex-1 flex flex-col">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform duration-300">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground group-hover:text-brand-600 transition-colors">
                          {company.name}
                        </h3>
                        <p className="text-xs font-medium text-muted-foreground font-mono mt-0.5">@{company.slug}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-muted/40 rounded-xl p-3 border border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-brand-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Users</span>
                      </div>
                      <p className="text-xl font-extrabold text-foreground">{company.user_count || 0}</p>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-3 border border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Machines</span>
                      </div>
                      <p className="text-xl font-extrabold text-foreground">{company.machine_count || 0}</p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                        company.status === "active"
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                          : company.status === "suspended"
                          ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20"
                          : "bg-slate-50 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-500/20"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        company.status === "active" ? "bg-emerald-500" :
                        company.status === "suspended" ? "bg-red-500" : "bg-slate-500"
                      }`}></span>
                      {company.status === "active" ? "ACTIVE" : company.status === "suspended" ? "SUSPENDED" : "TRIAL"}
                    </span>
                    
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(company.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center border-t border-border/50 bg-muted/20">
                  <button 
                    onClick={() => handleView(company)}
                    className="flex-1 py-3 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 hover:bg-card transition-colors border-r border-border/50"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  <button 
                    onClick={() => openEditModal(company)}
                    className="flex-1 py-3 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-card transition-colors border-r border-border/50"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button 
                    onClick={() => openDeleteModal(company)}
                    className="flex-1 py-3 flex items-center justify-center gap-2 text-xs font-bold text-red-500/80 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Company Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative glass-card p-0 w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border/50 bg-muted/20 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center border border-brand-500/20">
                  <Building2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {editingCompany ? "Edit Company" : "Register Company"}
                </h2>
              </div>
              
              <form onSubmit={handleSave} className="flex flex-col overflow-hidden flex-1" noValidate>
                <div className="p-6 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                      fieldErrors.name 
                        ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                        : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                    }`}
                  />
                  {fieldErrors.name && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    URL Slug <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className={`absolute left-4 text-sm ${fieldErrors.slug ? 'text-red-500' : 'text-muted-foreground'}`}>@</span>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => {
                        setForm({ ...form, slug: e.target.value });
                        if (fieldErrors.slug) setFieldErrors({...fieldErrors, slug: undefined});
                      }}
                      placeholder="acme-corp"
                      className={`w-full pl-8 pr-4 py-2.5 rounded-xl border bg-card/50 text-sm font-mono font-medium focus:outline-none focus:ring-2 transition-all ${
                        fieldErrors.slug 
                          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                          : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                      }`}
                    />
                  </div>
                  {fieldErrors.slug ? (
                    <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.slug}</p>
                  ) : (
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1.5 ml-1">
                      Unique identifier
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    Account Status
                  </label>
                  <div className="relative">
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/50 transition-all cursor-pointer"
                    >
                      <option value="active">Active (Full Access)</option>
                      <option value="trial">Trial (Limited Time)</option>
                      <option value="suspended">Suspended (No Access)</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
                </div>
                
                <div className="p-6 border-t border-border/50 bg-muted/20 flex gap-3 shrink-0 mt-auto">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-2.5">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex-1 py-2.5"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> {editingCompany ? "Updating..." : "Creating..."}</>
                    ) : (
                      editingCompany ? "Update Company" : "Create Company"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.show && deleteModal.company && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setDeleteModal({ show: false, company: null })} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative glass-card p-6 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Delete Company</h3>
              <p className="text-sm font-medium text-muted-foreground mb-6">
                Are you sure you want to completely remove <strong>{deleteModal.company.name}</strong>? This action will delete all associated users and machines and cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button onClick={() => setDeleteModal({ show: false, company: null })} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button onClick={handleDelete} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-medium shadow-sm transition-all duration-200 hover:bg-red-600 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none">
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
