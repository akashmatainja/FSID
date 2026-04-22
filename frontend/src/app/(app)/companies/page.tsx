"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Loader2, Search, Plus, Users, Cpu, Calendar, Eye, Edit, Trash2, AlertCircle, MapPin, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Company } from "@/types";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";
import CustomSelect from "@/components/ui/CustomSelect";
import AnimatedPagination from "@/components/ui/AnimatedPagination";

export default function CompaniesPage() {
  const router = useRouter();
  const { permissions } = useAuth();
  const isSuperadmin = permissions["superadmin"];
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "trial" | "suspended">("all");
  const [sortBy, setSortBy] = useState<"name" | "created_at">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", status: "active" });
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; company: Company | null }>({ show: false, company: null });
  const [fieldErrors, setFieldErrors] = useState<{name?: string; slug?: string}>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Company[]>("/api/v1/companies");
      setCompanies(data);
    } catch { toast.error("Failed to load companies"); }
    finally { setLoading(false); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isSuperadmin) {
      toast.error("Access denied");
      return;
    }
    load();
  }, [isSuperadmin]);

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

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCompanies = filtered.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, sortBy, sortOrder]);

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
    console.log('Navigating to company:', company.id);
    router.push(`/companies/${company.id}`);
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

  if (!isSuperadmin) {
    return (
      <div className="flex items-center justify-center h-96 animate-fade-in">
        <div className="text-center max-w-md p-8 glass-card">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20 shadow-sm">
            <Building2 className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Access Denied</h3>
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to access the companies directory. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Companies</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Manage all companies · {companies.length} {companies.length === 1 ? 'company' : 'companies'}
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Company
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search companies by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50"
          />
        </div>
        <div className="flex gap-3">
          <CustomSelect
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as any)}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "active", label: "Active" },
              { value: "trial", label: "Trial" },
              { value: "suspended", label: "Suspended" },
            ]}
            className="min-w-[140px]"
          />
          <CustomSelect
            value={`${sortBy}-${sortOrder}`}
            onChange={(v) => {
              const [field, order] = v.split("-");
              setSortBy(field as "name" | "created_at");
              setSortOrder(order as "asc" | "desc");
            }}
            options={[
              { value: "created_at-desc", label: "Newest First" },
              { value: "created_at-asc", label: "Oldest First" },
              { value: "name-asc", label: "Name A-Z" },
              { value: "name-desc", label: "Name Z-A" },
            ]}
            className="min-w-[160px]"
          />
        </div>
      </div>

      {/* Companies Grid */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <EnergyPulseLoader text="Loading companies..." />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 glass-card">
            <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No companies found</h3>
            <p className="text-sm font-medium text-muted-foreground">
              {search ? "No matches found for your search criteria." : "Get started by adding the first company."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="p-4 pl-6 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Organization Details</th>
                  <th className="p-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Network Span</th>
                  <th className="p-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Equipment Load</th>
                  <th className="p-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">System Status</th>
                  <th className="p-4 pr-6 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {paginatedCompanies.map((company, index) => (
                  <motion.tr
                    key={company.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleView(company)}
                    className="group hover:bg-muted/10 transition-colors cursor-pointer relative"
                  >
                    <td className="p-4 pl-6 relative">
                      {/* Active Status Left Indicator */}
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition-opacity ${
                        company.status === 'active' ? 'bg-brand-500' :
                        company.status === 'suspended' ? 'bg-red-500' : 'bg-slate-500'
                      }`} />
                      <div className="flex items-center gap-4">
                        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 overflow-hidden transition-colors ${
                          company.status === 'active' ? 'bg-brand-500/10 border-brand-500/20 text-brand-500' :
                          company.status === 'suspended' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'
                        }`}>
                          <Building2 className="w-5 h-5 z-10 relative group-hover:scale-110 transition-transform" />
                          {company.status === 'active' && (
                            <div className="absolute inset-0 bg-brand-500/20 blur-md animate-pulse" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-foreground text-sm group-hover:text-brand-500 transition-colors">
                              {company.name}
                            </span>
                            {company.status === 'active' ? (
                              <span className="relative flex h-2 w-2" title="Active">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                              </span>
                            ) : (
                              <span className={`w-2 h-2 rounded-full ${company.status === 'suspended' ? 'bg-red-500' : 'bg-slate-500'}`} title={company.status} />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            <span>@{company.slug}</span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className="flex items-center gap-1.5 font-sans">
                              <Calendar className="w-3 h-3 text-brand-500/50" />
                              {new Date(company.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500 shrink-0">
                              <MapPin className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-bold text-foreground">{(company as any).branch_count || 0}</span>
                            <span className="text-xs text-muted-foreground font-medium">Nodes</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-500 shrink-0">
                              <Users className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-bold text-foreground">{company.user_count || 0}</span>
                            <span className="text-xs text-muted-foreground font-medium">Users</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-foreground font-mono tracking-tight">{company.machine_count || 0}</span>
                        <span className="text-xs text-brand-500 font-bold tracking-widest uppercase">Machines</span>
                      </div>
                      <div className="text-[10px] px-2 py-0.5 bg-brand-500/10 text-brand-500 rounded border border-brand-500/20 font-bold uppercase tracking-wider inline-flex mt-1">
                        Active Monitoring
                      </div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          company.status === "active"
                            ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20"
                            : company.status === "suspended"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                            : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          company.status === "active" ? "bg-brand-500" :
                          company.status === "suspended" ? "bg-red-500" : "bg-slate-500"
                        }`}></span>
                        {company.status === "active" ? "ACTIVE" : company.status === "suspended" ? "SUSPENDED" : "TRIAL"}
                      </span>
                    </td>

                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleView(company)}
                          className="p-1.5 rounded-lg bg-brand-500/10 text-brand-600 hover:bg-brand-500 hover:text-white border border-transparent hover:border-brand-500/20 transition-all"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openEditModal(company)}
                          className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 border border-transparent transition-all"
                          title="Edit Settings"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openDeleteModal(company)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-transparent hover:border-red-500/20 transition-all"
                          title="Terminate Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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

      {/* Add/Edit Company Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative glass-card p-0 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-brand-500/20"
            >
              {/* Header with glowing effect */}
              <div className="relative p-6 border-b border-border/50 bg-muted/20 flex items-center gap-4 overflow-hidden shrink-0">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-50" />
                <div className="relative w-12 h-12 bg-brand-500/10 rounded-2xl flex items-center justify-center border border-brand-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                  <Building2 className="w-6 h-6 text-brand-500" />
                  <div className="absolute inset-0 bg-brand-500/20 blur-md animate-pulse rounded-2xl" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight">
                    {editingCompany ? "Modify Enterprise Configuration" : "Initialize New Organization"}
                  </h2>
                  <p className="text-sm font-medium text-muted-foreground">
                    Define high-level organizational structure and tracking slug.
                  </p>
                </div>
              </div>
              
              <form onSubmit={handleSave} className="flex flex-col overflow-hidden flex-1" noValidate>
                <div className="p-6 overflow-y-auto space-y-8 bg-gradient-to-b from-transparent to-muted/5">
                  
                  {/* Identity Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                      Global Identity
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          Enterprise Name <span className="text-brand-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="e.g. Acme Corporation"
                          className={`w-full px-4 py-3 rounded-xl border bg-background/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                            fieldErrors.name 
                              ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                              : 'border-border/60 hover:border-brand-500/30 focus:ring-brand-500/30 focus:border-brand-500/50'
                          }`}
                        />
                        {fieldErrors.name && <p className="text-xs font-medium text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.name}</p>}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          Network Prefix <span className="text-brand-500">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <span className={`absolute left-4 text-sm font-mono font-bold ${fieldErrors.slug ? 'text-red-500' : 'text-brand-500'}`}>@</span>
                          <input
                            type="text"
                            value={form.slug}
                            onChange={(e) => {
                              setForm({ ...form, slug: e.target.value });
                              if (fieldErrors.slug) setFieldErrors({...fieldErrors, slug: undefined});
                            }}
                            placeholder="acme-corp"
                            className={`w-full pl-8 pr-4 py-3 rounded-xl border bg-background/50 text-sm font-mono font-medium focus:outline-none focus:ring-2 transition-all ${
                              fieldErrors.slug 
                                ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                                : 'border-border/60 hover:border-brand-500/30 focus:ring-brand-500/30 focus:border-brand-500/50'
                            }`}
                          />
                        </div>
                        {fieldErrors.slug ? (
                          <p className="text-xs font-medium text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.slug}</p>
                        ) : (
                          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1.5 ml-1">
                            Unique identifier used for routing.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Access Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      Operations Mode
                    </h3>
                    <div className="p-5 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm relative z-30">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Account Access Level
                      </label>
                      <CustomSelect
                        value={form.status}
                        onChange={(v) => setForm({ ...form, status: v })}
                        options={[
                          { value: "active", label: "Active (Unrestricted System Access)" },
                          { value: "trial", label: "Trial (Limited Node Availability)" },
                          { value: "suspended", label: "Suspended (Network Blocked)" },
                        ]}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-6 border-t border-border/50 bg-muted/20 flex gap-3 shrink-0 mt-auto">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl border border-border/60 bg-background hover:bg-muted text-sm font-bold text-foreground transition-all flex-1 md:flex-none">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 transition-all disabled:opacity-50 disabled:pointer-events-none flex-1 md:flex-none flex items-center justify-center gap-2 ml-auto"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> {editingCompany ? "Committing..." : "Deploying..."}</>
                    ) : (
                      editingCompany ? "Deploy Configuration" : "Initialize Environment"
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
                Are you sure you want to completely remove <strong>{deleteModal.company.name}</strong>? This action will delete all associated users and equipment and cannot be undone.
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
