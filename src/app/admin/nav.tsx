"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, ThemeToggle } from "@/components/ui";
import CommandPalette, { type Command } from "@/components/command-palette";
import {
  IconGrid, IconApprove, IconFolder, IconClock, IconPalm, IconAlert,
  IconUsers, IconUserPlus, IconCalendar, IconHome,
} from "@/components/icons";

const NAV = [
  { href: "/admin", label: "Panel", icon: IconGrid },
  { href: "/admin/solicitudes", label: "Solicitudes", icon: IconApprove },
  { href: "/admin/proyectos", label: "Proyectos", icon: IconFolder },
  { href: "/admin/nexus", label: "Asistencia", icon: IconClock },
  { href: "/admin/calendario", label: "Calendario", icon: IconCalendar },
  { href: "/admin/vacaciones", label: "Vacaciones", icon: IconPalm },
  { href: "/admin/incidencias", label: "Incidencias", icon: IconAlert },
  { href: "/admin/equipo", label: "Carga del equipo", icon: IconUsers },
  { href: "/admin/empleados", label: "Empleados", icon: IconUserPlus },
  { href: "/admin/dias-inhabiles", label: "Días inhábiles", icon: IconCalendar },
];

/* L7 · comandos del palette ⌘K */
const COMMANDS: Command[] = [
  ...NAV.map((n) => ({
    id: `nav-${n.href}`, label: n.label, hint: "Ir", group: "Navegación", href: n.href,
    keywords: n.href,
  })),
  { id: "act-fichar", label: "Fichar ahora", hint: "Registro", group: "Acciones", href: "/fichar", keywords: "checar entrada salida reloj" },
  { id: "act-nueva-solicitud", label: "Revisar solicitudes por aprobar", group: "Acciones", href: "/admin/solicitudes", keywords: "aprobar pendientes" },
  { id: "act-calendario", label: "Ver calendario del mes", group: "Acciones", href: "/admin/calendario", keywords: "heatmap asistencia vacaciones" },
];

export default function AdminNav({ profile }: { profile: { display_name: string; nexus_color: string | null } }) {
  const path = usePathname();
  return (
    <>
      {/* Sidebar escritorio */}
      <aside className="glass-bar hidden md:flex fixed left-0 top-0 bottom-0 z-[200] w-[228px] flex-col px-3.5 py-5"
        style={{ borderRight: "0.5px solid var(--border)" }}>
        <div className="flex items-center gap-2.5 px-2 mb-7">
          <div className="w-[32px] h-[32px] rounded-[10px] flex items-center justify-center text-white"
            style={{ background: "linear-gradient(150deg,#7B7AFF,#5856D6)", boxShadow: "0 3px 8px rgba(88,86,214,.35)" }}>
            <IconGrid className="w-4 h-4" />
          </div>
          <div className="leading-[1.05]">
            <p className="text-[15px] font-bold tracking-tight">Nexus</p>
            <p className="text-[11px] font-medium" style={{ color: "var(--text-2)" }}>Administrador</p>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 flex-1">
          <CommandPalette commands={COMMANDS} />
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = path === n.href;
            return (
              <Link key={n.href} href={n.href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-s text-[13.5px] font-semibold transition-colors"
                style={active
                  ? { background: "var(--accent-tint)", color: "var(--accent)" }
                  : { color: "var(--text-2)" }}>
                <Icon className="w-[17px] h-[17px]" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/empleado"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-s text-[13px] font-semibold mb-2"
          style={{ background: "var(--ok-tint)", color: "var(--ok)" }}>
          <IconHome className="w-4 h-4" /> Mi Día (empleado)
        </Link>
        <div className="flex items-center justify-between px-2">
          <Avatar name={profile.display_name} color={profile.nexus_color} size={30} />
          <ThemeToggle />
        </div>
      </aside>

      {/* Topbar móvil */}
      <nav className="glass-bar md:hidden sticky top-0 z-[200] h-14 flex items-center justify-between px-4"
        style={{ borderBottom: "0.5px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-[28px] h-[28px] rounded-[9px] flex items-center justify-center text-white"
            style={{ background: "linear-gradient(150deg,#7B7AFF,#5856D6)" }}>
            <IconGrid className="w-3.5 h-3.5" />
          </div>
          <p className="text-[14px] font-bold">Nexus · Admin</p>
        </div>
        <ThemeToggle />
      </nav>
      {/* Scroll horizontal de secciones en móvil */}
      <div className="md:hidden sticky top-14 z-[190] glass-bar overflow-x-auto flex gap-1 px-3 py-2"
        style={{ borderBottom: "0.5px solid var(--border)" }}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}
            className="px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap"
            style={path === n.href
              ? { background: "var(--accent-tint)", color: "var(--accent)" }
              : { color: "var(--text-2)" }}>
            {n.label}
          </Link>
        ))}
      </div>
    </>
  );
}
