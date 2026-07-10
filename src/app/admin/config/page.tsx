import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/os/icons";

/* ═══════════════════════════════════════════════════════════════
   Centro de Configuración — Plano Maestro §13.

   Decisión de alcance (evaluada en el bloque "Pantallas específicas"):
   de los 12 accesos que este hub tenía originalmente, 9 eran copia
   exacta de algo que el admin ya tiene a un clic en el menú lateral
   (Equipo, Asistencia, Calendario, Vacaciones, Incidencias,
   Actividades, Carga del equipo, Días inhábiles, Reportes ya están
   en NAV). Solo 3 pantallas viven ÚNICAMENTE aquí: Estados de
   jornada, Dispositivos y Tipos de actividad — no tienen entrada
   propia en el menú principal.

   Por eso este hub se quedó como Centro de Configuración real (no
   un espejo del menú): primero lo que solo existe aquí, y debajo un
   puñado de accesos rápidos con valor real desde una vista de admin
   (Equipo, Días inhábiles, Reportes). El resto se quitó — vivir
   duplicados en dos lugares no ayudaba, solo alargaba la página.
   ═══════════════════════════════════════════════════════════════ */

type LinkCard = { href: string; title: string; desc: string; icon: string };

const ONLY_HERE: LinkCard[] = [
  { href: "/admin/config/estados-jornada", title: "Estados de jornada", icon: "toggle",
    desc: "Qué cuenta como tiempo trabajado y qué pausa la actividad en curso." },
  { href: "/admin/config/tipos-actividad", title: "Tipos de actividad", icon: "tag",
    desc: "Agrega tipos nuevos (ej. Podcast) y sus checklists, sin tocar código." },
  { href: "/admin/config/dispositivos", title: "Dispositivos", icon: "device",
    desc: "Teléfonos vinculados a cada persona en /fichar — desactiva los perdidos o reasignados." },
];

const SHORTCUTS: LinkCard[] = [
  { href: "/admin/empleados", title: "Equipo", icon: "users",
    desc: "Invitar, dar de baja, cambiar rol o coordinación/departamento." },
  { href: "/admin/dias-inhabiles", title: "Días inhábiles", icon: "calendar",
    desc: "Fechas que no cuentan como jornada laboral." },
  { href: "/admin/reportes", title: "Reportes", icon: "chart",
    desc: "Solicitudes y actividades agregadas por tipo, coordinación y tiempo." },
];

function Card({ it }: { it: LinkCard }) {
  return (
    <Link href={it.href} className="card card-hover p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0"
        style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
        <Icon name={it.icon} size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-bold">{it.title}</p>
        <p className="text-[12.5px] mt-1" style={{ color: "var(--text-2)" }}>{it.desc}</p>
      </div>
    </Link>
  );
}

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
          Lo que solo se administra desde aquí, más algunos accesos rápidos.
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
        <section>
          <h2 className="text-[12px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-3)" }}>
            Solo aquí
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {ONLY_HERE.map((it) => <Card key={it.href} it={it} />)}
          </div>
        </section>

        <section>
          <h2 className="text-[12px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-3)" }}>
            Accesos rápidos
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {SHORTCUTS.map((it) => <Card key={it.href} it={it} />)}
          </div>
        </section>
      </div>
    </>
  );
}
