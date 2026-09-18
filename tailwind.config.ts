import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f3eadc",
        ink: "#1a1714",
        rule: "#d7cbb6",
        navy: "#1e2a3a",
        critical: "#c43828",
        amberpin: "#e3a008",
        onit: "#2b5ea8",
        resolved: "#2f7d4a",
      },
      fontFamily: {
        serif: ["Fraunces", "Palatino Linotype", "Palatino", "serif"],
        sans: ["Source Sans 3", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 12px 40px rgba(30, 42, 58, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
