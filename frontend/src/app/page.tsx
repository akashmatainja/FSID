'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Activity } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // User is authenticated, redirect to dashboard
        router.push('/dashboard');
      } else {
        // User is not authenticated, redirect to login
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-500/10 blur-[120px] mix-blend-multiply opacity-50 animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px] mix-blend-multiply opacity-50 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="text-center relative z-10 animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/25 mx-auto mb-6 ring-1 ring-brand-400/20 animate-pulse-slow">
          <Activity className="w-8 h-8 text-white drop-shadow-md" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">Machine<span className="text-brand-500">IQ</span></h1>
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
          <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></span>
          Initializing System...
        </p>
      </div>
    </div>
  );
}
