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
        <div className="glass-card overflow-x-auto w-full">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20 text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
                <th className="p-4 pl-6">Subdivision & Status</th>
                <th className="p-4">Parent Branch</th>
                {isSuperadmin && <th className="p-4">Organization</th>}
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {paginatedSubdivisions.map((subdivision, index) => (
                <motion.tr
                  key={subdivision.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group hover:bg-muted/10 transition-colors relative"
                >
                  <td className="p-4 pl-6 relative">
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition-opacity ${
                      subdivision.status === 'active' ? 'bg-purple-500' : 'bg-slate-500'
                    }`} />
                    <div className="flex items-center gap-4">
                      <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 overflow-hidden transition-colors ${
                        subdivision.status === 'active' ? 'bg-purple-500/10 border-purple-500/20 text-purple-500' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'
                      }`}>
                        <GitBranch className="w-5 h-5 z-10 relative group-hover:scale-110 transition-transform" />
                        {subdivision.status === 'active' && (
                          <div className="absolute inset-0 bg-purple-500/20 blur-md animate-pulse" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-foreground text-sm group-hover:text-purple-500 transition-colors">
                            {subdivision.name}
                          </span>
                          {subdivision.status === 'active' ? (
                            <span className="relative flex h-2 w-2" title="Active">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                            </span>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-500" title={subdivision.status} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                          <span>#{subdivision.code}</span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="uppercase tracking-wider text-[10px] font-semibold">{subdivision.status}</span>
                        </div>
                        {subdivision.description && (
                          <div className="text-[10px] text-muted-foreground/70 mt-1 max-w-xs truncate">
                            {subdivision.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500 shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{subdivision.branch?.name || "N/A"}</span>
                    </div>
                  </td>

                  {isSuperadmin && (
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-brand-500/70" />
                        <span className="text-sm font-medium text-foreground">{subdivision.company?.name || "N/A"}</span>
                      </div>
                    </td>
                  )}

                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                      {canWrite && (
                        <>
                          <button
                            onClick={() => openEditModal(subdivision)}
                            className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 border border-transparent transition-all"
                            title="Configure Subdivision"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(subdivision.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-transparent hover:border-red-500/20 transition-all"
                            title="Decommission Subdivision"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
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
              className="relative glass-card p-0 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-purple-500/20"
            >
              {/* Header with glowing effect */}
              <div className="relative p-6 border-b border-border/50 bg-muted/20 flex items-center gap-4 overflow-hidden shrink-0">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />
                <div className="relative w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                  <GitBranch className="w-6 h-6 text-purple-500" />
                  <div className="absolute inset-0 bg-purple-500/20 blur-md animate-pulse rounded-2xl" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight">
                    {editingId ? "Modify Subdivision Sector" : "Initialize New Subdivision"}
                  </h2>
                  <p className="text-sm font-medium text-muted-foreground">
                    Define operational zone hierarchy within the active branch.
                  </p>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-8 bg-gradient-to-b from-transparent to-muted/5">
                {/* Node Assignment Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Network Hierarchy
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm relative z-30">
                    {isSuperadmin && (
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          Company Node <span className="text-purple-500">*</span>
                        </label>
                        <CustomSelect
                          value={selectedCompany}
                          onChange={(v) => {
                            setSelectedCompany(v);
                            setSelectedBranch("");
                            setForm({ ...form, branch_id: "" });
                          }}
                          iconLeft={<Building2 className="w-4 h-4 text-muted-foreground" />}
                          allowClear
                          placeholder="Select company network..."
                          options={[
                            ...companies.map((c) => ({ value: c.id, label: c.name }))
                          ]}
                        />
                      </div>
                    )}

                    <div className={`col-span-1 ${!isSuperadmin ? 'md:col-span-2' : 'md:col-span-2'} relative z-20`}>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Branch Gateway <span className="text-purple-500">*</span>
                      </label>
                      <CustomSelect
                        value={form.branch_id}
                        onChange={(v) => setForm({ ...form, branch_id: v })}
                        error={!!fieldErrors.branch_id}
                        iconLeft={<MapPin className={`w-4 h-4 ${fieldErrors.branch_id ? 'text-red-500' : 'text-muted-foreground'}`} />}
                        allowClear
                        placeholder="Select branch routing..."
                        options={[
                          ...branches
                            .filter((b) => !isSuperadmin || !selectedCompany || b.company_id === selectedCompany)
                            .map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))
                        ]}
                      />
                      {fieldErrors.branch_id && (
                        <p className="text-xs font-medium text-red-500 mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {fieldErrors.branch_id}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-Node Identity */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    Sub-Node Identity
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Subdivision Name <span className="text-purple-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border bg-background/50 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.name
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500'
                            : 'border-border/60 hover:border-purple-500/30 focus:ring-purple-500/30 focus:border-purple-500/50'
                        }`}
                        placeholder="e.g., Production Floor A"
                      />
                      {fieldErrors.name && (
                        <p className="text-xs font-medium text-red-500 mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {fieldErrors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Subdivision Code <span className="text-purple-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                        className={`w-full px-4 py-3 rounded-xl border bg-background/50 text-sm font-medium font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.code
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500'
                            : 'border-border/60 hover:border-purple-500/30 focus:ring-purple-500/30 focus:border-purple-500/50'
                        }`}
                        placeholder="e.g., PFA"
                      />
                      {fieldErrors.code && (
                        <p className="text-xs font-medium text-red-500 mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {fieldErrors.code}
                        </p>
                      )}
                    </div>

                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background/50 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 hover:border-purple-500/30 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all resize-none"
                        placeholder="Optional system description..."
                      />
                    </div>
                  </div>
                </div>

                {/* Operations Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    Sub-Node Operations
                  </h3>
                  <div className="p-5 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Status</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setForm({ ...form, status: "active" })}
                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all border ${
                          form.status === "active"
                            ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                            : "bg-background border-border/50 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${form.status === "active" ? "bg-purple-500 animate-pulse" : "bg-transparent"}`} />
                          ONLINE
                        </div>
                      </button>
                      <button
                        onClick={() => setForm({ ...form, status: "inactive" })}
                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all border ${
                          form.status === "inactive"
                            ? "bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/50"
                            : "bg-background border-border/50 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${form.status === "inactive" ? "bg-slate-500" : "bg-transparent"}`} />
                          OFFLINE
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border/50 bg-muted/20 flex gap-3 shrink-0 mt-auto">
                <button onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl border border-border/60 bg-background hover:bg-muted text-sm font-bold text-foreground transition-all flex-1 md:flex-none">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all disabled:opacity-50 disabled:pointer-events-none flex-1 md:flex-none flex items-center justify-center gap-2 ml-auto">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {editingId ? "Committing..." : "Deploying..."}
                    </>
                  ) : (
                    <>
                      {editingId ? "Deploy Changes" : "Initialize Sector"}
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
