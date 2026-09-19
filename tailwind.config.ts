import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f4f7f6",
        ink: "#18332f",
        rule: "#dce5e2",
        navy: "#123d35",
        critical: "#c43828",
        amberpin: "#e3a008",
        onit: "#2b5ea8",
        resolved: "#2f7d4a",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Palatino Linotype", "Palatino", "serif"],
        sans: ["var(--font-sans)", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 32px -12px rgba(18, 61, 53, 0.13)",
      },
    },
  },
  plugins: [],
};

export default config;
