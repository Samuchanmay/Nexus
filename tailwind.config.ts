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
      borderRadius: { lg: "22px", m: "16px", sm: "11px" },
      boxShadow: {
        nx: "var(--nx-shadow)",
        "1": "var(--shadow-1)",
        "2": "var(--shadow-2)",
        "3": "var(--shadow-3)",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(.22,.61,.36,1)",
        spring: "cubic-bezier(.34,1.4,.64,1)",
      },
      // Escala tipográfica canónica (design/design/TYPOGRAPHY.md): cada
      // utilidad resuelve al token --fs-* de globals.css. Sobrescribe los
      // defaults de Tailwind (xs/sm/lg/xl/2xl/3xl) — seguro porque la app
      // solo usa valores arbitrarios; el retrofit W2/W3 los unificó a estos
      // números. No inventar tamaños nuevos fuera de esta escala.
      fontSize: {
        "2xs": "var(--fs-2xs)", xs: "var(--fs-xs)", sm: "var(--fs-sm)",
        tag: "var(--fs-tag)", base: "var(--fs-base)", md: "var(--fs-md)",
        lg: "var(--fs-lg)", xl: "var(--fs-xl)", title: "var(--fs-title)",
        "2xl": "var(--fs-2xl)", "3xl": "var(--fs-3xl)", display: "var(--fs-display)",
        hero: "var(--fs-hero)",
      },
    },
  },
  plugins: [],
} satisfies Config;
