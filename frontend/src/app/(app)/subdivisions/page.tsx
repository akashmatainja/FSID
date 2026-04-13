"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Plus, Edit2, Trash2, Building2, MapPin, X, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";
import CustomSelect from "@/components/ui/CustomSelect";
import AnimatedPagination from "@/components/ui/AnimatedPagination";
import type { Subdivision, Branch, Company } from "@/types";

export default function SubdivisionsPage() {
  const { permissions, isSuperadmin, companyUser } = useAuth();
  const canWrite = permissions["subdivisions.write"];
  
  const [subdivisions, setSubdivisions] = useState<Subdivision[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<string>(companyUser?.company_id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => Promise<boolean>) | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [form, setForm] = useState({
    branch_id: "",
    name: "",
    code: "",
    description: "",
    status: "active" as "active" | "inactive",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  async function load() {
    setLoading(true);
    try {
      // Load branches first
      const branchesResponse = await api.get<Branch[]>("/api/v1/branches");
      setBranches(branchesResponse);
      
      // Try to load subdivisions (might fail with 404)
      try {
        const subdivisionsResponse = await api.get<Subdivision[]>("/api/v1/subdivisions");
        setSubdivisions(subdivisionsResponse);
      } catch (subdivisionsError) {
        setSubdivisions([]);
      }
      
      // Load companies if superadmin
      if (isSuperadmin) {
        try {
          const companiesResponse = await api.get<Company[]>("/api/v1/companies");
          setCompanies(companiesResponse);
        } catch (companiesError) {
          setCompanies([]);
        }
      }
      
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [isSuperadmin]);

  function openCreateModal() {
    setEditingId(null);
    setForm({ branch_id: "", name: "", code: "", description: "", status: "active" });
    setFieldErrors({});
    setSelectedCompany(companyUser?.company_id || "");
    setSelectedBranch("");
    setShowModal(true);
  }

  function openEditModal(subdivision: Subdivision) {
    setEditingId(subdivision.id);
    setForm({
      branch_id: subdivision.branch_id,
      name: subdivision.name,
      code: subdivision.code,
      description: subdivision.description,
      status: subdivision.status,
    });
    setFieldErrors({});
    setSelectedCompany(subdivision.company_id);
    setSelectedBranch(subdivision.branch_id);
    setShowModal(true);
  }

  async function handleSave() {
    setFieldErrors({});
    const errors: Record<string, string> = {};

    if (!form.branch_id) errors.branch_id = "Branch is required";
    if (!form.name.trim()) errors.name = "Name is required";
    if (!form.code.trim()) errors.code = "Code is required";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/v1/subdivisions/${editingId}`, form);
        toast.success("Subdivision updated successfully");
      } else {
        await api.post("/api/v1/subdivisions", form);
        toast.success("Subdivision created successfully");
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save subdivision");
    } finally {
      setSaving(false);
    }
  }

  function openDeleteConfirm(id: string) {
    setConfirmMessage("Are you sure you want to delete this subdivision? This action cannot be undone.");
    setConfirmAction(() => async () => {
      try {
        await api.delete(`/api/v1/subdivisions/${id}`);
        toast.success("Subdivision deleted successfully");
        load();
        return true;
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to delete subdivision");
        return false;
      }
    });
    setShowConfirmModal(true);
  }

  const filteredSubdivisions = subdivisions.filter((s) => {
    const searchMatch = 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Default to true if not selected
    const branchMatch = !selectedBranch || s.branch_id === selectedBranch;
    
    // For company match, we need to check if the branch belongs to the selected company
    const branch = branches.find(b => b.id === s.branch_id);
    const companyMatch = !selectedCompany || branch?.company_id === selectedCompany;

    return searchMatch && branchMatch && companyMatch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredSubdivisions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSubdivisions = filteredSubdivisions.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when search/filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBranch, selectedCompany]);

  return (
    <>
      <div className="space-y-6 animate-fade-in pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Subdivisions</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Manage subdivisions under branches
          </p>
        </div>
        {canWrite && (
          <button onClick={openCreateModal} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Subdivision
          </button>
        )}
      </div>

      {loading ? (
        <div className="glass-card overflow-hidden">
          <EnergyPulseLoader text="Loading subdivisions..." />
        </div>
      ) : subdivisions.length === 0 ? (
        <div className="text-center py-20 glass-card">
          <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border/50">
            <GitBranch className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">No subdivisions yet</h3>
          <p className="text-sm font-medium text-muted-foreground mb-6">
            Get started by creating your first subdivision.
          </p>
          {canWrite && (
            <button onClick={openCreateModal} className="btn-primary">
              <Plus className="w-4 h-4" />
              Create Subdivision
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {paginatedSubdivisions.map((subdivision, index) => (
            <motion.div
              key={subdivision.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 gap-4 hover:shadow-md hover:border-purple-500/30 transition-all duration-300"
            >
              {/* Info Section */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <GitBranch className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base sm:text-lg font-bold text-foreground truncate group-hover:text-purple-600 transition-colors">
                      {subdivision.name}
                    </h3>
                    <span
                      className={`inline-flex items-center text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border shrink-0 ${
                        subdivision.status === "active"
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                          : "bg-slate-50 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-500/30"
                      }`}
                    >
                      {subdivision.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground flex-wrap">
                    <span className="font-mono">#{subdivision.code}</span>
                    {subdivision.description && (
                      <span className="truncate max-w-[200px] sm:max-w-md hidden sm:inline-block">
                        • {subdivision.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Hierarchy Section */}
              <div className="flex flex-col gap-1.5 px-4 py-2 bg-muted/30 rounded-xl border border-border/50 shrink-0 w-full sm:w-auto">
                {subdivision.branch && (
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 text-brand-500" />
                    <span className="truncate max-w-[150px]">{subdivision.branch.name}</span>
                  </div>
                )}
                {subdivision.company && (
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    <span className="truncate max-w-[150px]">{subdivision.company.name}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {canWrite && (
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end mt-2 sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(subdivision)}
                    className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-card border border-border/50 hover:border-border transition-all"
                    title="Edit subdivision"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(subdivision.id)}
                    className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-transparent hover:border-red-500/20 transition-all"
                    title="Delete subdivision"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {filteredSubdivisions.length > 0 && !loading && (
        <AnimatedPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative glass-card p-0 w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
                    <GitBranch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {editingId ? "Edit Subdivision" : "Create Subdivision"}
                    </h2>
                    <p className="text-sm font-medium text-muted-foreground">
                      {editingId ? "Update subdivision details" : "Add a new subdivision"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                {isSuperadmin && (
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">
                      Company <span className="text-red-500">*</span>
                    </label>
                    <CustomSelect
                      value={selectedCompany}
                      onChange={(v) => {
                        setSelectedCompany(v);
                        setSelectedBranch("");
                        setForm({ ...form, branch_id: "" });
                      }}
                      iconLeft={<Building2 className="w-4 h-4 text-muted-foreground" />}
                      placeholder="Select company..."
                      options={[
                        { value: "", label: "Select company..." },
                        ...companies.map((c) => ({ value: c.id, label: c.name }))
                      ]}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    Branch <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    value={form.branch_id}
                    onChange={(v) => setForm({ ...form, branch_id: v })}
                    error={!!fieldErrors.branch_id}
                    iconLeft={<MapPin className={`w-4 h-4 ${fieldErrors.branch_id ? 'text-red-500' : 'text-muted-foreground'}`} />}
                    placeholder="Select branch..."
                    options={[
                      { value: "", label: "Select branch...", disabled: true },
                      ...branches
                        .filter((b) => !isSuperadmin || !selectedCompany || b.company_id === selectedCompany)
                        .map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))
                    ]}
                  />
                  {fieldErrors.branch_id && (
                    <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {fieldErrors.branch_id}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border bg-card/50 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all ${
                      fieldErrors.name
                        ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500'
                        : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                    }`}
                    placeholder="e.g., Production Floor A"
                  />
                  {fieldErrors.name && (
                    <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {fieldErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className={`w-full px-4 py-3 rounded-xl border bg-card/50 text-sm font-medium font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all ${
                      fieldErrors.code
                        ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500'
                        : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                    }`}
                    placeholder="e.g., PFA"
                  />
                  {fieldErrors.code && (
                    <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {fieldErrors.code}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border/60 bg-card/50 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all resize-none"
                    placeholder="Optional description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">Status</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setForm({ ...form, status: "active" })}
                      className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                        form.status === "active"
                          ? "bg-emerald-500 text-white shadow-md"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => setForm({ ...form, status: "inactive" })}
                      className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                        form.status === "inactive"
                          ? "bg-slate-500 text-white shadow-md"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border/50 bg-muted/20 flex gap-3 shrink-0 mt-auto">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-2.5">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {editingId ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      {editingId ? "Update" : "Create"} Subdivision
                    </>
                  )}
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
                    setConfirmLoading(true);
                    const result = await confirmAction();
                    if (result) {
                      setShowConfirmModal(false);
                    }
                    setConfirmLoading(false);
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
    </>
  );
}
