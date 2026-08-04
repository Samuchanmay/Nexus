"use client";
import { useState, type ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";
import { Shell, type ShellUser } from "@/components/os/shell";
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Input, SegmentPill, SectionTitle, StatCard, cx,
} from "@/components/os/ui";
import { Icon } from "@/components/os/icons";

const USER: ShellUser = { id: "demo", name: "Samu Chan", area: "Dirección", color: "#5856D6", roleLabel: "Administrador" };

const TITLES: Record<string, string> = {
  hoy: "Hoy", actividades: "Actividades", solicitudes: "Solicitudes", calendario: "Calendario",
  biblioteca: "Biblioteca", jornada: "Mi jornada", vacaciones: "Vacaciones", incidencias: "Incidencias",
  equipo: "Equipo", reportes: "Reportes", config: "Configuración",
};

export default function OsPreview() {
  return (
    <ThemeProvider>
      <Inner />
    </ThemeProvider>
  );
}

function Inner() {
  const [active, setActive] = useState("hoy");
  return (
    <Shell
      role="admin" user={USER} active={active} onNavigate={setActive}
      title={TITLES[active] ?? "EMET"}
      actions={<Button variant="primary" size="sm" icon="plus">Nueva actividad</Button>}
    >
      {active === "hoy" ? <Today /> : <Soon label={TITLES[active] ?? active} />}
    </Shell>
  );
}

/* ─────────────── Hoy · Centro de Operaciones ─────────────── */
function Today() {
  return (
    <div className="space-y-10">
      {/* Hero principal - Jornada actual */}
      <div className="space-y-6">
        <div>
          <h1 className="text-[48px] font-bold text-text-1 leading-none tracking-tight">
            ¿Cómo va el día?
          </h1>
        </div>

        {/* Tarjeta principal de jornada */}
        <div className="card p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-ok"></span>
                </span>
                <span className="text-[22px] font-semibold text-ok">Trabajando</span>
              </div>
              <div className="text-[64px] font-bold text-text-1 leading-none tabular-nums">
                3h 37min
              </div>
            </div>
          </div>

          {/* Barra de progreso gruesa */}
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-accent to-blue transition-all duration-1000 ease-out"
                style={{ width: '52%' }}
              />
            </div>
            <div className="flex items-center justify-between text-[13px] text-text-3">
              <span>Entrada 8:12</span>
              <span className="font-semibold text-text-2">52% del objetivo</span>
            </div>
          </div>

          {/* Info adicional */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-border">
            <div>
              <div className="text-[13px] text-text-3 mb-1">Salida estimada</div>
              <div className="text-[20px] font-semibold text-text-1">5:00 p.m.</div>
            </div>
            <div>
              <div className="text-[13px] text-text-3 mb-1">Tiempo restante</div>
              <div className="text-[20px] font-semibold text-text-1">4h 23min</div>
            </div>
            <div>
              <div className="text-[13px] text-text-3 mb-1">Descanso</div>
              <div className="text-[20px] font-semibold text-text-1">30 min</div>
            </div>
          </div>

          {/* Botón principal grande */}
          <button className="w-full h-12 rounded-xl bg-accent hover:bg-accent/90 text-white font-semibold text-[15px] shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-200 hover:-translate-y-0.5">
            Registrar salida
          </button>
        </div>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Actividades activas" value="6" icon="layers" color="var(--accent)" />
        <MetricCard label="Por revisar" value="3" icon="inbox" color="var(--warn)" />
        <MetricCard label="Entregas hoy" value="2" icon="check" color="var(--ok)" />
        <MetricCard label="Vacaciones" value="12 d" icon="plane" color="var(--purple)" />
      </div>

      {/* Dos columnas principales */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8">
        {/* Actividades */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[22px] font-bold text-text-1">Mis actividades</h2>
            <button className="text-[13px] font-semibold text-accent hover:text-accent/80 transition-colors">
              Ver todas →
            </button>
          </div>
          <div className="space-y-2">
            <ActivityRow title="Video institucional — Ceremonia" state="En progreso" who="Jorge" color="#FF8A00" pct={60} />
            <ActivityRow title="Diseño de lonas — Admisiones" state="En revisión" who="Angélica" color="#FF3B30" pct={90} />
            <ActivityRow title="Cobertura — Torneo deportivo" state="Asignada" who="Citlaly" color="#0066FF" pct={15} />
          </div>
        </div>

        {/* Solicitudes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[22px] font-bold text-text-1">Solicitudes</h2>
            <button className="text-[13px] font-semibold text-accent hover:text-accent/80 transition-colors">
              Ver bandeja →
            </button>
          </div>
          <div className="space-y-2">
            <RequestRow title="Difusión — Semana cultural" who="Control Escolar" prio="Alta" />
            <RequestRow title="Video — Testimonios egresados" who="Admisiones" prio="Media" />
            <RequestRow title="Lona — Bienvenida" who="Dirección" prio="Baja" />
          </div>
        </div>
      </div>

      {/* Equipo */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-bold text-text-1">Equipo</h2>
          <button className="h-9 px-4 rounded-lg border border-border text-[13px] font-semibold text-text-2 hover:bg-hover transition-colors">
            Ver asistencia
          </button>
        </div>

        {/* Chips de estado grandes */}
        <div className="flex flex-wrap gap-3">
          <StatusChip label="Presentes" count={8} color="var(--ok)" />
          <StatusChip label="Fuera" count={2} color="var(--warn)" />
          <StatusChip label="Terminaron" count={3} color="var(--text-3)" />
          <StatusChip label="Vacaciones" count={1} color="var(--purple)" />
        </div>

        {/* Lista del equipo espaciada */}
        <div className="space-y-1">
          <TeamMemberRow name="Jorge Martínez" role="Diseñador" status="Trabajando" statusColor="var(--ok)" color="#FF8A00" time="2h 15min" />
          <TeamMemberRow name="Angélica Ramírez" role="Diseñadora" status="En revisión" statusColor="var(--warn)" color="#FF3B30" time="3h 42min" />
          <TeamMemberRow name="Citlaly Vega" role="Fotógrafa" status="En evento" statusColor="var(--accent)" color="#0066FF" time="1h 08min" />
          <TeamMemberRow name="Samu Chan" role="Director" status="Trabajando" statusColor="var(--ok)" color="#5856D6" time="3h 37min" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="card p-6 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <span 
          className="grid place-items-center h-10 w-10 rounded-lg"
          style={{ background: `${color}15`, color }}
        >
          <Icon name={icon} size={20} />
        </span>
      </div>
      <div className="text-[32px] font-bold text-text-1 leading-none tabular-nums">{value}</div>
      <div className="text-[13px] text-text-3 mt-2">{label}</div>
    </div>
  );
}

function ActivityRow({ title, state, who, color, pct }: {
  title: string; state: string; who: string; color: string; pct: number;
}) {
  return (
    <div className="group flex items-center gap-4 p-4 rounded-xl hover:bg-hover transition-all duration-200 cursor-pointer">
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[15px] font-semibold text-text-1 truncate group-hover:text-accent transition-colors">{title}</p>
        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
      <span className="text-[13px] font-semibold px-3 py-1 rounded-full" style={{ background: `${color}15`, color }}>
        {state}
      </span>
      <Avatar name={who} color={color} size={32} />
    </div>
  );
}

function RequestRow({ title, who, prio }: { title: string; who: string; prio: string }) {
  const color = prio === "Alta" ? "var(--danger)" : prio === "Media" ? "var(--warn)" : "var(--text-3)";
  return (
    <div className="group flex items-center gap-4 p-4 rounded-xl hover:bg-hover transition-all duration-200 cursor-pointer">
      <span 
        className="grid place-items-center h-10 w-10 rounded-lg shrink-0"
        style={{ background: `${color}15`, color }}
      >
        <Icon name="inbox" size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-text-1 truncate group-hover:text-accent transition-colors">{title}</p>
        <p className="text-[13px] text-text-3 truncate mt-0.5">{who}</p>
      </div>
      <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${color}15`, color }}>
        {prio}
      </span>
    </div>
  );
}

function StatusChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div 
      className="flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-200 hover:scale-105 cursor-pointer"
      style={{ background: `${color}15`, border: `1.5px solid ${color}30` }}
    >
      <span className="text-[20px] font-bold tabular-nums" style={{ color }}>{count}</span>
      <span className="text-[13px] font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

function TeamMemberRow({ name, role, status, statusColor, color, time }: {
  name: string; role: string; status: string; statusColor: string; color: string; time: string;
}) {
  return (
    <div className="group flex items-center gap-4 p-4 rounded-xl hover:bg-hover transition-all duration-200 cursor-pointer">
      <Avatar name={name} color={color} size={48} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-text-1 truncate">{name}</p>
        <p className="text-[13px] text-text-3 truncate">{role}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: statusColor }}></span>
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: statusColor }}></span>
        </span>
        <span className="text-[13px] font-semibold" style={{ color: statusColor }}>{status}</span>
      </div>
      <div className="text-[13px] font-semibold text-text-2 tabular-nums w-20 text-right">{time}</div>
    </div>
  );
}

function Soon({ label }: { label: string }) {
  return (
    <Card className="mt-2">
      <EmptyState
        icon="sparkle"
        title={`${label} llega pronto`}
        hint="Esta sección se construye en la siguiente rebanada. La navegación, el tema y el buscador ya funcionan."
        action={<Badge tone="accent" dot>En construcción</Badge>}
      />
    </Card>
  );
}
