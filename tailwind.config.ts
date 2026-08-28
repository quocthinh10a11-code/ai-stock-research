import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d1c2d",
        navy: "#0f172a",
        slate: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a" },
        bull: "#16a34a",
        bear: "#dc2626",
        warning: "#d97706",
        surface: "#ffffff",
        canvas: "#f8fafc"
      },
      borderRadius: { sm: "0.125rem", DEFAULT: "0.25rem", md: "0.375rem", lg: "0.5rem", xl: "0.75rem" },
      fontFamily: { sans: ["var(--font-inter)", "sans-serif"], display: ["var(--font-inter)", "sans-serif"], mono: ["var(--font-jetbrains)", "monospace"] },
      fontSize: { xs: ["12px", "16px"], sm: ["14px", "20px"], data: ["13px", "16px"], title: ["20px", "28px"], display: ["30px", "38px"] },
      spacing: { 18: "4.5rem" }
    }
  },
  plugins: []
} satisfies Config;
