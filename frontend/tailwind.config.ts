import type { Config } from "tailwindcss";

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
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6", // Changing brand to a modern teal/cyan for a fresh corporate look
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        glass: "0 4px 30px rgba(0, 0, 0, 0.03)",
        "glass-hover": "0 10px 40px rgba(0, 0, 0, 0.08), 0 4px 15px rgba(0,0,0,0.03)",
        "glass-lg": "0 15px 50px rgba(0, 0, 0, 0.08)",
        "soft": "0 2px 10px rgba(0,0,0,0.02)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in-up": "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-in-right": "slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(15px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(15px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)',
        'glass-gradient-dark': 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.6) 100%)',
      }
    },
  },
  plugins: [],
};

export default config;
