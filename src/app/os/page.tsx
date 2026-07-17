"use client";
import { useState, type ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";
import { Shell, type ShellUser } from "@/components/os/shell";
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Input, Pill, SectionTitle, StatCard, cx,
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
      title={TITLES[active] ?? "Nexus"}
      actions={<Button variant="primary" size="sm" icon="plus">Nueva actividad</Button>}
    >
      {active === "hoy" ? <Today /> : <Soon label={TITLES[active] ?? active} />}
    </Shell>
  );
}

/* ─────────────── Hoy · Centro de Operaciones ─────────────── */
function Today() {
  return (
    <div className="space-y-6">
      {/* Saludo + jornada */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-text-1">Buenas tardes, Samu 👋</h2>
          <p className="text-[14px] text-text-3">Martes 7 de julio · 3 cosas necesitan tu atención hoy.</p>
        </div>
        <Card pad={false} className="p-3 flex items-center gap-3">
          <span className="grid place-items-center h-10 w-10 rounded-sm" style={{ background: "var(--ok-tint)", color: "var(--ok)" }}>
            <Icon name="clock" size={20} />
          </span>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <Badge tone="ok" dot>Trabajando</Badge>
              <span className="text-[13px] text-text-3">desde 9:02</span>
            </div>
          </div>
          <Button variant="subtle" size="sm">Registrar salida</Button>
        </Card>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Actividades activas" value="6" icon="layers" tone="accent" />
        <StatCard label="Por revisar" value="3" icon="inbox" tone="warn" />
        <StatCard label="Entregas hoy" value="2" icon="check" tone="ok" />
        <StatCard label="Vacaciones" value="12 d" icon="plane" tone="purple" />
      </div>

      {/* Dos columnas */}
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <Card>
          <SectionTitle hint="6 en total">Mis actividades</SectionTitle>
          <div className="space-y-1">
            <ActRow title="Video institucional — Ceremonia" tone="accent" state="En progreso" who="Jorge" color="#FF8A00" pct={60} />
            <ActRow title="Diseño de lonas — Admisiones" tone="warn" state="En revisión" who="Angélica" color="#FF3B30" pct={90} />
            <ActRow title="Cobertura — Torneo deportivo" tone="purple" state="Asignada" who="Citlaly" color="#0066FF" pct={15} />
          </div>
          <button className="mt-3 w-full h-9 rounded-sm text-[13px] font-semibold text-accent hover:bg-hover transition-colors">
            Ver todas las actividades →
          </button>
        </Card>

        <Card>
          <SectionTitle>Solicitudes por revisar</SectionTitle>
          <div className="space-y-1">
            <ReqRow title="Difusión — Semana cultural" who="Control Escolar" prio="Alta" />
            <ReqRow title="Video — Testimonios egresados" who="Admisiones" prio="Media" />
            <ReqRow title="Lona — Bienvenida" who="Dirección" prio="Baja" />
          </div>
          <button className="mt-3 w-full h-9 rounded-sm text-[13px] font-semibold text-accent hover:bg-hover transition-colors">
            Revisar bandeja →
          </button>
        </Card>
      </div>

      {/* Galería del sistema de diseño */}
      <Card>
        <SectionTitle hint="oscuro + claro">Sistema de diseño · Nexus OS</SectionTitle>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Row label="Botones">
              <Button variant="primary" size="sm" icon="plus">Primario</Button>
              <Button variant="subtle" size="sm">Sutil</Button>
              <Button variant="ghost" size="sm">Fantasma</Button>
              <Button variant="danger" size="sm">Peligro</Button>
            </Row>
            <Row label="Estados">
              <Badge tone="accent" dot>Activo</Badge>
              <Badge tone="ok" dot>Completado</Badge>
              <Badge tone="warn" dot>En revisión</Badge>
              <Badge tone="danger" dot>Vencido</Badge>
            </Row>
            <Row label="Filtros">
              <Pill active>Todas</Pill>
              <Pill>Video</Pill>
              <Pill>Diseño</Pill>
              <Pill>Cobertura</Pill>
            </Row>
            <Row label="Equipo">
              <Avatar name="Samu Chan" color="#5856D6" />
              <Avatar name="Jorge M" color="#FF8A00" />
              <Avatar name="Angélica R" color="#FF3B30" />
              <Avatar name="Citlaly V" color="#0066FF" />
            </Row>
          </div>
          <div className="space-y-4">
            <Field label="Campo de texto" hint="Prueba el foco (borde azul + halo).">
              <Input icon="search" placeholder="Buscar una actividad…" />
            </Field>
            <div className="rounded-m border border-border overflow-hidden">
              <EmptyState
                icon="sparkle" title="Estado vacío con propósito"
                hint="Cuando no hay datos, Nexus guía en vez de mostrar una tabla vacía."
                action={<Button variant="primary" size="sm" icon="plus">Crear la primera</Button>}
              />
            </div>
          </div>
        </div>
        <p className="mt-5 text-[12px] text-text-3 flex items-center gap-1 flex-wrap">
          Cambia entre <b className="text-text-2">oscuro y claro</b> con el botón <Icon name="moon" size={12} />/<Icon name="sun" size={12} /> de la barra superior, o abre el buscador con <b className="text-text-2">⌘K</b>.
        </p>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-text-3 mb-2">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function ActRow({ title, tone, state, who, color, pct }: {
  title: string; tone: "accent" | "warn" | "purple"; state: string; who: string; color: string; pct: number;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-sm hover:bg-hover transition-colors cursor-pointer">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-text-1 truncate">{title}</p>
        <div className="mt-1.5 h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
        </div>
      </div>
      <Badge tone={tone}>{state}</Badge>
      <Avatar name={who} color={color} size={28} />
    </div>
  );
}

function ReqRow({ title, who, prio }: { title: string; who: string; prio: string }) {
  const tone = prio === "Alta" ? "danger" : prio === "Media" ? "warn" : "neutral";
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-sm hover:bg-hover transition-colors cursor-pointer">
      <span className="grid place-items-center h-8 w-8 rounded-sm bg-surface-2 text-text-3"><Icon name="inbox" size={16} /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-text-1 truncate">{title}</p>
        <p className="text-[12px] text-text-3 truncate">{who}</p>
      </div>
      <Badge tone={tone as "danger" | "warn" | "neutral"}>{prio}</Badge>
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
