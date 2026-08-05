import Link from "next/link";
import { EmetMark } from "@/components/emet-mark";
import { createClient } from "@/lib/supabase/server";

// Landing pública de EMET. Raíz del sitio, sin autenticación: Google exige
// poder cargar https://emet.uno sin iniciar sesión para completar la
// verificación de OAuth. El antiguo enrutador por rol que vivía aquí se
// movió a /app (ver src/app/app/page.tsx) — login y las guardias de rol
// redirigen ahí, nunca a "/".
//
// Orden narrativo (ronda de corrección final para Google): Hero → ¿Qué es
// EMET? → ¿Cómo funciona? → Casos de uso → Funcionalidades → Beneficios →
// Footer. Google reportó que la portada no dejaba claro el propósito de
// la app en los primeros segundos — este orden antepone una definición
// explícita (qué es, quién lo usa, qué problema resuelve, por qué existe)
// a la lista de módulos, en vez de asumir que se infiere del contexto.
export const metadata = {
  title: "EMET | Sistema operativo para organizaciones",
  description:
    "EMET es una plataforma web para organizaciones que centraliza la comunicación, la operación, la gestión del tiempo y la colaboración de los equipos en un solo lugar.",
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

const FLUJO = [
  { paso: "Organización", desc: "Un administrador da de alta a la organización y define sus áreas o departamentos." },
  { paso: "Usuarios", desc: "Cada colaborador entra con una cuenta de Google autorizada por el administrador." },
  { paso: "Comunicación", desc: "El equipo se coordina por chat, anuncios y notificaciones dentro de la misma plataforma." },
  { paso: "Operación", desc: "Asistencia, solicitudes y actividades se registran a medida que ocurren, no al final del mes." },
  { paso: "Reportes", desc: "La organización consulta esa información ya ordenada, sin armar nada a mano." },
];

const CASOS_DE_USO = [
  { title: "Instituciones educativas", desc: "Coordinan personal docente y administrativo, asistencia y comunicación institucional en un solo sistema." },
  { title: "Empresas", desc: "Centralizan la operación diaria de sus equipos sin depender de hojas de cálculo y chats sueltos." },
  { title: "Equipos administrativos", desc: "Dan seguimiento a solicitudes, aprobaciones y tareas con un flujo claro y trazable." },
  { title: "Departamentos de Recursos Humanos", desc: "Gestionan asistencia, vacaciones y directorio de colaboradores desde un mismo lugar." },
  { title: "Equipos de comunicación", desc: "Publican avisos y anuncios institucionales que todo el equipo ve en el mismo canal." },
];

export default async function LandingPage() {
  // Lectura de sesión únicamente para decidir el texto/destino del CTA
  // («Iniciar sesión» vs «Ir a mi panel») — no protege nada, la página
  // sigue siendo pública y renderiza igual con o sin sesión.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ctaHref = user ? "/app" : "/login";
  const ctaLabel = user ? "Acceder a EMET" : "Iniciar sesión";

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
            <p className="text-[19px] sm:text-[21px] font-semibold mb-4" style={{ color: "var(--text-2)" }}>
              Sistema operativo para organizaciones educativas, empresas y equipos de trabajo.
            </p>
            <p className="text-[15px] sm:text-[16px] leading-relaxed max-w-[560px] mx-auto mb-10" style={{ color: "var(--text-2)" }}>
              EMET es una plataforma web que centraliza la comunicación, la asistencia, las
              solicitudes, los proyectos, el calendario, los reportes y la operación diaria de
              un equipo en un solo lugar — sin hojas de cálculo, sin chats dispersos y sin
              depender de varias herramientas distintas.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href={ctaHref} className="btn-primary px-6 py-3.5 text-[14px] font-semibold">
                {ctaLabel}
              </Link>
              <a
                href="#que-es"
                className="px-6 py-3.5 text-[14px] font-semibold rounded-sm"
                style={{ color: "var(--text-1)", border: "1px solid var(--border)" }}
              >
                Conocer más
              </a>
            </div>
          </div>
        </section>

        {/* ── ¿Qué puedes hacer con EMET? ── */}
        <section className="px-5 sm:px-10 py-16 sm:py-20" aria-labelledby="capacidades-heading">
          <div className="max-w-[720px] mx-auto">
            <h2 id="capacidades-heading" className="text-[21px] sm:text-[28px] font-bold tracking-tight text-center mb-8">
              ¿Qué puedes hacer con EMET?
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 max-w-[520px] mx-auto">
              {[
                "Gestionar colaboradores",
                "Registrar asistencia",
                "Aprobar vacaciones y solicitudes",
                "Coordinar proyectos y actividades",
                "Comunicación interna",
                "Calendario institucional",
                "Reportes",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[14px]" style={{ color: "var(--text-1)" }}>
                  <span aria-hidden="true" style={{ color: "var(--ok)" }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── ¿Qué es EMET? ── */}
        <section id="que-es" className="px-5 sm:px-10 py-20 sm:py-24" style={{ background: "var(--surface)" }} aria-labelledby="que-es-heading">
          <div className="max-w-[680px] mx-auto text-center flex flex-col gap-5">
            <h2 id="que-es-heading" className="text-[28px] sm:text-[28px] font-bold tracking-tight">
              ¿Qué es EMET?
            </h2>
            <p className="text-[15px] leading-relaxed text-left" style={{ color: "var(--text-2)" }}>
              EMET es un software — una plataforma web — para organizaciones que necesitan
              operar como equipo: instituciones educativas, empresas y departamentos
              administrativos que hoy coordinan su trabajo repartido entre hojas de cálculo,
              chats sueltos y correos.
            </p>
            <p className="text-[15px] leading-relaxed text-left" style={{ color: "var(--text-2)" }}>
              Cada una de esas herramientas resuelve una parte del trabajo, pero ninguna
              muestra el conjunto: nadie tiene una vista completa de cómo está operando
              realmente la organización. EMET existe para reunir esa operación —
              comunicación, asistencia, solicitudes, actividades y reportes — en un solo
              sistema, con la misma información disponible para todo el equipo.
            </p>
          </div>
        </section>

        {/* ── ¿Cómo funciona? ── */}
        <section className="px-5 sm:px-10 py-20 sm:py-24" aria-labelledby="funciona-heading">
          <div className="max-w-[680px] mx-auto">
            <h2 id="funciona-heading" className="text-[28px] sm:text-[28px] font-bold tracking-tight text-center mb-3">
              ¿Cómo funciona?
            </h2>
            <p className="text-[14px] text-center max-w-[480px] mx-auto mb-10" style={{ color: "var(--text-2)" }}>
              El mismo flujo, de principio a fin, sin cambiar de herramienta.
            </p>
            <ol className="flex flex-col gap-3">
              {FLUJO.map((f, i) => (
                <li key={f.paso} className="card p-5 flex items-start gap-4">
                  <span
                    className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-[12.5px] font-bold"
                    style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[14px] font-bold mb-1">{f.paso}</p>
                    <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>{f.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Casos de uso ── */}
        <section className="px-5 sm:px-10 py-20 sm:py-24" style={{ background: "var(--surface)" }} aria-labelledby="casos-heading">
          <div className="max-w-[960px] mx-auto">
            <h2 id="casos-heading" className="text-[28px] sm:text-[28px] font-bold tracking-tight text-center mb-3">
              Casos de uso
            </h2>
            <p className="text-[14px] text-center max-w-[520px] mx-auto mb-12" style={{ color: "var(--text-2)" }}>
              Pensado para organizaciones que necesitan operar con claridad.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CASOS_DE_USO.map((c) => (
                <div key={c.title} className="card p-5">
                  <p className="text-[14px] font-bold mb-1.5">{c.title}</p>
                  <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Funcionalidades ── */}
        <section id="funcionalidades" className="px-5 sm:px-10 py-20 sm:py-24" aria-labelledby="funcionalidades-heading">
          <div className="max-w-[960px] mx-auto">
            <h2 id="funcionalidades-heading" className="text-[28px] sm:text-[28px] font-bold tracking-tight text-center mb-3">
              Funcionalidades
            </h2>
            <p className="text-[14px] text-center max-w-[520px] mx-auto mb-12" style={{ color: "var(--text-2)" }}>
              Todo lo que un equipo necesita para operar, en un solo sistema.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FUNCIONALIDADES.map((f) => (
                <div key={f.title} className="card p-5">
                  <p className="text-[14px] font-bold mb-1.5">{f.title}</p>
                  <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Beneficios ── */}
        <section className="px-5 sm:px-10 py-20 sm:py-24" style={{ background: "var(--surface)" }} aria-labelledby="beneficios-heading">
          <div className="max-w-[960px] mx-auto">
            <h2 id="beneficios-heading" className="text-[28px] sm:text-[28px] font-bold tracking-tight text-center mb-3">
              Lo que cambia al centralizar todo
            </h2>
            <p className="text-[14px] text-center max-w-[520px] mx-auto mb-12" style={{ color: "var(--text-2)" }}>
              No es agregar otra herramienta más. Es dejar de necesitar las demás.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BENEFICIOS.map((b) => (
                <div key={b.title} className="card p-5">
                  <p className="text-[14px] font-bold mb-1.5">{b.title}</p>
                  <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="px-5 sm:px-10 py-10" style={{ borderTop: "1px solid var(--border)" }} role="contentinfo">
          <div className="max-w-[960px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center sm:items-start gap-1">
              <div className="flex items-center gap-2">
                <EmetMark size={22} />
                <span className="text-[13.5px] font-semibold" style={{ color: "var(--text-1)" }}>EMET</span>
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
          <p className="text-[12px] text-center mt-6 max-w-[440px] mx-auto" style={{ color: "var(--text-2)" }}>
            EMET es un software SaaS para organizaciones, desarrollado por Samu Chan.
          </p>
        </footer>
      </main>
    </>
  );
}
