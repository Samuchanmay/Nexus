import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/os/icons";

/* ═══════════════════════════════════════════════════════════════
   Centro de Configuración — Plano Maestro §13 + rediseño §12
   (brief de rediseño: "Configuración regrupada por categoría").

   Antes: dos grupos por implementación ("Solo aquí" vs "Accesos
   rápidos") — útil para mí al construirlo, confuso para quien lo usa.
   Ahora: agrupado por lo que la persona está tratando de hacer
   (Jornada, Actividades y equipo, Sistema), sin duplicar lo que ya
   vive a un clic en el menú lateral.
   ═══════════════════════════════════════════════════════════════ */

type LinkCard = { href: string; title: string; desc: string; icon: string };

const CATEGORIES: { title: string; items: LinkCard[] }[] = [
  {
    title: "Jornada y asistencia",
    items: [
      { href: "/admin/config/estados-jornada", title: "Estados de jornada", icon: "toggle",
        desc: "Qué cuenta como tiempo trabajado y qué pausa la actividad en curso." },
      { href: "/admin/config/dispositivos", title: "Dispositivos", icon: "device",
        desc: "Teléfonos vinculados a cada persona en /fichar — desactiva los perdidos o reasignados." },
      { href: "/admin/dias-inhabiles", title: "Días inhábiles", icon: "calendar",
        desc: "Fechas que no cuentan como jornada laboral." },
    ],
  },
  {
    title: "Actividades y equipo",
    items: [
      { href: "/admin/config/tipos-actividad", title: "Tipos de actividad", icon: "tag",
        desc: "Agrega tipos nuevos (ej. Podcast) y sus checklists, sin tocar código." },
      { href: "/admin/config/pausa-activa", title: "Pausa activa", icon: "food",
        desc: "Frases y ritmo del aviso de pausa activa que muestra el Asistente." },
      { href: "/admin/empleados", title: "Equipo", icon: "users",
        desc: "Invitar, dar de baja, cambiar rol o coordinación/departamento." },
      { href: "/admin/reportes", title: "Reportes", icon: "chart",
        desc: "Solicitudes y actividades agregadas por tipo, coordinación y tiempo." },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/dev-mode", title: "Modo desarrollador", icon: "layers",
        desc: "Mapa de todas las pantallas de Nexus, agrupadas por rol — para probar y encontrar errores." },
    ],
  },
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
          Lo que solo se administra desde aquí, agrupado por lo que estás haciendo.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        <div className="card p-4 text-center">
          <p className="text-[19px] font-bold tabular-nums">{users ?? 0}</p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Colaboradores activos</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[19px] font-bold tabular-nums">{coordinaciones ?? 0}</p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Coordinaciones/deptos.</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[13px] font-bold flex items-center justify-center gap-1" style={{ color: "var(--ok)" }}>
            <Icon name="check" size={12} /> Activo
          </p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Login con Google</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[13px] font-bold flex items-center justify-center gap-1" style={{ color: "var(--ok)" }}>
            <Icon name="check" size={12} /> Activo
          </p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Correo (Resend)</p>
        </div>
      </div>

      <div className="flex flex-col gap-7">
        {CATEGORIES.map((cat) => (
          <section key={cat.title}>
            <h2 className="text-[12px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-3)" }}>
              {cat.title}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {cat.items.map((it) => <Card key={it.href} it={it} />)}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
