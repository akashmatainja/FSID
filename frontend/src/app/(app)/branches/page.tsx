"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MapPin, Search, Loader2, Trash2, Pencil, ChevronRight, Building2, AlertCircle, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Branch, Company } from "@/types";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";
import CustomSelect from "@/components/ui/CustomSelect";
import AnimatedPagination from "@/components/ui/AnimatedPagination";

const STATUS_CLASSES = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  inactive: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  maintenance: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

export default function BranchesPage() {
  const router = useRouter();
  const { permissions, companyUser } = useAuth();
  const canWrite = permissions["branches.write"];
  const isSuperadmin = permissions["superadmin"];
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ 
    name: "", 
    code: "", 
    address: "", 
    city: "",
    state: "",
    pincode: "",
    phone: "",
    email: "",
    status: "active", 
    company_id: ""
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => Promise<boolean>>();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{name?: string; code?: string; address?: string; city?: string; state?: string; pincode?: string; phone?: string; email?: string; company_id?: string}>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  async function load() {
    setLoading(true);
    try {
      const [branchesData, companiesData] = await Promise.all([
        api.get<Branch[]>("/api/v1/branches"),
        ...(isSuperadmin ? [api.get<Company[]>("/api/v1/companies")] : [])
      ]);
      
      setBranches(branchesData);
      if (isSuperadmin && companiesData) {
        setCompanies(companiesData as Company[]);
      }
    } catch { toast.error("Failed to load data"); }
    finally { setLoading(false); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [isSuperadmin]);

  function openCreate() {
    setEditing(null);
    setForm({ 
      name: "", 
      code: "", 
      address: "", 
      city: "",
      state: "",
      pincode: "",
      phone: "",
      email: "",
      status: "active", 
      company_id: ""
    });
    setFieldErrors({});
    setShowModal(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({ 
      name: b.name, 
      code: b.code, 
      address: b.address, 
      city: b.city,
      state: b.state,
      pincode: b.pincode,
      phone: b.phone,
      email: b.email,
      status: b.status, 
      company_id: b.company_id
    });
    setFieldErrors({});
    setShowModal(true);
  }

  function validate() {
    const errors: {name?: string; code?: string; company_id?: string} = {};
    if (!form.name || !form.name.trim()) errors.name = "Branch name is required";
    if (!form.code || !form.code.trim()) errors.code = "Branch code is required";
    if (isSuperadmin && !form.company_id) errors.company_id = "Company selection is required";
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!validate()) return;
    
    setSaving(true);
    try {
      // Set company_id for regular users
      const payload = isSuperadmin 
        ? form 
        : { ...form, company_id: companyUser?.company_id || "" };

      if (editing) {
        await api.put(`/api/v1/branches/${editing.id}`, payload);
        toast.success("Branch updated successfully");
      } else {
        await api.post("/api/v1/branches", payload);
        toast.success("Branch created successfully");
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save branch");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setConfirmMessage("Are you sure you want to delete this branch? This action cannot be undone.");
    setConfirmAction(() => async () => {
      try {
        await api.delete(`/api/v1/branches/${id}`);
        toast.success("Branch deleted successfully");
        load();
        return true;
      } catch (e: unknown) { 
        toast.error(e instanceof Error ? e.message : "Failed to delete branch"); 
        return false;
      }
    });
    setShowConfirmModal(true);
  }

  const filtered = branches.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.code.toLowerCase().includes(search.toLowerCase()) ||
    b.city.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBranches = filtered.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (!permissions["branches.read"]) {
    return (
      <div className="flex items-center justify-center h-96 animate-fade-in">
        <div className="text-center max-w-md p-8 glass-card">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20 shadow-sm">
            <MapPin className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Access Denied</h3>
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to access the branches directory. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Branch Management</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Manage your company branches and locations
          </p>
        </div>
        {canWrite && (
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Branch
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search branches by name or code..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md pl-11 pr-4 py-2.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 shadow-sm transition-all" />
      </div>

      {/* List */}
      <div className="glass-card overflow-hidden animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        {loading ? (
          <EnergyPulseLoader text="Loading branches..." />
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border/50">
              <MapPin className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">No branches found</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your search query or add a new branch.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-6">
            {paginatedBranches.map((b, index) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => router.push(`/branches/${b.id}`)}
                className="group glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 gap-4 hover:shadow-md hover:border-brand-500/30 transition-all duration-300 cursor-pointer"
              >
                {/* Info Section */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center border border-brand-100 dark:border-brand-500/20 shrink-0 group-hover:scale-105 transition-transform duration-300">
                    <MapPin className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-base sm:text-lg text-foreground truncate group-hover:text-brand-600 transition-colors">
                        {b.name}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border shrink-0 ${STATUS_CLASSES[b.status]}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          b.status === 'active' ? 'bg-emerald-500' :
                          b.status === 'maintenance' ? 'bg-amber-500' : 'bg-slate-500'
                        }`}></span>
                        {b.status.toUpperCase()}
                      </span>
                      {isSuperadmin && b.company && (
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-brand-500/20 shrink-0">
                          <Building2 className="w-3 h-3 mr-1" />
                          {b.company.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground flex-wrap">
                      <span className="font-mono">#{b.code}</span>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {b.city}, {b.state}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Section */}
                <div className="flex flex-col gap-1.5 px-4 py-2 bg-muted/30 rounded-xl border border-border/50 shrink-0 w-full sm:w-auto">
                  {b.phone && (
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 text-brand-500" /> {b.phone}
                    </div>
                  )}
                  {b.email && (
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 text-emerald-500" /> {b.email}
                    </div>
                  )}
                  {!b.phone && !b.email && (
                    <span className="text-xs text-muted-foreground/50 italic">No contact info</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end mt-2 sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => router.push(`/branches/${b.id}`)}
                    className="p-2 rounded-lg bg-brand-500/10 text-brand-600 hover:bg-brand-500/20 border border-transparent hover:border-brand-500/20 transition-all"
                    title="View details"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {canWrite && (
                    <>
                      <button 
                        onClick={() => openEdit(b)}
                        className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-card border border-border/50 hover:border-border transition-all"
                        title="Edit branch"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(b.id)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-transparent hover:border-red-500/20 transition-all"
                        title="Delete branch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
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

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative glass-card p-0 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-border/50 bg-muted/20 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center border border-brand-500/20">
                  <MapPin className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="text-xl font-bold text-foreground">{editing ? "Edit Branch" : "Add New Branch"}</h2>
              </div>
              
              <form onSubmit={handleSave} className="flex flex-col overflow-hidden flex-1" noValidate>
                <div className="p-6 overflow-y-auto space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">Branch Name <span className="text-red-500">*</span></label>
                    <input 
                      value={form.name} 
                      onChange={(e) => {
                        setForm((f) => ({ ...f, name: e.target.value }));
                        if (fieldErrors.name) setFieldErrors({...fieldErrors, name: undefined});
                      }} 
                      placeholder="Main Office"
                      className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                        fieldErrors.name 
                          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                          : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                      }`} 
                    />
                    {fieldErrors.name && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.name}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">Branch Code <span className="text-red-500">*</span></label>
                    <input 
                      value={form.code} 
                      onChange={(e) => {
                        setForm((f) => ({ ...f, code: e.target.value }));
                        if (fieldErrors.code) setFieldErrors({...fieldErrors, code: undefined});
                      }} 
                      placeholder="BR-001"
                      className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium font-mono focus:outline-none focus:ring-2 transition-all ${
                        fieldErrors.code 
                          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                          : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                      }`} 
                    />
                    {fieldErrors.code && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.code}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Address</label>
                      <input 
                        value={form.address} 
                        onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} 
                        placeholder="123 Main Street"
                        className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all" 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">City</label>
                      <input 
                        value={form.city} 
                        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} 
                        placeholder="Mumbai"
                        className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">State</label>
                      <input 
                        value={form.state} 
                        onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} 
                        placeholder="Maharashtra"
                        className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all" 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Pincode</label>
                      <input 
                        value={form.pincode} 
                        onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} 
                        placeholder="400001"
                        className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Phone</label>
                      <input 
                        value={form.phone} 
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} 
                        placeholder="+91 9876543210"
                        className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all" 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Email</label>
                      <input 
                        type="email"
                        value={form.email} 
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} 
                        placeholder="branch@company.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all" 
                      />
                    </div>
                  </div>
                  
                  {/* Company Selection - Only for Superadmin */}
                  {isSuperadmin && (
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">
                        Company <span className="text-red-500">*</span>
                      </label>
                      <CustomSelect
                        value={form.company_id}
                        onChange={(v) => {
                          setForm((f) => ({ ...f, company_id: v }));
                          if (fieldErrors.company_id) setFieldErrors({...fieldErrors, company_id: undefined});
                        }}
                        error={!!fieldErrors.company_id}
                        iconLeft={<Building2 className={`w-4 h-4 ${fieldErrors.company_id ? 'text-red-500' : 'text-muted-foreground'}`} />}
                        placeholder="Select a company"
                        options={companies.map((c) => ({ value: c.id, label: `${c.name} (@${c.slug})` }))}
                      />
                      {fieldErrors.company_id && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.company_id}</p>}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">Status</label>
                    <CustomSelect
                      value={form.status}
                      onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                      options={[
                        { value: "active", label: "Active" },
                        { value: "inactive", label: "Inactive" },
                        { value: "maintenance", label: "Maintenance" },
                      ]}
                    />
                  </div>
                </div>
                
                <div className="p-6 border-t border-border/50 bg-muted/20 flex justify-end gap-3 shrink-0">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium hover:bg-background transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {editing ? "Update Branch" : "Create Branch"}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative glass-card p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-foreground mb-2">Confirm Delete</h3>
              <p className="text-sm text-muted-foreground mb-6">{confirmMessage}</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 rounded-lg border border-border/60 bg-card/50 text-sm font-medium hover:bg-background transition-all">
                  Cancel
                </button>
                <button onClick={async () => {
                  if (confirmAction) {
                    const result = await confirmAction();
                    if (result) {
                      setShowConfirmModal(false);
                    }
                  }
                }} disabled={confirmLoading} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all disabled:opacity-50">
                  {confirmLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
