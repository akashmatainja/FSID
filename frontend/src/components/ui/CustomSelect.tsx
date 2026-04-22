"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, X } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  allowClear?: boolean;
  onClear?: () => void;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className = "",
  error = false,
  disabled = false,
  iconLeft,
  allowClear = false,
  onClear,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) onClear();
    else onChange("");
  };

  return (
    <div ref={ref} className={`relative ${className}`} style={{ zIndex: open ? 100 : "auto" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 py-2.5 ${iconLeft ? "pl-11" : "pl-4"} pr-10 rounded-xl border-2 text-sm font-bold shadow-sm transition-all cursor-pointer text-left
          ${error
            ? "border-red-500/50 focus:ring-red-500/30 bg-red-500/5"
            : open
              ? "border-brand-500/60 ring-2 ring-brand-500/20"
              : "border-border hover:border-brand-500/30 hover:shadow-md"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        style={{ backgroundColor: "rgb(var(--card) / 0.8)", color: "rgb(var(--foreground))" }}
      >
        {iconLeft && (
          <span className="absolute left-4 -translate-y-1/2 pointer-events-none text-muted-foreground z-10" style={{ top: "50%" }}>
            {iconLeft}
          </span>
        )}
        <span className={`flex-1 truncate ${selected && selected.value !== "" ? "text-foreground" : "text-muted-foreground"}`}>
          {selected && selected.value !== "" ? selected.label : placeholder}
        </span>
        
        <div className="absolute right-3 -translate-y-1/2 flex items-center gap-1" style={{ top: "50%" }}>
          {allowClear && selected && selected.value !== "" && !disabled && (
            <div 
              onClick={handleClear}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </div>
          )}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-muted-foreground"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-[1000] w-full mt-1.5 rounded-xl border border-border shadow-lg shadow-black/10 overflow-hidden"
            style={{ backgroundColor: "rgb(var(--card))" }}
          >
            <div className="p-1.5 max-h-60 overflow-y-auto custom-scrollbar">
              {options.map((option, idx) => {
                const isSelected = option.value === value;
                return (
                  <motion.button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.15 }}
                    onClick={() => {
                      if (!option.disabled) {
                        onChange(option.value);
                        setOpen(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left transition-all
                      ${isSelected
                        ? "bg-brand-500 text-white font-bold"
                        : option.disabled
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400"
                      }
                    `}
                    style={{ color: isSelected ? "white" : undefined }}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
