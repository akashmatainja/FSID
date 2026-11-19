import type { Config } from "tailwindcss";

// Theme tokens live in src/app/globals.css as space-separated RGB values.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-roboto)", "Roboto", "system-ui", "sans-serif"],
      },
      // Typography floor: nothing renders below 14px, and every weight below
      // bold renders bold (extrabold/black stay heavier for hierarchy).
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.25rem" }],
      },
      fontWeight: {
        thin: "700",
        extralight: "700",
        light: "700",
        normal: "700",
        medium: "700",
        semibold: "700",
      },
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        border: token("border"),
        input: token("input"),
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: token("accent"),
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        destructive: token("destructive"),
        sidebar: {
          DEFAULT: token("sidebar"),
          deep: token("sidebar-deep"),
          foreground: token("sidebar-foreground"),
          muted: token("sidebar-muted"),
        },
        // Teal accent, matched to the industrial navy theme
        brand: {
          50: "#ecfaf8",
          100: "#cff3ee",
          200: "#a1e6dd",
          300: "#67d3c6",
          400: "#33bcad",
          500: "#17a397",
          600: "#11867c",
          700: "#126b64",
          800: "#135651",
          900: "#134844",
        },
        navy: {
          50: "#f2f6fa",
          100: "#e1e9f2",
          200: "#c5d4e5",
          300: "#9cb5d0",
          400: "#6c8fb6",
          500: "#4b719c",
          600: "#2f6ca3",
          700: "#285580",
          800: "#1e3a5c",
          900: "#152a44",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        glass: "0 1px 2px rgba(15, 35, 60, 0.04)",
        "glass-hover": "0 8px 24px -8px rgba(15, 35, 60, 0.12), 0 2px 4px rgba(15, 35, 60, 0.04)",
        "glass-lg": "0 20px 50px -12px rgba(15, 35, 60, 0.25)",
        soft: "0 1px 2px rgba(15, 35, 60, 0.04)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in-up": "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fadeIn 0.4s ease-out both",
        "slide-in-right": "slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "live-ring": "liveRing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        liveRing: {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};

export default config;
