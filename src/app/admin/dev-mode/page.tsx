import Link from "next/link";
import { Icon } from "@/components/os/icons";

/* ═══════════════════════════════════════════════════════════════
   Modo desarrollador — mapa de TODAS las pantallas de Nexus.

   No es impersonación real: cada layout (empleado/coordinador/rh)
   ya deja pasar al admin (ver el `.includes(profile.role)` de cada
   uno), así que estos enlaces simplemente navegan ahí mismo con tu
   propia cuenta de admin. Vas a ver la interfaz real de cada
   pantalla, pero con TUS datos (tu saldo de vacaciones, tu jornada,
   etc.), no los de un colaborador específico — sirve para probar
   flujos y encontrar errores visuales o de lógica, no para revisar
   la información privada de alguien más.
   ═══════════════════════════════════════════════════════════════ */

type LinkItem = { href: string; title: string; desc: string; icon: string };
type Group = { label: string; note?: string; items: LinkItem[] };

const GROUPS: Group[] = [
  {
    label: "Admin",
    items: [
      { href: "/admin", title: "Hoy", desc: "Dashboard principal del admin.", icon: "home" },
      { href: "/admin/proyectos", title: "Actividades", desc: "Todas las actividades + dependencias.", icon: "layers" },
      { href: "/admin/solicitudes", title: "Solicitudes", desc: "Aprobar/rechazar, tabs por estado.", icon: "inbox" },
      { href: "/admin/calendario", title: "Calendario del equipo", desc: "Asistencia / Actividades / Vacaciones.", icon: "calendar" },
      { href: "/admin/biblioteca", title: "Biblioteca", desc: "Archivo de actividades terminadas.", icon: "book" },
      { href: "/admin/equipo", title: "Carga del equipo", desc: "Distribución de trabajo activo.", icon: "users" },
      { href: "/admin/empleados", title: "Equipo (usuarios)", desc: "Invitar, dar de baja, roles.", icon: "users" },
      { href: "/admin/nexus", title: "Asistencia", desc: "Tabla / Gantt / Semana + reporte por correo.", icon: "clock" },
      { href: "/admin/dias-inhabiles", title: "Días inhábiles", desc: "Lista + vista de mes.", icon: "calendar" },
      { href: "/admin/vacaciones", title: "Vacaciones (aprobación)", desc: "Saldo, semáforo, cancelaciones.", icon: "sun" },
      { href: "/admin/incidencias", title: "Incidencias", desc: "Permisos, incapacidades, etc.", icon: "alert" },
      { href: "/admin/reportes", title: "Reportes", desc: "Agregados + CSV + PDF.", icon: "chart" },
      { href: "/admin/config", title: "Configuración", desc: "Centro de configuración.", icon: "settings" },
      { href: "/admin/config/estados-jornada", title: "Estados de jornada", desc: "Qué cuenta como tiempo trabajado.", icon: "toggle" },
      { href: "/admin/config/tipos-actividad", title: "Tipos de actividad", desc: "Catálogo + checklists.", icon: "tag" },
      { href: "/admin/config/dispositivos", title: "Dispositivos", desc: "Teléfonos vinculados a /fichar.", icon: "device" },
    ],
  },
  {
    label: "Colaborador (empleado)",
    note: "Verás tu propia jornada/vacaciones de admin, no las de un colaborador real.",
    items: [
      { href: "/empleado", title: "Mi día", desc: "Vista de tareas del colaborador.", icon: "home" },
      { href: "/empleado/vacaciones", title: "Solicitar vacaciones", desc: "Formulario de solicitud, con traslapes.", icon: "sun" },
      { href: "/empleado/calendario", title: "Mi calendario", desc: "Fechas límite, vacaciones, inhábiles.", icon: "calendar" },
      { href: "/empleado/incidencias", title: "Mis incidencias", desc: "Registrar permisos/incapacidades.", icon: "alert" },
      { href: "/empleado/jornada", title: "Mi jornada", desc: "Estado de jornada en vivo.", icon: "clock" },
    ],
  },
  {
    label: "Coordinador / Departamento",
    items: [
      { href: "/coordinador", title: "Panel coordinador", desc: "Crear solicitudes de comunicación.", icon: "inbox" },
    ],
  },
  {
    label: "RH",
    note: "Este rol es de solo lectura.",
    items: [
      { href: "/rh", title: "Panel RH", desc: "Vista de solo lectura del equipo.", icon: "users" },
    ],
  },
  {
    label: "Compartido",
    items: [
      { href: "/fichar", title: "Fichar", desc: "Registrar entrada/salida (con GPS y validación de dispositivo).", icon: "clock" },
    ],
  },
];

export default function DevMode() {
  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Modo desarrollador</h1>
        <p className="text-[13.5px] mt-1 max-w-[640px]" style={{ color: "var(--text-2)" }}>
          Enlaces directos a cada pantalla de Nexus, agrupados por rol, para probar flujos y encontrar errores.
          Como admin ya tienes acceso a todas — esto solo te evita adivinar la URL.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {GROUPS.map((g) => (
          <section key={g.label}>
            <div className="flex items-baseline gap-2 mb-2.5">
              <h2 className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
                {g.label}
              </h2>
              {g.note && <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>· {g.note}</span>}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className="card card-hover p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0"
                    style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
                    <Icon name={it.icon} size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold">{it.title}</p>
                    <p className="text-[12px] mt-1" style={{ color: "var(--text-2)" }}>{it.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
