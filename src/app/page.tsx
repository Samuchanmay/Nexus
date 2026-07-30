import Link from "next/link";
import { EmetMark } from "@/components/emet-mark";
import { createClient } from "@/lib/supabase/server";

// Landing pública de EMET. Raíz del sitio, sin autenticación: Google exige
// poder cargar https://emet.uno sin iniciar sesión para completar la
// verificación de OAuth. El antiguo enrutador por rol que vivía aquí se
// movió a /app (ver src/app/app/page.tsx) — login y las guardias de rol
// redirigen ahí, nunca a "/".
//
// Orden narrativo (ronda de auditoría): Hero → Problema → Solución →
// Funcionalidades → Beneficios → Capturas → Footer. Antes iba directo de
// Hero a una lista de módulos, sin explicar primero qué problema resuelve
// EMET — de ahí que se sintiera "una página de login ampliada" en vez de
// un sitio institucional.
export const metadata = {
  title: "EMET · Sistema operativo para organizaciones",
  description:
    "EMET centraliza la comunicación, la operación, la gestión del tiempo y la colaboración de los equipos en una sola plataforma.",
};

const FUNCIONALIDADES = [
  { title: "Gestión de colaboradores", desc: "Directorio, roles y permisos centralizados para todo el equipo." },
  { title: "Registro de jornada", desc: "Entrada, salida y asistencia con validación en tiempo real." },
  { title: "Comunicación interna", desc: "Chat, anuncios y notificaciones en un solo lugar." },
  { title: "Solicitudes", desc: "Vacaciones, incidencias y aprobaciones sin fricción." },
  { title: "Actividades", desc: "Seguimiento de tareas y proyectos por equipo." },
  { title: "Calendario", desc: "Eventos institucionales y jornadas laborales sincronizados." },
  { title: "Reportes", desc: "Productividad, asistencia y vacaciones en reportes claros." },
];

const BENEFICIOS = [
  { title: "Una única fuente de verdad", desc: "Los datos de la organización viven en un solo lugar, no repartidos entre hojas de cálculo, chats y correos." },
  { title: "Información sincronizada", desc: "Lo que un equipo registra, el resto lo ve al instante — sin reenviar archivos ni pedir actualizaciones." },
  { title: "Equipos conectados", desc: "Comunicación, tareas y asistencia comparten el mismo contexto en vez de vivir en apps distintas." },
  { title: "Procesos claros", desc: "Cada solicitud, aprobación y registro sigue un flujo definido, visible para quien lo necesita." },
  { title: "Menos herramientas", desc: "Un sistema en vez de cinco suscripciones distintas que hay que mantener sincronizadas a mano." },
  { title: "Más productividad", desc: "Menos tiempo buscando información y coordinando por mensajes, más tiempo operando." },
];

export default async function LandingPage() {
  // Lectura de sesión únicamente para decidir el texto/destino del CTA
  // («Iniciar sesión» vs «Ir a mi panel») — no protege nada, la página
  // sigue siendo pública y renderiza igual con o sin sesión.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ctaHref = user ? "/app" : "/login";
  const ctaLabel = user ? "Ir a mi panel" : "Iniciar sesión";

  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-sm"
        style={{ background: "var(--surface)", color: "var(--text-1)", border: "1px solid var(--border)" }}
      >
        Saltar al contenido principal
      </a>

      <main id="contenido" className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text-1)" }}>
        {/* ── Hero ── */}
        <section className="mesh relative overflow-hidden px-5 sm:px-10" data-mesh="admin" aria-label="Presentación de EMET">
          <div className="relative z-[1] max-w-[720px] mx-auto text-center pt-24 pb-20 sm:pt-32 sm:pb-28">
            <div className="flex justify-center mb-6">
              <EmetMark size={56} />
            </div>
            <h1 className="text-[44px] sm:text-[56px] font-bold tracking-tight leading-none mb-3">EMET</h1>
            <p className="text-[19px] sm:text-[22px] font-semibold mb-4" style={{ color: "var(--text-2)" }}>
              Sistema operativo para organizaciones.
            </p>
            <p className="text-[15px] sm:text-[16px] leading-relaxed max-w-[520px] mx-auto mb-10" style={{ color: "var(--text-2)" }}>
              EMET centraliza la comunicación, la operación, la gestión del tiempo y la
              colaboración de los equipos en una sola plataforma.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href={ctaHref} className="btn-primary px-6 py-3.5 text-[14.5px] font-semibold">
                {ctaLabel}
              </Link>
              <a
                href="#problema"
                className="px-6 py-3.5 text-[14.5px] font-semibold rounded-sm"
                style={{ color: "var(--text-1)", border: "1px solid var(--border)" }}
              >
                Conocer más
              </a>
            </div>
          </div>
        </section>

        {/* ── Problema ── */}
        <section id="problema" className="px-5 sm:px-10 py-20 sm:py-24" style={{ background: "var(--surface)" }} aria-labelledby="problema-heading">
          <div className="max-w-[680px] mx-auto text-center">
            <h2 id="problema-heading" className="text-[26px] sm:text-[30px] font-bold tracking-tight mb-4">
              La operación de un equipo vive repartida en demasiados lugares
            </h2>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              Asistencia en una hoja de cálculo, solicitudes por correo, avisos importantes
              perdidos en un chat de WhatsApp, reportes armados a mano cada mes. Cada
              herramienta resuelve una parte, pero nadie tiene una vista completa de cómo
              está operando realmente la organización.
            </p>
          </div>
        </section>

        {/* ── Solución ── */}
        <section id="solucion" className="px-5 sm:px-10 py-20 sm:py-24" aria-labelledby="solucion-heading">
          <div className="max-w-[680px] mx-auto text-center">
            <h2 id="solucion-heading" className="text-[26px] sm:text-[30px] font-bold tracking-tight mb-4">
              EMET reúne esa operación en un solo sistema
            </h2>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              En vez de coordinar cinco herramientas distintas, cada persona de la
              organización entra a un mismo lugar para comunicarse, registrar su jornada,
              hacer solicitudes y dar seguimiento a su trabajo — con información que se
              mantiene consistente para todo el equipo.
            </p>
          </div>
        </section>

        {/* ── Funcionalidades ── */}
        <section id="funcionalidades" className="px-5 sm:px-10 py-20 sm:py-24" style={{ background: "var(--surface)" }} aria-labelledby="funcionalidades-heading">
          <div className="max-w-[960px] mx-auto">
            <h2 id="funcionalidades-heading" className="text-[26px] sm:text-[30px] font-bold tracking-tight text-center mb-3">
              Así se ve en la práctica
            </h2>
            <p className="text-[14.5px] text-center max-w-[520px] mx-auto mb-12" style={{ color: "var(--text-2)" }}>
              Todo lo que un equipo necesita para operar, en un solo sistema.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FUNCIONALIDADES.map((f) => (
                <div key={f.title} className="card p-5">
                  <p className="text-[14.5px] font-bold mb-1.5">{f.title}</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Beneficios ── */}
        <section id="beneficios" className="px-5 sm:px-10 py-20 sm:py-24" aria-labelledby="beneficios-heading">
          <div className="max-w-[960px] mx-auto">
            <h2 id="beneficios-heading" className="text-[26px] sm:text-[30px] font-bold tracking-tight text-center mb-3">
              Lo que cambia al centralizar todo
            </h2>
            <p className="text-[14.5px] text-center max-w-[520px] mx-auto mb-12" style={{ color: "var(--text-2)" }}>
              No es agregar otra herramienta más. Es dejar de necesitar las demás.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BENEFICIOS.map((b) => (
                <div key={b.title} className="card p-5">
                  <p className="text-[14.5px] font-bold mb-1.5">{b.title}</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Por qué EMET ── */}
        <section className="px-5 sm:px-10 py-20 sm:py-24" style={{ background: "var(--surface)" }} aria-labelledby="por-que-heading">
          <div className="max-w-[680px] mx-auto text-center">
            <h2 id="por-que-heading" className="text-[26px] sm:text-[30px] font-bold tracking-tight mb-4">¿Por qué EMET?</h2>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              EMET está pensado para organizaciones educativas, empresas y equipos de trabajo
              que necesitan operar con claridad: menos herramientas dispersas, menos procesos
              manuales, y un solo lugar donde cada persona encuentra lo que necesita para
              hacer su trabajo.
            </p>
          </div>
        </section>

        <footer className="px-5 sm:px-10 py-10" style={{ borderTop: "1px solid var(--border)" }} role="contentinfo">
          <div className="max-w-[960px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center sm:items-start gap-1">
              <div className="flex items-center gap-2">
                <EmetMark size={22} />
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-1)" }}>EMET</span>
              </div>
              <span className="text-[12px]" style={{ color: "var(--text-2)" }}>
                Sistema operativo para organizaciones
              </span>
            </div>
            <nav aria-label="Enlaces legales y de contacto" className="flex items-center gap-5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
              <Link href="/legal/privacy" className="hover:underline">Política de privacidad</Link>
              <Link href="/legal/terms" className="hover:underline">Términos del servicio</Link>
              <Link href="/contact" className="hover:underline">Contacto</Link>
            </nav>
          </div>
          <p className="text-[11.5px] text-center mt-6" style={{ color: "var(--text-3)" }}>
            Desarrollado por Samu Chan
          </p>
        </footer>
      </main>
    </>
  );
}
