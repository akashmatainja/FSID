"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Package, Edit, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";
import AnimatedPagination from "@/components/ui/AnimatedPagination";
import type { Module } from "@/types";

export default function ModulesPage() {
  const { permissions } = useAuth();
  const isSuperadmin = permissions["superadmin"];

  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; module: Module | null }>({ show: false, module: null });
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    unit: "",
    status: "active"
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Module[]>("/api/v1/modules");
      setModules(data);
    } catch (error) {
      toast.error("Failed to load modules");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isSuperadmin) {
      load();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = modules.filter(module =>
    module.name.toLowerCase().includes(search.toLowerCase()) ||
    module.code.toLowerCase().includes(search.toLowerCase()) ||
    module.unit.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedModules = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  function openCreateModal() {
    setEditingModule(null);
    setForm({ name: "", code: "", description: "", unit: "", status: "active" });
    setFieldErrors({});
    setShowModal(true);
  }

  function openEditModal(module: Module) {
    setEditingModule(module);
    setForm({
      name: module.name,
      code: module.code,
      description: module.description,
      unit: module.unit,
      status: module.status
    });
    setFieldErrors({});
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setSaving(true);

    try {
      if (editingModule) {
        await api.put(`/api/v1/modules/${editingModule.id}`, form);
        toast.success("Module updated successfully");
      } else {
        await api.post("/api/v1/modules", form);
        toast.success("Module created successfully");
      }
      setShowModal(false);
      load();
    } catch (error: any) {
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error(editingModule ? "Failed to update module" : "Failed to create module");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteModal.module) return;

    setDeleting(true);
    try {
      await api.delete(`/api/v1/modules/${deleteModal.module.id}`);
      toast.success("Module deleted successfully");
      setDeleteModal({ show: false, module: null });
      load();
    } catch (error: any) {
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error("Failed to delete module");
      }
    } finally {
      setDeleting(false);
    }
  }

  if (!isSuperadmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">Only superadmins can manage modules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Modules</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Manage monitoring modules for machines
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Module
        </button>
      </div>

      {/* Search */}
      <div className="relative animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search modules by name, code, or unit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md pl-11 pr-4 py-2.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 shadow-sm transition-all"
        />
      </div>

      {/* Modules Grid */}
      <div className="glass-card overflow-hidden animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        {loading ? (
          <EnergyPulseLoader text="Loading modules..." />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 glass-card">
            <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border/50">
              <Package className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No modules found</h3>
            <p className="text-sm font-medium text-muted-foreground max-w-sm mx-auto">
              {search ? "We couldn&apos;t find any modules matching your search terms." : "No modules have been created yet. Click the button above to create your first module."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
            {paginatedModules.map((module, index) => (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-6 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                      <Package className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground group-hover:text-brand-600 transition-colors">
                        {module.name}
                      </h3>
                      <p className="text-xs font-medium text-muted-foreground">{module.code}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    module.status === "active"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-slate-500/10 text-slate-600 border-slate-500/20"
                  }`}>
                    {module.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit</p>
                    <p className="text-sm font-bold text-foreground">{module.unit}</p>
                  </div>
                  {module.description && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</p>
                      <p className="text-sm text-foreground line-clamp-2">{module.description}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                  <button
                    onClick={() => openEditModal(module)}
                    className="flex-1 px-3 py-2 rounded-lg border border-border/60 bg-card/50 hover:bg-background transition-all text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteModal({ show: true, module })}
                    className="flex-1 px-3 py-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all text-sm font-medium text-red-600 dark:text-red-400 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > itemsPerPage && (
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
              className="relative glass-card p-0 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border/50 bg-muted/20 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center border border-brand-500/20">
                  <Package className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {editingModule ? "Edit Module" : "Create Module"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {editingModule ? "Update module information" : "Add a new monitoring module"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">Module Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all"
                      placeholder="e.g., Power, Energy, Voltage"
                      required
                    />
                    {fieldErrors.name && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">Module Code <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all"
                      placeholder="e.g., POWER, ENERGY, VOLTAGE"
                      required
                    />
                    {fieldErrors.code && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.code}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">Unit <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      placeholder="e.g., kW, kWh, V, A"
                      className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all"
                      required
                    />
                    {fieldErrors.unit && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.unit}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all resize-none"
                      placeholder="Brief description of what this module monitors..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">Status</label>
                    <div className="relative">
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 appearance-none cursor-pointer transition-all"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-border/50 bg-muted/20 flex gap-3 shrink-0 mt-auto">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)} 
                    className="btn-secondary flex-1 py-2.5"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving} 
                    className="btn-primary flex-1 py-2.5"
                  >
                    {saving ? "Saving..." : editingModule ? "Update Module" : "Create Module"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.show && deleteModal.module && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
              onClick={() => setDeleteModal({ show: false, module: null })} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative glass-card p-0 w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border/50 bg-red-500/10 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Delete Module</h2>
                  <p className="text-sm text-muted-foreground">Confirm module deletion</p>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-3">
                    Are you sure you want to delete this module? This action cannot be undone.
                  </p>
                  <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{deleteModal.module.name}</p>
                        <p className="text-xs text-muted-foreground">Code: {deleteModal.module.code}</p>
                        {deleteModal.module.unit && (
                          <p className="text-xs text-muted-foreground">Unit: {deleteModal.module.unit}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setDeleteModal({ show: false, module: null })} 
                    className="btn-secondary flex-1 py-2.5"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium shadow-sm transition-all duration-200 hover:bg-red-600 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {deleting ? "Deleting..." : "Delete Module"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
