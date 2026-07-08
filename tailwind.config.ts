import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", surface: "var(--surface)", "surface-2": "var(--surface-2)", "surface-3": "var(--surface-3)",
        "text-1": "var(--text-1)", "text-2": "var(--text-2)", "text-3": "var(--text-3)",
        accent: "var(--accent)", ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)",
        // Nexus OS — tokens de chrome del shell
        panel: "var(--panel)", card: "var(--card)", sidebar: "var(--sidebar)",
        input: "var(--input)", hover: "var(--hover)", border: "var(--border)",
        purple: "var(--purple)", blue: "var(--blue)",
      },
      borderRadius: { l: "22px", m: "16px", s: "11px" },
      boxShadow: { nx: "var(--nx-shadow)" },
      transitionTimingFunction: {
        apple: "cubic-bezier(.22,.61,.36,1)",
        spring: "cubic-bezier(.34,1.4,.64,1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
