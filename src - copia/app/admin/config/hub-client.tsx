"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/os/icons";
import type { JornadaState } from "@/lib/hours";
import type { ActivityType, Department, GpsZone, Schedule } from "@/lib/types";

import EstadosClient, { type EstadoRow } from "./estados-jornada/client";
import DispositivosClient, { type DeviceRow } from "./dispositivos/client";
import HorariosClient, { type Person } from "./horarios/client";
import GpsClient, { type DeviceGeoRow } from "./gps/client";
import TiposClient from "./tipos-actividad/client";
import type { ChecklistTemplateRow } from "./tipos-actividad/page";
import PausaActivaClient from "./pausa-activa/client";
import type { PausaFraseRow } from "./pausa-activa/page";
import ColoresClient from "./colores/client";

type SectionId = "estados-jornada" | "dispositivos" | "horarios" | "gps" | "tipos-actividad" | "pausa-activa" | "colores";

const SECTIONS: { id: SectionId; title: string; desc: string; icon: string; group: string }[] = [
  { id: "estados-jornada", title: "Estados de jornada", icon: "toggle", group: "Jornada y asistencia",
    desc: "Qué cuenta como tiempo trabajado y qué pausa la actividad en curso." },
  { id: "dispositivos", title: "Dispositivos", icon: "device", group: "Jornada y asistencia",
    desc: "Teléfonos vinculados a cada persona en /fichar — desactiva los perdidos o reasignados." },
  { id: "horarios", title: "Horarios", icon: "clock", group: "Jornada y asistencia",
    desc: "Hora de entrada y horas objetivo por persona — crea horarios temporales para vacaciones." },
  { id: "gps", title: "Zona GPS", icon: "pin", group: "Jornada y asistencia",
    desc: "Coordenadas y radio permitido para fichar — cámbialas sin tocar código ni redesplegar." },
  { id: "tipos-actividad", title: "Tipos de actividad", icon: "tag", group: "Actividades y equipo",
    desc: "Agrega tipos nuevos (ej. Podcast) y sus checklists, sin tocar código." },
  { id: "pausa-activa", title: "Pausa activa", icon: "food", group: "Actividades y equipo",
    desc: "Frases y ritmo del aviso de pausa activa que muestra el Asistente." },
  { id: "colores", title: "Colores de equipo", icon: "palette", group: "Actividades y equipo",
    desc: "El color fijo de cada coordinación/departamento y de RH — ninguno se repite." },
];

const GROUPS = ["Jornada y asistencia", "Actividades y equipo"];

type QuickLink = { href: string; title: string; desc: string; icon: string };
const QUICK_LINKS: { title: string; items: QuickLink[] }[] = [
  {
    title: "Otros accesos",
    items: [
      { href: "/admin/dias-inhabiles", title: "Días inhábiles", icon: "calendar",
        desc: "Fechas que no cuentan como jornada laboral." },
      { href: "/admin/empleados", title: "Equipo", icon: "users",
        desc: "Invitar, dar de baja, cambiar rol o coordinación/departamento." },
      { href: "/admin/reportes", title: "Reportes", icon: "chart",
        desc: "Solicitudes y actividades agregadas por tipo, coordinación y tiempo." },
      { href: "/admin/dev-mode", title: "Modo desarrollador", icon: "layers",
        desc: "Mapa de todas las pantallas de Emet, agrupadas por rol." },
    ],
  },
];

export default function ConfigHub(props: {
  topStats: { users: number; coordinaciones: number };
  isProdMode: boolean;
  isEmailConfigured: boolean;
  adminId?: string;
  estados: (JornadaState & { id: string })[];
  devices: DeviceRow[];
  horariosTeam: Person[];
  horariosScheds: Schedule[];
  gpsZones: GpsZone[];
  gpsDevices: DeviceGeoRow[];
  tipos: ActivityType[];
  templates: ChecklistTemplateRow[];
  pausaFrases: PausaFraseRow[];
  pausaIntervalMin: number;
  pausaWindowMin: number;
  pausaModo: "secuencial" | "aleatorio";
  coloresAreas: Department[];
  rhColor: string | null;
}) {
  const { topStats, isProdMode, isEmailConfigured } = props;
  const [selected, setSelected] = useState<SectionId | null>("estados-jornada");
  const active = SECTIONS.find((s) => s.id === selected);

  const renderSection = () => {
    switch (selected) {
      case "estados-jornada": return <EstadosClient states={props.estados} adminId={props.adminId} embedded />;
      case "dispositivos": return <DispositivosClient devices={props.devices} adminId={props.adminId} embedded />;
      case "horarios": return <HorariosClient team={props.horariosTeam} schedules={props.horariosScheds} adminId={props.adminId} embedded />;
      case "gps": return <GpsClient zones={props.gpsZones} devices={props.gpsDevices} adminId={props.adminId} embedded />;
      case "tipos-actividad": return <TiposClient types={props.tipos} templates={props.templates} embedded />;
      case "pausa-activa": return (
        <PausaActivaClient frases={props.pausaFrases} intervalMin={props.pausaIntervalMin}
          windowMin={props.pausaWindowMin} modo={props.pausaModo} embedded />
      );
      case "colores": return <ColoresClient areas={props.coloresAreas} rhColor={props.rhColor} embedded />;
      default: return null;
    }
  };

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
          <p className="text-[19px] font-bold tabular-nums">{topStats.users}</p>
          <p className="text-[12px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Colaboradores activos</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[19px] font-bold tabular-nums">{topStats.coordinaciones}</p>
          <p className="text-[12px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Coordinaciones/deptos.</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[13px] font-bold flex items-center justify-center gap-1" style={{ color: isProdMode ? "var(--ok)" : "var(--warn)" }}>
            <Icon name={isProdMode ? "check" : "alert"} size={12} /> {isProdMode ? "Producción" : "Modo demo"}
          </p>
          <p className="text-[12px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Conexión con Supabase</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[13px] font-bold flex items-center justify-center gap-1" style={{ color: isEmailConfigured ? "var(--ok)" : "var(--warn)" }}>
            <Icon name={isEmailConfigured ? "check" : "alert"} size={12} /> {isEmailConfigured ? "Activo" : "Sin configurar"}
          </p>
          <p className="text-[12px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Correo (Resend)</p>
        </div>
      </div>

      {/* Panel maestro-detalle tipo Ajustes de Apple — categorías a la
          izquierda, contenido a la derecha, sin navegación real entre
          ellas. En mobile colapsa a una sola columna: lista de
          categorías primero, panel con botón "Volver" al seleccionar. */}
      <div className="grid md:grid-cols-[240px_1fr] gap-5 items-start">
        <nav className={`flex-col gap-4 ${selected ? "hidden md:flex" : "flex"}`}>
          {GROUPS.map((group) => (
            <div key={group}>
              <p className="text-[12px] font-bold mb-1.5 px-1" style={{ color: "var(--text-3)" }}>{group.toUpperCase()}</p>
              <div className="flex flex-col gap-0.5">
                {SECTIONS.filter((s) => s.group === group).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm text-left transition-colors"
                    style={selected === s.id
                      ? { background: "var(--accent-tint)", color: "var(--accent)" }
                      : { color: "var(--text-2)" }}
                  >
                    <Icon name={s.icon} size={16} />
                    <span className="text-[13px] font-semibold truncate flex-1">{s.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className={selected ? "block" : "hidden md:block"}>
          {active && (
            <div className="card p-4 mb-5 flex items-center gap-3">
              <button onClick={() => setSelected(null)} className="md:hidden w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--surface-2)" }} aria-label="Volver a categorías">
                <Icon name="chevron" size={14} style={{ transform: "rotate(180deg)" }} />
              </button>
              <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
                <Icon name={active.icon} size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold">{active.title}</p>
                <p className="text-[12px] truncate" style={{ color: "var(--text-2)" }}>{active.desc}</p>
              </div>
            </div>
          )}
          {renderSection()}
        </div>
      </div>

      <div className="flex flex-col gap-7 mt-9">
        {QUICK_LINKS.map((cat) => (
          <section key={cat.title}>
            <h2 className="text-[12px] font-bold mb-2.5" style={{ color: "var(--text-3)" }}>
              {cat.title}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {cat.items.map((it) => (
                <Link key={it.href} href={it.href} className="card card-hover p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0"
                    style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
                    <Icon name={it.icon} size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold">{it.title}</p>
                    <p className="text-[12.5px] mt-1" style={{ color: "var(--text-2)" }}>{it.desc}</p>
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
