"use client";
import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "responsable", label: "1. Responsable del tratamiento" },
  { id: "datos", label: "2. Datos que recabamos" },
  { id: "finalidades", label: "3. Para qué usamos tus datos" },
  { id: "fundamento", label: "4. Por qué no siempre pedimos tu consentimiento" },
  { id: "terceros", label: "5. Con quién compartimos tus datos" },
  { id: "arco", label: "6. Tus derechos ARCO" },
  { id: "seguridad", label: "7. Medidas de seguridad" },
  { id: "conservacion", label: "8. Conservación de datos" },
  { id: "cookies", label: "9. Cookies" },
  { id: "cambios", label: "10. Cambios a este aviso" },
  { id: "autoridad", label: "11. Autoridad y quejas" },
];

export default function AvisoPrivacidad() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  return (
    <main className="mesh min-h-screen p-5 sm:p-10" data-mesh="admin">
      <div className="relative z-[1] max-w-[820px] mx-auto py-8">
        <div className="flex items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dark ? "/logo-cert-dark.png" : "/logo-cert-light.png"} alt="CERT"
            className="h-9 w-9 object-contain shrink-0" />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>Nexus · CERT Comunicación</p>
          </div>
        </div>

        <div className="card p-6 sm:p-9">
          <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight mb-1.5">Aviso de Privacidad Integral</h1>
          <p className="text-[13px] mb-6" style={{ color: "var(--text-3)" }}>
            Última actualización: 17 de julio de 2026
          </p>

          <div className="rounded-sm px-4 py-3.5 mb-7 text-[12.5px] leading-relaxed" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
            Este aviso se redactó como plantilla conforme a la nueva Ley Federal de Protección de Datos
            Personales en Posesión de los Particulares (vigente desde el 21 de marzo de 2025). No sustituye
            la asesoría de un abogado especializado en protección de datos — se recomienda que un asesor legal
            lo revise antes de publicarlo oficialmente, y que se complete el domicilio fiscal señalado en la
            sección 1 antes de usarlo como enlace público.
          </div>

          <nav className="mb-8 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="hover:underline" style={{ color: "var(--accent)" }}>
                {s.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-7 text-[14px] leading-relaxed" style={{ color: "var(--text-1)" }}>
            <section id="responsable">
              <h2 className="text-[16px] font-bold mb-2">1. Responsable del tratamiento de tus datos personales</h2>
              <p>
                <strong>Excelencia en Educación A.C.</strong> (operando bajo el nombre comercial "CERT"), es
                responsable del tratamiento de tus datos personales conforme a este aviso.
              </p>
              <p className="mt-2 rounded-sm px-4 py-3" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                Domicilio: <em>[Completar con el domicilio fiscal de Excelencia en Educación A.C. antes de publicar este aviso]</em>
                <br />Correo de contacto: <a href="mailto:samuel.chan@cert.edu.mx" style={{ color: "var(--accent)" }}>samuel.chan@cert.edu.mx</a>
              </p>
            </section>

            <section id="datos">
              <h2 className="text-[16px] font-bold mb-2">2. Datos personales que recabamos</h2>
              <p>Para operar el sistema Nexus, recabamos y tratamos los siguientes datos de nuestro personal:</p>
              <ul className="list-disc pl-5 mt-2 flex flex-col gap-1.5">
                <li><strong>Identificación:</strong> nombre completo, fecha de nacimiento, fotografía de perfil.</li>
                <li><strong>Contacto:</strong> correo electrónico y la cuenta de Google con la que inicias sesión.</li>
                <li><strong>Identificación fiscal:</strong> RFC y CURP.</li>
                <li><strong>Laborales:</strong> cargo, coordinación o departamento, fecha de ingreso, jornada laboral, actividades asignadas y su seguimiento.</li>
                <li><strong>Asistencia:</strong> hora y ubicación (GPS) al registrar entrada/salida, y el dispositivo utilizado — esto es para evitar registros fraudulentos, no para rastrearte fuera de tu jornada.</li>
                <li><strong>Vacaciones e incidencias:</strong> solicitudes, saldos, historial y notas administrativas relacionadas.</li>
                <li>
                  <strong>Derivados de tu cuenta de Google:</strong> nombre, correo y foto de perfil pública; y,
                  solo si tú lo autorizas expresamente al conectar tu cuenta, permiso limitado para crear o
                  editar eventos en un calendario de Google Calendar designado por la institución, para guardar
                  o compartir archivos generados por Nexus en tu Google Drive (acceso restringido únicamente a
                  los archivos que la propia app crea — nunca a tus demás archivos), y para enviar un correo en
                  tu nombre únicamente cuando tú generas esa acción desde Nexus.
                </li>
              </ul>
              <p className="mt-3">
                No recabamos datos personales sensibles (origen racial o étnico, estado de salud, información
                genética, creencias religiosas, filosóficas o morales, afiliación sindical, opiniones políticas
                o preferencia sexual).
              </p>
            </section>

            <section id="finalidades">
              <h2 className="text-[16px] font-bold mb-2">3. Para qué usamos tus datos</h2>
              <p className="font-semibold mt-1">Finalidades necesarias (no requieren tu consentimiento adicional, por ser indispensables para tu relación laboral y para operar Nexus):</p>
              <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
                <li>Administrar tu perfil y cuenta dentro de Nexus.</li>
                <li>Registrar y controlar asistencia, jornada laboral y actividades.</li>
                <li>Gestionar solicitudes, aprobaciones y saldos de vacaciones.</li>
                <li>Enviarte notificaciones operativas dentro de la plataforma (aprobaciones, recordatorios, cambios de estado).</li>
                <li>Elaborar reportes internos de productividad, asistencia y vacaciones para fines administrativos y de recursos humanos.</li>
                <li>Cumplir obligaciones legales, laborales y fiscales aplicables a la institución.</li>
              </ul>
              <p className="font-semibold mt-4">Finalidades adicionales (requieren tu consentimiento expreso, que otorgas al conectar tu cuenta de Google y que puedes revocar cuando quieras):</p>
              <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
                <li>Crear eventos en Google Calendar vinculados a vacaciones o actividades aprobadas.</li>
                <li>Guardar o compartir en Google Drive las evidencias o archivos generados por Nexus.</li>
                <li>Enviar, a través de tu cuenta de Google, correos de notificación que tú mismo generas desde Nexus.</li>
              </ul>
            </section>

            <section id="fundamento">
              <h2 className="text-[16px] font-bold mb-2">4. Por qué no siempre pedimos tu consentimiento</h2>
              <p>
                Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares,
                vigente desde el 21 de marzo de 2025, no se requiere tu consentimiento para tratar los datos
                necesarios para cumplir obligaciones derivadas de la relación jurídica (laboral) que tienes con
                la institución, ni para cumplir obligaciones legales aplicables.
              </p>
            </section>

            <section id="terceros">
              <h2 className="text-[16px] font-bold mb-2">5. Con quién compartimos tus datos</h2>
              <p>
                No vendemos, rentamos ni compartimos tus datos con terceros para fines de mercadotecnia. Para
                operar Nexus contratamos a los siguientes encargados, que solo tratan datos por nuestra
                instrucción y no pueden usarlos para fines propios:
              </p>
              <ul className="list-disc pl-5 mt-2 flex flex-col gap-1.5">
                <li><strong>Supabase, Inc.</strong> — base de datos, autenticación y almacenamiento de archivos (fotos de perfil).</li>
                <li><strong>Google LLC</strong> — inicio de sesión y, solo con tu autorización, Google Calendar, Google Drive y envío de correo.</li>
                <li><strong>Vercel Inc.</strong> — alojamiento (hosting) de la aplicación.</li>
              </ul>
              <p className="mt-2">
                Estos proveedores pueden almacenar información en servidores fuera de México; exigimos que
                mantengan medidas de seguridad adecuadas para proteger tus datos.
              </p>
            </section>

            <section id="arco">
              <h2 className="text-[16px] font-bold mb-2">6. Tus derechos ARCO</h2>
              <p>
                Tienes derecho a <strong>A</strong>cceder a tus datos, <strong>R</strong>ectificarlos si son
                inexactos, <strong>C</strong>ancelarlos cuando consideres que no se requieren para las
                finalidades señaladas, y <strong>O</strong>ponerte a su tratamiento para fines específicos.
                También puedes revocar en cualquier momento el consentimiento que hayas dado — por ejemplo, el
                acceso a Google Calendar/Drive, directamente desde{" "}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                  myaccount.google.com/permissions
                </a>.
              </p>
              <p className="mt-2">
                Para ejercer estos derechos, envía tu solicitud a{" "}
                <a href="mailto:samuel.chan@cert.edu.mx" style={{ color: "var(--accent)" }}>samuel.chan@cert.edu.mx</a>{" "}
                indicando tu nombre completo, el derecho que deseas ejercer y una descripción clara de tu
                solicitud. Te responderemos dentro de los 20 días hábiles siguientes a la recepción y, de
                proceder, la haremos efectiva dentro de los 15 días hábiles posteriores — ambos plazos pueden
                prorrogarse una sola vez por un periodo igual cuando las circunstancias lo justifiquen.
              </p>
            </section>

            <section id="seguridad">
              <h2 className="text-[16px] font-bold mb-2">7. Medidas de seguridad</h2>
              <p>
                Empleamos medidas administrativas, técnicas y físicas razonables para proteger tus datos:
                acceso restringido por rol dentro de Nexus, cifrado en tránsito (HTTPS), políticas de acceso a
                nivel de base de datos (Row Level Security) y autenticación mediante tu cuenta institucional de
                Google.
              </p>
            </section>

            <section id="conservacion">
              <h2 className="text-[16px] font-bold mb-2">8. Conservación de datos</h2>
              <p>
                Conservamos tus datos mientras dure tu relación con la institución y, después, durante los
                plazos que exijan las obligaciones legales, laborales o fiscales aplicables. Al concluir esos
                plazos, los datos se eliminan o anonimizan de forma segura.
              </p>
            </section>

            <section id="cookies">
              <h2 className="text-[16px] font-bold mb-2">9. Uso de cookies</h2>
              <p>
                Nexus utiliza únicamente cookies estrictamente necesarias para mantener tu sesión iniciada
                (autenticación). No utilizamos cookies de publicidad ni de rastreo de terceros.
              </p>
            </section>

            <section id="cambios">
              <h2 className="text-[16px] font-bold mb-2">10. Cambios a este aviso de privacidad</h2>
              <p>
                Podemos actualizar este aviso para reflejar cambios legales, técnicos u operativos. Cualquier
                cambio se publicará en esta misma página junto con su fecha de "última actualización". Te
                recomendamos revisarla periódicamente.
              </p>
            </section>

            <section id="autoridad">
              <h2 className="text-[16px] font-bold mb-2">11. Autoridad y quejas</h2>
              <p>
                Si consideras que tus derechos de protección de datos no han sido atendidos adecuadamente,
                puedes acudir a la Secretaría Anticorrupción y Buen Gobierno, a través de su Dirección General
                de Datos Personales en el Sector Privado — autoridad garante en la materia desde la extinción
                del INAI en 2025.
              </p>
            </section>
          </div>
        </div>

        <p className="text-center text-[11.5px] mt-6" style={{ color: "var(--text-3)" }}>
          Nexus · CERT Comunicación
        </p>
      </div>
    </main>
  );
}
