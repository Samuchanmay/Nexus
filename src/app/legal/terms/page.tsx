"use client";
import { useEffect, useState } from "react";
import { EmetMark } from "@/components/emet-mark";

const SECTIONS = [
  { id: "uso", label: "1. Uso permitido" },
  { id: "cuentas", label: "2. Cuentas y acceso" },
  { id: "responsabilidades", label: "3. Responsabilidades" },
  { id: "disponibilidad", label: "4. Disponibilidad del servicio" },
  { id: "propiedad", label: "5. Propiedad intelectual" },
  { id: "cambios", label: "6. Cambios a estos t\u00e9rminos" },
  { id: "contacto", label: "7. Contacto" },
];

export default function TerminosServicio() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);
  void dark;

  return (
    <main className="mesh min-h-screen p-5 sm:p-10" data-mesh="admin">
      <div className="relative z-[1] max-w-[820px] mx-auto py-8">
        <div className="flex items-center gap-3 mb-6">
          <EmetMark size={36} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>EMET</p>
          </div>
        </div>

        <div className="card p-6 sm:p-9">
          <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight mb-1.5">T\u00e9rminos del servicio</h1>
          <p className="text-[13px] mb-6" style={{ color: "var(--text-3)" }}>
            \u00daltima actualizaci\u00f3n: 30 de julio de 2026
          </p>

          <nav className="mb-8 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="hover:underline" style={{ color: "var(--accent)" }}>
                {s.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-7 text-[14px] leading-relaxed" style={{ color: "var(--text-1)" }}>
            <section id="uso">
              <h2 className="text-[16px] font-bold mb-2">1. Uso permitido</h2>
              <p>
                EMET es un sistema operativo interno para organizaciones: centraliza comunicaci\u00f3n,
                registro de jornada, solicitudes, actividades, calendario y reportes de un equipo de
                trabajo. El acceso est\u00e1 restringido a personas autorizadas expresamente por el
                administrador de la organizaci\u00f3n que contrata o despliega EMET. Queda prohibido
                usar la plataforma para fines distintos a la operaci\u00f3n leg\u00edtima de esa
                organizaci\u00f3n, o intentar acceder a cuentas, datos o \u00e1reas para las que no se
                tiene autorizaci\u00f3n.
              </p>
            </section>

            <section id="cuentas">
              <h2 className="text-[16px] font-bold mb-2">2. Cuentas y acceso</h2>
              <p>
                El inicio de sesi\u00f3n se realiza exclusivamente mediante una cuenta de Google
                previamente autorizada por el administrador. Eres responsable de mantener la
                confidencialidad de tu sesi\u00f3n y de notificar de inmediato cualquier uso no
                autorizado de tu cuenta.
              </p>
            </section>

            <section id="responsabilidades">
              <h2 className="text-[16px] font-bold mb-2">3. Responsabilidades</h2>
              <p>
                Eres responsable de la veracidad de la informaci\u00f3n que registras dentro de EMET
                (asistencia, solicitudes, actividades) y de usar la plataforma conforme a las
                pol\u00edticas internas de tu organizaci\u00f3n. EMET no se hace responsable por
                decisiones administrativas o laborales tomadas con base en los datos registrados por
                los propios usuarios.
              </p>
            </section>

            <section id="disponibilidad">
              <h2 className="text-[16px] font-bold mb-2">4. Disponibilidad del servicio</h2>
              <p>
                Buscamos mantener EMET disponible de forma continua, pero no garantizamos un servicio
                libre de interrupciones. Puede haber mantenimientos programados o incidentes fuera de
                nuestro control (por ejemplo, de nuestros proveedores de infraestructura). No somos
                responsables por p\u00e9rdidas derivadas de interrupciones del servicio.
              </p>
            </section>

            <section id="propiedad">
              <h2 className="text-[16px] font-bold mb-2">5. Propiedad intelectual</h2>
              <p>
                El software, dise\u00f1o e identidad de EMET son propiedad de sus desarrolladores. Los
                datos que tu organizaci\u00f3n registra dentro de la plataforma (informaci\u00f3n de
                colaboradores, asistencia, actividades, archivos) siguen siendo propiedad de tu
                organizaci\u00f3n.
              </p>
            </section>

            <section id="cambios">
              <h2 className="text-[16px] font-bold mb-2">6. Cambios a estos t\u00e9rminos</h2>
              <p>
                Podemos actualizar estos t\u00e9rminos ocasionalmente para reflejar cambios en la
                plataforma o en requisitos legales. Publicaremos la fecha de la \u00faltima
                actualizaci\u00f3n en esta misma p\u00e1gina.
              </p>
            </section>

            <section id="contacto">
              <h2 className="text-[16px] font-bold mb-2">7. Contacto</h2>
              <p>
                Para dudas sobre estos t\u00e9rminos, escr\u00edbenos a{" "}
                <a href="mailto:samuel.chan@cert.edu.mx" style={{ color: "var(--accent)" }}>
                  samuel.chan@cert.edu.mx
                </a>{" "}
                o visita nuestra{" "}
                <a href="/contact" style={{ color: "var(--accent)" }}>p\u00e1gina de contacto</a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
