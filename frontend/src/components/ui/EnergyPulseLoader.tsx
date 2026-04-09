"use client";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";

interface EnergyPulseLoaderProps {
  text?: string;
  fullScreen?: boolean;
}

export default function EnergyPulseLoader({ text = "Loading data...", fullScreen = false }: EnergyPulseLoaderProps) {
  const containerClasses = fullScreen 
    ? "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center" 
    : "w-full py-12 flex flex-col items-center justify-center min-h-[300px]";

  return (
    <div className={containerClasses}>
      <div className="relative flex items-center justify-center w-24 h-24 mb-6">
        {/* Outer glowing ring */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 rounded-full bg-brand-500/20 blur-xl"
        />
        
        {/* Inner rotating dash ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute inset-2 rounded-full border-2 border-dashed border-brand-500/40"
        />
        
        {/* Core pulsing circle */}
        <motion.div
          animate={{
            scale: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-[0_0_20px_rgba(var(--brand-500),0.4)]"
        >
          <Zap className="w-6 h-6 text-white" />
        </motion.div>
        
        {/* Floating particles */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -20, 0],
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.6,
              ease: "easeInOut",
            }}
            className="absolute w-2 h-2 rounded-full bg-brand-400"
            style={{
              left: `${30 + Math.random() * 40}%`,
              top: `${20 + Math.random() * 20}%`,
            }}
          />
        ))}
      </div>
      
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className="flex flex-col items-center"
      >
        <h3 className="text-lg font-bold text-foreground bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-brand-400">
          {text}
        </h3>
        <p className="text-sm font-medium text-muted-foreground mt-1">
          Please wait...
        </p>
      </motion.div>
    </div>
  );
}
