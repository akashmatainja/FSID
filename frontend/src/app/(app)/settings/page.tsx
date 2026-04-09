"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Eye, EyeOff, CheckCircle, Shield, Lock, User, Mail, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import EnergyPulseLoader from "@/components/ui/EnergyPulseLoader";

export default function SettingsPage() {
  const { companyUser } = useAuth();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<{currentPassword?: string; newPassword?: string; confirmPassword?: string}>({});

  // Calculate password strength
  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  const getPasswordStrengthColor = (strength: number) => {
    if (strength === 0) return "bg-red-500";
    if (strength === 1) return "bg-amber-500";
    if (strength === 2) return "bg-yellow-500";
    if (strength === 3) return "bg-brand-500";
    return "bg-emerald-500";
  };

  const getPasswordStrengthText = (strength: number) => {
    if (strength === 0) return "Very Weak";
    if (strength === 1) return "Weak";
    if (strength === 2) return "Fair";
    if (strength === 3) return "Good";
    return "Strong";
  };

  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setFormData({ ...formData, newPassword });
    setPasswordStrength(calculatePasswordStrength(newPassword));
    if (fieldErrors.newPassword) setFieldErrors({...fieldErrors, newPassword: undefined});
  };

  function validate() {
    const errors: {currentPassword?: string; newPassword?: string; confirmPassword?: string} = {};
    if (!formData.currentPassword) errors.currentPassword = "Current password is required";
    if (!formData.newPassword) {
      errors.newPassword = "New password is required";
    } else if (formData.newPassword.length < 6) {
      errors.newPassword = "New password must be at least 6 characters";
    }
    
    if (!formData.confirmPassword) {
      errors.confirmPassword = "Confirm password is required";
    } else if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }
    
    if (formData.currentPassword && formData.newPassword && formData.currentPassword === formData.newPassword) {
      errors.newPassword = "New password must be different from current";
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset status
    setSubmitStatus('idle');
    setSubmitMessage('');
    
    if (!validate()) return;

    setLoading(true);
    try {
      await api.post("/api/v1/auth/change-password", {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      
      setSubmitStatus('success');
      setSubmitMessage('Password changed successfully!');
      toast.success("Password changed successfully!");
      setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordStrength(0);
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setSubmitStatus('idle');
        setSubmitMessage('');
      }, 3000);
    } catch (error: any) {
      setSubmitStatus('error');
      setSubmitMessage(error.message || 'Failed to change password');
      toast.error(error.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Manage your account details and security preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          {/* Change Password Section */}
          <div className="glass-card p-6 sm:p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center border border-brand-100 dark:border-brand-500/20 shadow-sm">
                <Shield className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Security Settings</h2>
                <p className="text-sm font-medium text-muted-foreground">Update your account password</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Status Message */}
              <AnimatePresence mode="popLayout">
                {submitStatus !== 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                      submitStatus === 'success' 
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                        : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
                    }`}
                  >
                    {submitStatus === 'success' ? (
                      <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    ) : (
                      <Shield className="w-5 h-5 shrink-0 mt-0.5" />
                    )}
                    <span className="font-bold text-sm">{submitMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    Current Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group">
                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${fieldErrors.currentPassword ? 'text-red-500' : 'text-muted-foreground group-focus-within:text-brand-500'} transition-colors`} />
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={formData.currentPassword}
                      onChange={(e) => {
                        setFormData({ ...formData, currentPassword: e.target.value });
                        if (fieldErrors.currentPassword) setFieldErrors({...fieldErrors, currentPassword: undefined});
                      }}
                      className={`w-full pl-11 pr-12 py-2.5 rounded-xl border bg-card/50 backdrop-blur-sm text-sm font-medium focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50 shadow-sm ${
                        fieldErrors.currentPassword 
                          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                          : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                      }`}
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      tabIndex={-1}
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.currentPassword && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.currentPassword}</p>}
                </div>

                <div className="w-full h-px bg-border/50 my-2"></div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group">
                    <Key className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${fieldErrors.newPassword ? 'text-red-500' : 'text-muted-foreground group-focus-within:text-brand-500'} transition-colors`} />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={formData.newPassword}
                      onChange={handleNewPasswordChange}
                      className={`w-full pl-11 pr-12 py-2.5 rounded-xl border bg-card/50 backdrop-blur-sm text-sm font-medium focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50 shadow-sm ${
                        fieldErrors.newPassword 
                          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                          : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                      }`}
                      placeholder="Enter new password (min. 6 characters)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.newPassword && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.newPassword}</p>}
                  
                  {/* Password Strength Indicator */}
                  {formData.newPassword && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 bg-muted/30 p-3 rounded-xl border border-border/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Password Strength</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          passwordStrength <= 1 ? 'text-red-500' :
                          passwordStrength === 2 ? 'text-amber-500' :
                          passwordStrength === 3 ? 'text-brand-500' : 'text-emerald-500'
                        }`}>
                          {getPasswordStrengthText(passwordStrength)}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((level) => (
                          <motion.div
                            key={level}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: level * 0.1, duration: 0.3 }}
                            className={`h-1.5 flex-1 rounded-full origin-left ${
                              level <= passwordStrength ? getPasswordStrengthColor(passwordStrength) : "bg-border"
                            }`}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group">
                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${fieldErrors.confirmPassword ? 'text-red-500' : 'text-muted-foreground group-focus-within:text-brand-500'} transition-colors`} />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => {
                        setFormData({ ...formData, confirmPassword: e.target.value });
                        if (fieldErrors.confirmPassword) setFieldErrors({...fieldErrors, confirmPassword: undefined});
                      }}
                      className={`w-full pl-11 pr-12 py-2.5 rounded-xl border bg-card/50 backdrop-blur-sm text-sm font-medium focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50 shadow-sm ${
                        fieldErrors.confirmPassword 
                          ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                          : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500/50'
                      }`}
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {fieldErrors.confirmPassword}</p>}
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                    setPasswordStrength(0);
                    setSubmitStatus('idle');
                    setSubmitMessage('');
                    setFieldErrors({});
                  }}
                  disabled={loading}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || submitStatus === 'success'}
                  className="btn-primary flex-1"
                >
                  {loading ? (
                    <>Changing...</>
                  ) : submitStatus === 'success' ? (
                    <><CheckCircle className="w-4 h-4" /> Success!</>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          {/* User Info Card */}
          <div className="glass-card p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-md shadow-brand-500/20">
                <span className="text-xl font-bold text-white">
                  {companyUser?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">My Profile</h3>
                <p className="text-sm font-medium text-muted-foreground">Account details</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
                <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Full Name</p>
                  <p className="text-sm font-bold text-foreground truncate">{companyUser?.name || "—"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
                <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email Address</p>
                  <p className="text-sm font-bold text-foreground truncate">{companyUser?.email || "—"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-emerald-700/70 dark:text-emerald-400/70 uppercase tracking-wider">Account Status</p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 capitalize">{companyUser?.status || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Tips */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Security Best Practices</h3>
            </div>

            <ul className="space-y-3">
              {[
                "Use a mix of letters, numbers, and symbols",
                "Make passwords at least 8 characters long",
                "Avoid using personal information",
                "Do not reuse passwords across services"
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
                  <span className="font-medium text-muted-foreground leading-tight">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
