"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Cpu, MapPin, Search, Loader2, Trash2, Pencil, ChevronRight, Building2, AlertCircle, Package } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Machine, Company, Branch, Subdivision, Module } from "@/types";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";
import CustomSelect from "@/components/ui/CustomSelect";
import AnimatedPagination from "@/components/ui/AnimatedPagination";

const STATUS_CLASSES = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  inactive: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  maintenance: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

export default function MachinesPage() {
  const router = useRouter();
  const { permissions, companyUser } = useAuth();
  const canWrite = permissions["machines.write"];
  const isSuperadmin = permissions["superadmin"];
  const [machines, setMachines] = useState<Machine[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    code: string;
    location: string;
    status: string;
    company_id: string;
    branch_id: string;
    equipment_type: string;
    rated_power: string;
    voltage_rating: string;
    energy_meter_id: string;
    operating_hours: string;
    manufacturer: string;
    model_number: string;
    installation_date: string;
    maintenance_schedule: string;
    phase: string;
    critical_equipment: string;
    sub_unit_monitoring: string;
    baseline_consumption: string;
    energy_cost_rate: string;
    efficiency_target: string;
    solar_compatible: string;
    solar_priority: string;
  }>({
    name: "",
    code: "",
    location: "",
    status: "active",
    company_id: "",
    branch_id: "",
    equipment_type: "",
    rated_power: "",
    voltage_rating: "",
    energy_meter_id: "",
    operating_hours: "",
    manufacturer: "",
    model_number: "",
    installation_date: "",
    maintenance_schedule: "",
    phase: "",
    critical_equipment: "",
    sub_unit_monitoring: "",
    baseline_consumption: "",
    energy_cost_rate: "",
    efficiency_target: "",
    solar_compatible: "",
    solar_priority: ""
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => Promise<boolean>>();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    code?: string;
    location?: string;
    company_id?: string;
    branch_id?: string;
    equipment_type?: string;
    rated_power?: string;
    voltage_rating?: string;
    operating_hours?: string;
    energy_meter_id?: string;
    manufacturer?: string;
    model_number?: string;
    installation_date?: string;
    maintenance_schedule?: string;
    phase?: string;
    critical_equipment?: string;
    sub_unit_monitoring?: string;
    baseline_consumption?: string;
    energy_cost_rate?: string;
    efficiency_target?: string;
    solar_compatible?: string;
    solar_priority?: string;
  }>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  async function load() {
    setLoading(true);
    try {
      const machinesData = await api.get<Machine[]>("/api/v1/machines");
      const branchesData = await api.get<Branch[]>("/api/v1/branches");

      setMachines(machinesData);
      setBranches(branchesData);
      
      if (isSuperadmin) {
        const companiesData = await api.get<Company[]>("/api/v1/companies");
        setCompanies(companiesData);
      }
    } catch { toast.error("Failed to load machines"); }
    finally { setLoading(false); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [isSuperadmin]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      code: "",
      location: "",
      status: "active",
      company_id: "",
      branch_id: "",
      equipment_type: "",
      rated_power: "",
      voltage_rating: "",
      energy_meter_id: "",
      operating_hours: "",
      manufacturer: "",
      model_number: "",
      installation_date: "",
      maintenance_schedule: "",
      phase: "",
      critical_equipment: "",
      sub_unit_monitoring: "",
      baseline_consumption: "",
      energy_cost_rate: "",
      efficiency_target: "",
      solar_compatible: "",
      solar_priority: ""
    });
    setFieldErrors({});
    setShowModal(true);
  }

  function openEdit(m: Machine) {
    setEditing(m);
    setForm({
      name: m.name,
      code: m.code,
      location: m.location,
      status: m.status,
      company_id: m.company_id,
      branch_id: m.branch_id || "",
      equipment_type: m.equipment_type || "",
      rated_power: m.rated_power?.toString() || "",
      voltage_rating: m.voltage_rating || "",
      energy_meter_id: m.energy_meter_id || "",
      operating_hours: m.operating_hours?.toString() || "",
      manufacturer: m.manufacturer || "",
      model_number: m.model_number || "",
      installation_date: m.installation_date ? m.installation_date.split('T')[0] : "",
      maintenance_schedule: m.maintenance_schedule || "",
      phase: m.phase || "",
      critical_equipment: m.critical_equipment || "",
      sub_unit_monitoring: m.sub_unit_monitoring || "",
      baseline_consumption: m.baseline_consumption?.toString() || "",
      energy_cost_rate: m.energy_cost_rate?.toString() || "",
      efficiency_target: m.efficiency_target?.toString() || "",
      solar_compatible: m.solar_compatible || "",
      solar_priority: m.solar_priority || ""
    });
    setFieldErrors({});
    setShowModal(true);
  }

  function validate() {
    const errors: {
      name?: string;
      code?: string;
      location?: string;
      company_id?: string;
      branch_id?: string;
      equipment_type?: string;
      rated_power?: string;
      voltage_rating?: string;
      operating_hours?: string;
      energy_meter_id?: string;
      manufacturer?: string;
      model_number?: string;
      installation_date?: string;
      maintenance_schedule?: string;
      phase?: string;
      critical_equipment?: string;
      sub_unit_monitoring?: string;
      baseline_consumption?: string;
      energy_cost_rate?: string;
      efficiency_target?: string;
      solar_compatible?: string;
      solar_priority?: string;
    } = {};
    if (!form.name || !form.name.trim()) errors.name = "Machine name is required";
    if (!form.code || !form.code.trim()) errors.code = "Machine code is required";
    if (!form.location || !form.location.trim()) errors.location = "Location is required";
    // Only require branch_id for new machine (not when editing existing machine without branch)
if (!form.branch_id && !editing) errors.branch_id = "Branch selection is required";
    if (isSuperadmin && !form.company_id) errors.company_id = "Company selection is required";
    
    // Energy monitoring validations
    if (!form.equipment_type) errors.equipment_type = "Machine type is required";
    if (!form.rated_power || parseFloat(form.rated_power) <= 0) errors.rated_power = "Rated power must be greater than 0";
    if (!form.operating_hours || parseFloat(form.operating_hours) <= 0 || parseFloat(form.operating_hours) > 24) {
      errors.operating_hours = "Operating hours must be between 0 and 24";
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!validate()) return;
    
    setSaving(true);
    try {
      // Set company_id for regular users
      const basePayload = isSuperadmin 
        ? form 
        : { ...form, company_id: companyUser?.company_id || "" };

      // Convert numeric string fields to numbers for backend
      const payload = {
        ...basePayload,
        rated_power: basePayload.rated_power ? parseFloat(basePayload.rated_power) : 0,
        operating_hours: basePayload.operating_hours ? parseFloat(basePayload.operating_hours) : 0,
      };

      if (editing) {
        await api.put(`/api/v1/machines/${editing.id}`, payload);
        toast.success("Machine updated successfully");
      } else {
        await api.post("/api/v1/machines", payload);
        toast.success("Machine created successfully");
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save machine");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setConfirmMessage("Are you sure you want to delete this machine? This action cannot be undone.");
    setConfirmAction(() => async () => {
      try {
        await api.delete(`/api/v1/machines/${id}`);
        toast.success("Machine deleted successfully");
        load();
        return true;
      } catch (e: unknown) { 
        toast.error(e instanceof Error ? e.message : "Failed to delete machine"); 
        return false;
      }
    });
    setShowConfirmModal(true);
  }

  const filtered = machines.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMachines = filtered.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (!permissions["machines.read"]) {
    return (
      <div className="flex items-center justify-center h-96 animate-fade-in">
        <div className="text-center max-w-md p-8 glass-card">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20 shadow-sm">
            <Cpu className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Access Denied</h3>
          <p className="text-sm text-muted-foreground">You don&apos;t have permission to access the machines directory. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Machine Monitoring</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Monitor and manage energy consumption across your machines
          </p>
        </div>
        {canWrite && (
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Machine
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search machines by name or code..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md pl-11 pr-4 py-2.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 shadow-sm transition-all" />
      </div>

      {/* List */}
      <div className="glass-card overflow-hidden animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        {loading ? (
          <EnergyPulseLoader text="Loading machines..." />
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border/50">
              <Cpu className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">No machines found</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your search query or add new machines.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-6">
            {paginatedMachines.map((m, index) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => router.push(`/machines/${m.id}`)}
                className="group glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 gap-4 hover:shadow-md hover:border-brand-500/30 transition-all duration-300 cursor-pointer"
              >
                {/* Info Section */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center border border-brand-100 dark:border-brand-500/20 shrink-0 group-hover:scale-105 transition-transform duration-300">
                    <Cpu className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-base sm:text-lg text-foreground truncate group-hover:text-brand-600 transition-colors">
                        {m.name}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border shrink-0 ${STATUS_CLASSES[m.status]}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          m.status === 'active' ? 'bg-emerald-500' :
                          m.status === 'maintenance' ? 'bg-amber-500' : 'bg-slate-500'
                        }`}></span>
                        {m.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground flex-wrap">
                      <span className="font-mono">#{m.code}</span>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {m.location}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Company Section */}
                {isSuperadmin && m.company && (
                  <div className="flex flex-col px-4 py-2 bg-muted/30 rounded-xl border border-border/50 shrink-0 w-full sm:w-auto">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Company</span>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-brand-500" />
                      <span className="text-sm font-bold text-foreground truncate max-w-[150px]">{m.company.name}</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end mt-2 sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => router.push(`/machines/${m.id}`)}
                    className="p-2 rounded-lg bg-brand-500/10 text-brand-600 hover:bg-brand-500/20 border border-transparent hover:border-brand-500/20 transition-all"
                    title="View details"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {canWrite && (
                    <>
                      <button 
                        onClick={() => openEdit(m)}
                        className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-card border border-border/50 hover:border-border transition-all"
                        title="Edit machine"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(m.id)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-transparent hover:border-red-500/20 transition-all"
                        title="Delete machine"
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
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative glass-card p-0 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-border/50 bg-muted/20 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center border border-brand-500/20">
                  <Cpu className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="text-xl font-bold text-foreground">{editing ? "Edit Machine" : "Add New Machine"}</h2>
              </div>
              
              <form onSubmit={handleSave} className="flex flex-col overflow-hidden flex-1" noValidate>
                <div className="p-6 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">Name <span className="text-red-500">*</span></label>
                  <input 
                    value={form.name} 
                    onChange={(e) => {
                      setForm((f) => ({ ...f, name: e.target.value }));
                      if (fieldErrors.name) setFieldErrors({...fieldErrors, name: undefined});
                    }} 
                    placeholder="CNC Lathe Alpha"
                    className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                      fieldErrors.name 
                        ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                        : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                    }`} 
                  />
                  {fieldErrors.name && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.name}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">Code <span className="text-red-500">*</span></label>
                  <input 
                    value={form.code} 
                    onChange={(e) => {
                      setForm((f) => ({ ...f, code: e.target.value }));
                      if (fieldErrors.code) setFieldErrors({...fieldErrors, code: undefined});
                    }} 
                    placeholder="MCH-001"
                    className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium font-mono focus:outline-none focus:ring-2 transition-all ${
                      fieldErrors.code 
                        ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                        : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                    }`} 
                  />
                  {fieldErrors.code && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.code}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">Location <span className="text-red-500">*</span></label>
                  <input 
                    value={form.location} 
                    onChange={(e) => {
                      setForm((f) => ({ ...f, location: e.target.value }));
                      if (fieldErrors.location) setFieldErrors({...fieldErrors, location: undefined});
                    }} 
                    placeholder="Plant A"
                    className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                      fieldErrors.location 
                        ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                        : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                    }`} 
                  />
                  {fieldErrors.location && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.location}</p>}
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
                        setForm((f) => ({ ...f, company_id: v, branch_id: "" }));
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
                  <label className="block text-sm font-bold text-foreground mb-1.5">Branch {editing ? "" : <span className="text-red-500">*</span>}</label>
                  <CustomSelect
                    value={form.branch_id}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, branch_id: v }));
                      if (fieldErrors.branch_id) setFieldErrors({...fieldErrors, branch_id: undefined});
                    }}
                    error={!!fieldErrors.branch_id}
                    iconLeft={<MapPin className={`w-4 h-4 ${fieldErrors.branch_id ? 'text-red-500' : 'text-muted-foreground'}`} />}
                    placeholder={form.company_id ? "Select a branch" : "Select a company first"}
                    options={branches
                      .filter(b => !form.company_id || b.company_id === form.company_id)
                      .map((b) => ({ value: b.id, label: `${b.name} (${b.city}, ${b.state})` }))}
                  />
                  {fieldErrors.branch_id && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.branch_id}</p>}
                </div>

                {/* Energy Monitoring Fields */}
                <div className="border-t border-border/50 pt-4">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                    Energy Monitoring Details
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Machine Type <span className="text-red-500">*</span></label>
                      <CustomSelect
                        value={form.equipment_type}
                        onChange={(v) => {
                          setForm((f) => ({ ...f, equipment_type: v }));
                          if (fieldErrors.equipment_type) setFieldErrors({...fieldErrors, equipment_type: undefined});
                        }}
                        error={!!fieldErrors.equipment_type}
                        placeholder="Select machine type"
                        options={[
                          { value: "motor", label: "Motor" },
                          { value: "pump", label: "Pump" },
                          { value: "compressor", label: "Compressor" },
                          { value: "hvac", label: "HVAC" },
                          { value: "lighting", label: "Lighting" },
                          { value: "production", label: "Production Machine" },
                          { value: "conveyor", label: "Conveyor" },
                          { value: "other", label: "Other" },
                        ]}
                      />
                      {fieldErrors.equipment_type && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.equipment_type}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Rated Power (kW) <span className="text-red-500">*</span></label>
                      <input 
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.rated_power} 
                        onChange={(e) => {
                          setForm((f) => ({ ...f, rated_power: e.target.value }));
                          if (fieldErrors.rated_power) setFieldErrors({...fieldErrors, rated_power: undefined});
                        }} 
                        placeholder="7.5"
                        className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.rated_power 
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                            : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                        }`} 
                      />
                      {fieldErrors.rated_power && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.rated_power}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Voltage Rating</label>
                      <CustomSelect
                        value={form.voltage_rating}
                        onChange={(v) => {
                          setForm((f) => ({ ...f, voltage_rating: v }));
                          if (fieldErrors.voltage_rating) setFieldErrors({...fieldErrors, voltage_rating: undefined});
                        }}
                        error={!!fieldErrors.voltage_rating}
                        placeholder="Select voltage rating"
                        options={[
                          { value: "230V", label: "230V (Single Phase)" },
                          { value: "415V", label: "415V (Three Phase)" },
                          { value: "110V", label: "110V" },
                          { value: "480V", label: "480V" },
                          { value: "custom", label: "Custom" },
                        ]}
                      />
                      {fieldErrors.voltage_rating && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.voltage_rating}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Energy Meter ID</label>
                      <input 
                        value={form.energy_meter_id} 
                        onChange={(e) => {
                          setForm((f) => ({ ...f, energy_meter_id: e.target.value }));
                          if (fieldErrors.energy_meter_id) setFieldErrors({...fieldErrors, energy_meter_id: undefined});
                        }} 
                        placeholder="EM-001"
                        className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium font-mono focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.energy_meter_id 
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                            : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                        }`} 
                      />
                      <p className="text-xs text-muted-foreground mt-1">IoT sensor or meter identifier for energy monitoring</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Operating Hours / Day</label>
                      <input 
                        type="number"
                        step="0.5"
                        min="0"
                        max="24"
                        value={form.operating_hours} 
                        onChange={(e) => {
                          setForm((f) => ({ ...f, operating_hours: e.target.value }));
                          if (fieldErrors.operating_hours) setFieldErrors({...fieldErrors, operating_hours: undefined});
                        }} 
                        placeholder="8"
                        className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.operating_hours 
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                            : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                        }`} 
                      />
                      <p className="text-xs text-muted-foreground mt-1">Expected daily operating hours for consumption estimation</p>
                    </div>
                  </div>
                </div>
                
                {/* Additional Energy Monitoring Fields */}
                <div className="border-t border-border/50 pt-4">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Equipment Details & Configuration
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Manufacturer</label>
                      <input 
                        value={form.manufacturer} 
                        onChange={(e) => {
                          setForm((f) => ({ ...f, manufacturer: e.target.value }));
                          if (fieldErrors.manufacturer) setFieldErrors({...fieldErrors, manufacturer: undefined});
                        }} 
                        placeholder="Siemens"
                        className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.manufacturer 
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                            : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                        }`} 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Model Number</label>
                      <input 
                        value={form.model_number} 
                        onChange={(e) => {
                          setForm((f) => ({ ...f, model_number: e.target.value }));
                          if (fieldErrors.model_number) setFieldErrors({...fieldErrors, model_number: undefined});
                        }} 
                        placeholder="S7-1200"
                        className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.model_number 
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                            : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                        }`} 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Installation Date</label>
                      <input 
                        type="date"
                        value={form.installation_date} 
                        onChange={(e) => {
                          setForm((f) => ({ ...f, installation_date: e.target.value }));
                          if (fieldErrors.installation_date) setFieldErrors({...fieldErrors, installation_date: undefined});
                        }} 
                        className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.installation_date 
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                            : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                        }`} 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Maintenance Schedule</label>
                      <CustomSelect
                        value={form.maintenance_schedule}
                        onChange={(v) => {
                          setForm((f) => ({ ...f, maintenance_schedule: v }));
                          if (fieldErrors.maintenance_schedule) setFieldErrors({...fieldErrors, maintenance_schedule: undefined});
                        }}
                        error={!!fieldErrors.maintenance_schedule}
                        placeholder="Select schedule"
                        options={[
                          { value: "monthly", label: "Monthly" },
                          { value: "quarterly", label: "Quarterly" },
                          { value: "yearly", label: "Yearly" },
                          { value: "as-needed", label: "As Needed" },
                        ]}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Energy Configuration */}
                <div className="border-t border-border/50 pt-4">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Energy Configuration
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Phase</label>
                      <CustomSelect
                        value={form.phase}
                        onChange={(v) => {
                          setForm((f) => ({ ...f, phase: v }));
                          if (fieldErrors.phase) setFieldErrors({...fieldErrors, phase: undefined});
                        }}
                        error={!!fieldErrors.phase}
                        placeholder="Select phase"
                        options={[
                          { value: "single", label: "Single Phase" },
                          { value: "three", label: "Three Phase" },
                        ]}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Critical Equipment</label>
                      <CustomSelect
                        value={form.critical_equipment}
                        onChange={(v) => {
                          setForm((f) => ({ ...f, critical_equipment: v }));
                          if (fieldErrors.critical_equipment) setFieldErrors({...fieldErrors, critical_equipment: undefined});
                        }}
                        error={!!fieldErrors.critical_equipment}
                        placeholder="Select priority"
                        options={[
                          { value: "yes", label: "Yes - High Priority" },
                          { value: "no", label: "No - Normal Priority" },
                        ]}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Sub-Unit Level Monitoring</label>
                      <CustomSelect
                        value={form.sub_unit_monitoring}
                        onChange={(v) => {
                          setForm((f) => ({ ...f, sub_unit_monitoring: v }));
                          if (fieldErrors.sub_unit_monitoring) setFieldErrors({...fieldErrors, sub_unit_monitoring: undefined});
                        }}
                        error={!!fieldErrors.sub_unit_monitoring}
                        placeholder="Select option"
                        options={[
                          { value: "yes", label: "Yes - Monitor sub-components" },
                          { value: "no", label: "No - Equipment level only" },
                        ]}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Baseline Consumption (kWh/day)</label>
                      <input 
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.baseline_consumption} 
                        onChange={(e) => {
                          setForm((f) => ({ ...f, baseline_consumption: e.target.value }));
                          if (fieldErrors.baseline_consumption) setFieldErrors({...fieldErrors, baseline_consumption: undefined});
                        }} 
                        placeholder="60"
                        className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.baseline_consumption 
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                            : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                        }`} 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Energy Cost Rate (₹/kWh)</label>
                      <input 
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.energy_cost_rate} 
                        onChange={(e) => {
                          setForm((f) => ({ ...f, energy_cost_rate: e.target.value }));
                          if (fieldErrors.energy_cost_rate) setFieldErrors({...fieldErrors, energy_cost_rate: undefined});
                        }} 
                        placeholder="8.50"
                        className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.energy_cost_rate 
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                            : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                        }`} 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Efficiency Target (%)</label>
                      <input 
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={form.efficiency_target} 
                        onChange={(e) => {
                          setForm((f) => ({ ...f, efficiency_target: e.target.value }));
                          if (fieldErrors.efficiency_target) setFieldErrors({...fieldErrors, efficiency_target: undefined});
                        }} 
                        placeholder="85"
                        className={`w-full px-4 py-2.5 rounded-xl border bg-card/50 text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.efficiency_target 
                            ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                            : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                        }`} 
                      />
                    </div>
                  </div>
                </div>
                
                {/* Solar Integration */}
                <div className="border-t border-border/50 pt-4">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                    Solar Integration
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Solar Compatible</label>
                      <CustomSelect
                        value={form.solar_compatible}
                        onChange={(v) => {
                          setForm((f) => ({ ...f, solar_compatible: v }));
                          if (fieldErrors.solar_compatible) setFieldErrors({...fieldErrors, solar_compatible: undefined});
                        }}
                        error={!!fieldErrors.solar_compatible}
                        placeholder="Select option"
                        options={[
                          { value: "yes", label: "Yes - Can run on solar" },
                          { value: "no", label: "No - Grid only" },
                        ]}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1.5">Solar Priority</label>
                      <CustomSelect
                        value={form.solar_priority}
                        onChange={(v) => {
                          setForm((f) => ({ ...f, solar_priority: v }));
                          if (fieldErrors.solar_priority) setFieldErrors({...fieldErrors, solar_priority: undefined});
                        }}
                        error={!!fieldErrors.solar_priority}
                        placeholder="Select priority"
                        options={[
                          { value: "high", label: "High Priority" },
                          { value: "medium", label: "Medium Priority" },
                          { value: "low", label: "Low Priority" },
                        ]}
                      />
                    </div>
                  </div>
                </div>
                
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
                
                <div className="p-6 border-t border-border/50 bg-muted/20 flex gap-3 shrink-0 mt-auto">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-2.5">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : editing ? "Update Machine" : "Add Machine"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative glass-card p-6 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Confirm Deletion</h2>
              <p className="text-sm font-medium text-muted-foreground mb-8">{confirmMessage}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirmModal(false)} 
                  className="btn-secondary flex-1"
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
