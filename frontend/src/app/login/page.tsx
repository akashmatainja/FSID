"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{email?: string; password?: string}>({});

  function validate() {
    const errors: {email?: string; password?: string} = {};
    if (!email.trim()) errors.email = "Email is required";
    if (!password.trim()) errors.password = "Password is required";
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setLoginError(""); // Clear previous error
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      setLoading(false);
      
      if (error) {
        // Handle different error types with user-friendly messages
        let errorMessage = "Login failed. Please try again.";
        
        if (error.message.includes("Invalid login credentials")) {
          errorMessage = "Invalid email or password. Please check your credentials and try again.";
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage = "Please confirm your email address before logging in.";
        } else if (error.message.includes("Too many requests")) {
          errorMessage = "Too many login attempts. Please try again later.";
        } else if (error.message.includes("Invalid email")) {
          errorMessage = "Please enter a valid email address.";
        } else {
          errorMessage = error.message || "Login failed. Please try again.";
        }
        
        setLoginError(errorMessage);
        toast.error(errorMessage);
      } else {
        // Check session immediately after login
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData.session) {
          toast.success("Login successful!");
          router.replace("/dashboard");
        } else {
          const errorMsg = "Login failed. Please try again.";
          setLoginError(errorMsg);
          toast.error(errorMsg);
        }
      }
    } catch (err) {
      setLoading(false);
      const errorMsg = "An unexpected error occurred. Please try again.";
      setLoginError(errorMsg);
      toast.error(errorMsg);
      console.error("Login error:", err);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-brand-500/30">
      {/* Background decoration */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-500/10 blur-[120px] mix-blend-multiply opacity-50 animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px] mix-blend-multiply opacity-50 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px] relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/25 mb-5 ring-1 ring-brand-400/20">
            <Activity className="w-7 h-7 text-white drop-shadow-md" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Machine<span className="text-brand-500">IQ</span></h1>
          <p className="text-sm font-medium text-muted-foreground mt-2 uppercase tracking-widest">Enterprise Platform</p>
        </div>

        <div className="glass-card p-8 sm:p-10 shadow-glass-lg relative overflow-hidden">
          {/* Subtle gradient line top */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-500/50 to-transparent"></div>
          
          <h2 className="text-xl font-bold text-foreground mb-1.5">Welcome back</h2>
          <p className="text-sm font-medium text-muted-foreground mb-8">Sign in to your account to continue</p>

          {/* Error Message */}
          <AnimatePresence mode="popLayout">
            {loginError && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium flex items-start gap-3"
              >
                <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {loginError}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-foreground">Email address <span className="text-red-500">*</span></label>
              <div className="relative group">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${fieldErrors.email ? 'text-red-500' : 'text-muted-foreground group-focus-within:text-brand-500'}`} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({...fieldErrors, email: undefined});
                    setLoginError("");
                  }}
                  placeholder="name@company.com"
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-card text-sm font-medium
                             focus:outline-none focus:ring-2 transition-all shadow-sm ${
                               fieldErrors.email 
                               ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                               : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500'
                             } placeholder:text-muted-foreground/50`}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs font-medium text-red-500 mt-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-foreground">Password <span className="text-red-500">*</span></label>
                <a href="#" className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors">Forgot password?</a>
              </div>
              <div className="relative group">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${fieldErrors.password ? 'text-red-500' : 'text-muted-foreground group-focus-within:text-brand-500'}`} />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors({...fieldErrors, password: undefined});
                    setLoginError("");
                  }}
                  placeholder="••••••••"
                  className={`w-full pl-11 pr-12 py-3 rounded-xl border bg-card text-sm font-medium
                             focus:outline-none focus:ring-2 transition-all shadow-sm font-mono tracking-wider ${
                               fieldErrors.password 
                               ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
                               : 'border-border/60 focus:ring-brand-500/30 focus:border-brand-500'
                             } placeholder:text-muted-foreground/50`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs font-medium text-red-500 mt-1">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-4 text-[15px]"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Authenticating...</>
              ) : (
                "Sign in to Dashboard"
              )}
            </button>
          </form>
        </div>
        
        {/* Sample Credentials */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="glass-card p-6 mt-6 border border-border/30"
        >
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            Sample Credentials
          </h3>
          
          <div className="space-y-3">
            {/* Superadmin */}
            <div className="p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Superadmin</span>
                <span className="text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 font-medium">Full Access</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-mono text-muted-foreground">Email: superadmin@platform.com</p>
                <p className="text-xs font-mono text-muted-foreground">Password: Super1234!</p>
              </div>
            </div>

            {/* Company Admin */}
            <div className="p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Company Admin</span>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-medium">Company Access</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-mono text-muted-foreground">Email: utpal@gmail.com</p>
                <p className="text-xs font-mono text-muted-foreground">Password: 123456</p>
              </div>
            </div>

            {/* Regular User */}
            <div className="p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Regular User</span>
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 font-medium">Limited Access</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-mono text-muted-foreground">Email: saroj@gmail.com</p>
                <p className="text-xs font-mono text-muted-foreground">Password: 123456</p>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Use these credentials to explore different user roles and permissions
          </p>
        </motion.div>
        
        {/* Footer info */}
        <p className="text-center text-xs font-medium text-muted-foreground mt-6">
          Protected by enterprise-grade security. <br/>By signing in, you agree to our Terms of Service.
        </p>
      </motion.div>
    </div>
  );
}
