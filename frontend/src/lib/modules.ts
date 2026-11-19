import { Zap, Wind, Brain } from "lucide-react";

/**
 * The monitoring modules that get their own page and sidebar entry.
 * A module record from the API is matched to one of these by its `code`.
 */
export type ModuleSlug = "energy" | "environmental" | "predictive";

export interface ModuleDef {
  slug: ModuleSlug;
  href: string;
  title: string;          // page heading, e.g. "Energy Monitoring"
  navLabel: string;       // sidebar label
  icon: React.ElementType;
  matches: (code: string) => boolean;
  /** Metric codes to lead the chart with, in order of preference. */
  primaryPrefer: RegExp[];
  /** Short line for the dashboard card. */
  blurb: string;
}

export const MODULE_DEFS: ModuleDef[] = [
  {
    slug: "energy",
    href: "/energy",
    title: "Energy Monitoring",
    navLabel: "Energy",
    icon: Zap,
    matches: (c) => /energy/i.test(c),
    primaryPrefer: [/^power$|active_power/i, /power/i, /energy|kwh/i],
    blurb: "Power draw and consumption",
  },
  {
    slug: "environmental",
    href: "/environmental",
    title: "Environmental Monitoring",
    navLabel: "Environmental",
    icon: Wind,
    matches: (c) => /environment/i.test(c),
    primaryPrefer: [/temp/i, /co2|co₂/i, /humid/i],
    blurb: "Air quality and conditions",
  },
  {
    slug: "predictive",
    href: "/predictive",
    title: "Predictive Maintenance",
    navLabel: "Predictive",
    icon: Brain,
    matches: (c) => /predict/i.test(c),
    primaryPrefer: [/vib/i, /temp/i],
    blurb: "Vibration and asset condition",
  },
];

export function moduleDefForCode(code: string): ModuleDef | undefined {
  return MODULE_DEFS.find((d) => d.matches(code));
}

export function moduleDef(slug: ModuleSlug): ModuleDef {
  return MODULE_DEFS.find((d) => d.slug === slug)!;
}
