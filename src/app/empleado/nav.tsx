"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, ThemeToggle } from "@/components/ui";
import { IconCheck, IconHome, IconClock, IconPalm, IconAlert, IconMapPin } from "@/components/icons";

const TABS = [
  { href: "/empleado", label: "Mi día", icon: IconHome },
  { href: "/empleado/jornada", label: "Jornada", icon: IconClock },
  { href: "/fichar", label: "Fichar", icon: IconMapPin },
  { href: "/empleado/vacaciones", label: "Vacaciones", icon: IconPalm },
  { href: "/empleado/incidencias", label: "Incidencias", icon: IconAlert },
];

export default function EmpleadoNav({ profile }: {
  profile: { display_name: string; nexus_color: string | null; role: string };
}) {
  const path = usePathname();
  return (
    <>
      <nav className="glass-bar sticky top-0 z-[200] h-14 flex items-center justify-between px-5"
        style={{ borderBottom: "0.5px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-white"
            style={{ background: "linear-gradient(150deg,#30D158,#1FAF52)", boxShadow: "0 2px 6px rgba(31,175,82,.3)" }}>
            <IconCheck className="w-[15px] h-[15px]" />
          </div>
          <div className="leading-[1.05]">
            <p className="text-[14.5px] font-semibold tracking-tight">Nexus</p>
            <p className="text-[11.5px] font-medium" style={{ color: "var(--text-2)" }}>Mi Día</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href}
              className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors"
              style={path === t.href
                ? { background: "var(--ok-tint)", color: "var(--ok)" }
                : { color: "var(--text-2)" }}>
              {t.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {profile.role === "admin" && (
            <Link href="/admin" className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
              Admin →
            </Link>
          )}
          <ThemeToggle />
          <Avatar name={profile.display_name} color={profile.nexus_color} />
        </div>
      </nav>
      {/* Bottom nav móvil */}
      <nav className="glass-bar md:hidden fixed bottom-0 inset-x-0 z-[150] flex items-center justify-around px-2 pt-2"
        style={{ borderTop: "0.5px solid var(--border)", paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = path === t.href;
          return (
            <Link key={t.href} href={t.href} className="flex flex-col items-center gap-0.5 px-3 py-1"
              style={{ color: active ? "var(--ok)" : "var(--text-3)" }}>
              <Icon className="w-[21px] h-[21px]" />
              <span className="text-[10px] font-semibold">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
