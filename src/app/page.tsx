import Link from "next/link";
import { EmetMark } from "@/components/emet-mark";
import { createClient } from "@/lib/supabase/server";

// Landing publica de EMET. Raiz del sitio, sin auth: Google exige poder
// cargar https://emet.uno sin iniciar sesion para completar la
// verificacion de OAuth. El antiguo enrutador por rol que vivia aqui se
// movio a /app (ver src/app/app/page.tsx) - login y las guardias de rol
// redirigen ahi, nunca a "/".
export const metadata = {
  title: "EMET \u00b7 Sistema operativo para organizaciones",
  description:
    "EMET centraliza la comunicacion, la operacion, la gestion del tiempo y la colaboracion de los equipos en una sola plataforma.",
};

const FEATURES = [
  { title: "Gestion de colaboradores", desc: "Directorio, roles y permisos centralizados para todo el equipo." },
  { title: "Registro de jornada", desc: "Entrada, salida y asistencia con validacion en tiempo real." },
  { title: "Comunicacion interna", desc: "Chat, anuncios y notificaciones en un solo lugar." },
  { title: "Solicitudes", desc: "Vacaciones, incidencias y aprobaciones sin friccion." },
  { title: "Actividades", desc: "Seguimiento de tareas y proyectos por equipo." },
  { title: "Calendario", desc: "Eventos institucionales y jornadas laborales sincronizados." },
  { title: "Reportes", desc: "Productividad, asistencia y vacaciones en reportes claros." },
];

export default async function LandingPage() {
  // Lectura de sesion unicamente para decidir el texto/destino del CTA
  // (\u00abIniciar sesion\u00bb vs \u00abIr a mi panel\u00bb) - no protege nada, la
  // pagina sigue siendo publica y renderiza igual sin sesion.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ctaHref = user ? "/app" : "/login";
  const ctaLabel = user ? "Ir a mi panel" : "Iniciar sesi\u00f3n";

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text-1)" }}>
      <section className="mesh relative overflow-hidden px-5 sm:px-10" data-mesh="admin">
        <div className="relative z-[1] max-w-[720px] mx-auto text-center pt-24 pb-20 sm:pt-32 sm:pb-28">
          <div className="flex justify-center mb-6">
            <EmetMark size={56} />
          </div>
          <h1 className="text-[44px] sm:text-[56px] font-bold tracking-tight leading-none mb-3">EMET</h1>
          <p className="text-[19px] sm:text-[22px] font-semibold mb-4" style={{ color: "var(--text-2)" }}>
            Sistema operativo para organizaciones.
          </p>
          <p className="text-[15px] sm:text-[16px] leading-relaxed max-w-[520px] mx-auto mb-10" style={{ color: "var(--text-3)" }}>
            EMET centraliza la comunicaci\u00f3n, la operaci\u00f3n, la gesti\u00f3n del tiempo y la
            colaboraci\u00f3n de los equipos en una sola plataforma.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href={ctaHref} className="btn-primary px-6 py-3.5 text-[14.5px] font-semibold">
              {ctaLabel}
            </Link>
            <a
              href="#que-hace"
              className="px-6 py-3.5 text-[14.5px] font-semibold rounded-sm"
              style={{ color: "var(--text-1)", border: "1px solid var(--border)" }}
            >
              Conocer m\u00e1s
            </a>
          </div>
        </div>
      </section>

      <section id="que-hace" className="px-5 sm:px-10 py-20 sm:py-24">
        <div className="max-w-[960px] mx-auto">
          <h2 className="text-[26px] sm:text-[30px] font-bold tracking-tight text-center mb-3">
            \u00bfQu\u00e9 hace EMET?
          </h2>
          <p className="text-[14.5px] text-center max-w-[520px] mx-auto mb-12" style={{ color: "var(--text-3)" }}>
            Todo lo que un equipo necesita para operar, en un solo sistema.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-5">
                <p className="text-[14.5px] font-bold mb-1.5">{f.title}</p>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 sm:px-10 py-20 sm:py-24" style={{ background: "var(--surface)" }}>
        <div className="max-w-[720px] mx-auto text-center">
          <h2 className="text-[26px] sm:text-[30px] font-bold tracking-tight mb-4">\u00bfPor qu\u00e9 EMET?</h2>
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-2)" }}>
            EMET est\u00e1 pensado para organizaciones educativas, empresas y equipos de trabajo que
            necesitan operar con claridad: menos herramientas dispersas, menos procesos manuales, y
            un solo lugar donde cada persona encuentra lo que necesita para hacer su trabajo.
          </p>
        </div>
      </section>

      <footer className="px-5 sm:px-10 py-10" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-[960px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <EmetMark size={22} />
            <span className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>EMET</span>
          </div>
          <nav className="flex items-center gap-5 text-[12.5px]" style={{ color: "var(--text-3)" }}>
            <Link href="/legal/privacy" className="hover:underline">Pol\u00edtica de privacidad</Link>
            <Link href="/legal/terms" className="hover:underline">T\u00e9rminos del servicio</Link>
            <Link href="/contact" className="hover:underline">Contacto</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
