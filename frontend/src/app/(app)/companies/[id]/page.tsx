"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, Users, Cpu, MapPin, Edit, Trash2, Plus, AlertCircle, Loader2, Phone, Mail, Calendar, Settings, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Company, Branch, Machine, CompanyUser } from "@/types";

const COMPANY_STATUS_CLASSES = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  inactive: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  suspended: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const BRANCH_STATUS_CLASSES = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  inactive: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  maintenance: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { permissions } = useAuth();
  const canWrite = permissions["companies.write"];
  const companyId = params.id as string;
  
  const [company, setCompany] = useState<Company | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadCompany() {
    setLoading(true);
    try {
      const [companyData, branchesData, machinesData, usersData] = await Promise.all([
        api.get<Company>(`/api/v1/companies/${companyId}`),
        api.get<Branch[]>(`/api/v1/branches?company_id=${companyId}`),
        api.get<Machine[]>(`/api/v1/machines?company_id=${companyId}`),
        api.get<CompanyUser[]>(`/api/v1/users?company_id=${companyId}`)
      ]);
      
      setCompany(companyData);
      setBranches(branchesData);
      setMachines(machinesData);
      setUsers(usersData);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load company details");
      router.push("/companies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (companyId) {
      loadCompany();
    }
  }, [companyId]);

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await api.delete(`/api/v1/companies/${companyId}`);
      toast.success("Company deleted successfully");
      router.push("/companies");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete company");
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading company details...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Company not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/companies")}
            className="w-10 h-10 rounded-xl border border-border/60 bg-card/50 hover:bg-background transition-all flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{company.name}</h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">Energy Monitoring</p>
          </div>
        </div>
        
        {canWrite && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/companies/${companyId}/edit`)}
              className="w-10 h-10 rounded-xl border border-border/60 bg-card/50 hover:bg-background transition-all flex items-center justify-center"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-10 h-10 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all flex items-center justify-center text-red-600 dark:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Company Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
              <Building2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Company Information</h2>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company Slug</p>
              <p className="text-sm font-bold text-foreground font-mono">{company.slug}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</p>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${COMPANY_STATUS_CLASSES[company.status]}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  company.status === 'active' ? 'bg-emerald-500' :
                  company.status === 'suspended' ? 'bg-red-500' : 'bg-slate-500'
                }`}></span>
                {company.status.toUpperCase()}
              </span>
            </div>
            
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</p>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-bold text-foreground">
                  {new Date(company.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Statistics</h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Branches</span>
              <span className="text-lg font-bold text-foreground">{branches.length}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Equipment</span>
              <span className="text-lg font-bold text-foreground">{machines.length}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Users</span>
              <span className="text-lg font-bold text-foreground">{users.length}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Active Rate</span>
              <span className="text-lg font-bold text-foreground">
                {machines.length > 0 
                  ? Math.round((machines.filter(m => m.status === 'active').length / machines.length) * 100)
                  : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
              <Plus className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Quick Actions</h2>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={() => router.push(`/branches/new?company_id=${companyId}`)}
              className="w-full px-4 py-2 rounded-lg border border-border/60 bg-card/50 text-sm font-medium hover:bg-background transition-all flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              Create Branch
            </button>
            
            <button
              onClick={() => router.push(`/machines/new?company_id=${companyId}`)}
              className="w-full px-4 py-2 rounded-lg border border-border/60 bg-card/50 text-sm font-medium hover:bg-background transition-all flex items-center justify-center gap-2"
            >
              <Cpu className="w-4 h-4" />
              Add Equipment
            </button>
            
            <button
              onClick={() => router.push(`/users/new?company_id=${companyId}`)}
              className="w-full px-4 py-2 rounded-lg border border-border/60 bg-card/50 text-sm font-medium hover:bg-background transition-all flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4" />
              Add User
            </button>
          </div>
        </div>
      </div>

      {/* Branches Section */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-foreground">Branches</h3>
          <button
            onClick={() => router.push(`/branches/new?company_id=${companyId}`)}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Branch
          </button>
        </div>
        
        {branches.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No branches yet</p>
            <button
              onClick={() => router.push(`/branches/new?company_id=${companyId}`)}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-all"
            >
              Create First Branch
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Branch</th>
                  <th className="text-left py-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Code</th>
                  <th className="text-left py-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Location</th>
                  <th className="text-left py-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Equipment</th>
                  <th className="text-left py-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right py-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => router.push(`/branches/${branch.id}`)}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center border border-brand-100 dark:border-brand-500/20">
                          <MapPin className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        </div>
                        <button
                          onClick={() => router.push(`/branches/${branch.id}`)}
                          className="text-sm font-bold text-foreground hover:text-brand-600 transition-colors"
                        >
                          {branch.name}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-medium bg-muted text-muted-foreground border border-border/50">
                        {branch.code}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        <div className="font-medium text-foreground">{branch.city}, {branch.state}</div>
                        <div className="text-muted-foreground">{branch.address}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-muted-foreground">
                        {machines.filter(m => m.branch_id === branch.id).length} equipment
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${BRANCH_STATUS_CLASSES[branch.status]}`}>
                        {branch.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => router.push(`/branches/${branch.id}`)} className="w-8 h-8 rounded-lg hover:bg-background border border-transparent hover:border-border shadow-sm flex items-center justify-center transition-all text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400" title="View details">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative glass-card p-6 w-full max-w-md"
          >
            <h3 className="text-lg font-bold text-foreground mb-2">Delete Company</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete "{company.name}"? This will also delete all branches, equipment, and users associated with this company. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg border border-border/60 bg-card/50 text-sm font-medium hover:bg-background transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all disabled:opacity-50"
              >
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
