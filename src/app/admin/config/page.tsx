import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/* ═══════════════════════════════════════════════════════════════
   Centro de Configuración — Plano Maestro §13.
   Concentra en un solo lugar los accesos a lo que ya existe
   (Usuarios/Roles, Horarios, Vacaciones/Incidencias, Reportes) más
   el estado real de las integraciones. No inventa botones para
   cosas que aún no son configurables desde la app.
   ═══════════════════════════════════════════════════════════════ */

type LinkCard = { href: string; title: string; desc: string };

const GROUPS: { label: string; items: LinkCard[] }[] = [
  {
    label: "Usuarios · Roles · Permisos",
    items: [
      { href: "/admin/empleados", title: "Equipo", desc: "Invitar, dar de baja, cambiar rol o coordinación/departamento." },
    ],
  },
  {
    label: "Jornada · Asistencia",
    items: [
      { href: "/admin/nexus", title: "Asistencia", desc: "Registro de entradas/salidas del equipo, en vivo." },
      { href: "/admin/calendario", title: "Calendario del equipo", desc: "Heatmap mensual de asistencia, vacaciones y días inhábiles." },
      { href: "/admin/dias-inhabiles", title: "Días inhábiles", desc: "Fechas que no cuentan como jornada laboral." },
      { href: "/admin/config/estados-jornada", title: "Estados de jornada", desc: "Qué cuenta como tiempo trabajado y qué pausa la actividad en curso." },
      { href: "/admin/config/dispositivos", title: "Dispositivos", desc: "Teléfonos vinculados a cada persona en /fichar — desactiva los perdidos o reasignados." },
    ],
  },
  {
    label: "Vacaciones · Incidencias",
    items: [
      { href: "/admin/vacaciones", title: "Vacaciones", desc: "Aprobar o rechazar solicitudes de descanso." },
      { href: "/admin/incidencias", title: "Incidencias", desc: "Faltas, permisos, incapacidades y cambios de horario." },
    ],
  },
  {
    label: "Trabajo",
    items: [
      { href: "/admin/proyectos", title: "Actividades", desc: "Todas las actividades en curso, sin importar su origen." },
      { href: "/admin/equipo", title: "Carga del equipo", desc: "Distribución de actividades activas por colaborador." },
      { href: "/admin/reportes", title: "Reportes", desc: "Solicitudes y actividades agregadas por tipo, coordinación y tiempo." },
      { href: "/admin/config/tipos-actividad", title: "Tipos de actividad", desc: "Agrega tipos nuevos (ej. Podcast) y sus checklists, sin tocar código." },
    ],
  },
];

export default async function Config() {
  const supabase = await createClient();
  const [{ count: users }, { count: coordinaciones }] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("departments").select("id", { count: "exact", head: true }).eq("activo", true),
  ]);

  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Configuración</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          Todo lo administrable de Nexus, concentrado en un solo lugar.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-[19px] font-bold tabular-nums">{users ?? 0}</p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Colaboradores activos</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[19px] font-bold tabular-nums">{coordinaciones ?? 0}</p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Coordinaciones/deptos.</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[13px] font-bold" style={{ color: "var(--ok)" }}>Activo</p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Login con Google</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[13px] font-bold" style={{ color: "var(--ok)" }}>Activo</p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Correo (Resend)</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {GROUPS.map((g) => (
          <section key={g.label}>
            <h2 className="text-[12px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-3)" }}>
              {g.label}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className="card card-hover p-4 block">
                  <p className="text-[14px] font-bold">{it.title}</p>
                  <p className="text-[12.5px] mt-1" style={{ color: "var(--text-2)" }}>{it.desc}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
