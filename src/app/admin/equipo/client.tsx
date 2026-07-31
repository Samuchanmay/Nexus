"use client";
// ═══════════════════════════════════════════════════════════════
//  L4 · Carga del equipo con panel contextual (legado cert_nexus)
//  Clic en una persona → Sheet deslizante con su detalle completo
//  (jornada de hoy, tareas activas, vacaciones próximas, incidencias)
//  sin salir de la vista.
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { Avatar, Pill, Sheet } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import { PageHeader } from "@/components/shared";
import { PRIORITY_TONE, KIND_LABELS, INCIDENT_TONE } from "@/lib/ui-maps";
import { fmtMin, fmtTime } from "@/lib/hours";
import { dmy } from "@/lib/tz";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { getAttendanceStatus } from "@/lib/domain/attendance/status";
import { DomainTabs } from "@/components/os/domain-tabs";
import type { Priority, RequestType, Incident } from "@/lib/types";

const SPECIALTY_LABELS: Record<string, string> = {
  video: "Video", fotografia: "Fotografía", diseno: "Diseño", difusion: "Difusión", redaccion: "Redacción",
};

export interface TeamMember {
  id: string;
  display_name: string;
  full_name: string;
  area: string | null;
  nexus_color: string | null;
  avatar_url?: string | null;
  birth_date?: string | null;
  specialties: string[];
  tasks: { title: string; type: RequestType | null; typeLabel: string | null; priority: Priority; status: string; is_lead: boolean }[];
  today: {
    firstIn: string | null; totalMin: number; targetMin: number; isOpen: boolean; movesCount: number;
    stateName: string | null; stateColor: string | null; noRegistroSalida: boolean;
  };
  upcomingVacs: { start_date: string; end_date: string; status: string }[];
  pendingIncs: { kind: Incident["kind"]; start_date: string; end_date: string; status: Incident["status"] }[];
}

// Carga expresada como sensación, no como número suelto — entendible sin
// tener que comparar contra el resto del equipo. Escala fija (no relativa
// al máximo del equipo): 0 = Disponible, 1 = Normal, 2 = Alta, 3+ = Saturado.
const loadLabel = (n: number) => n === 0 ? "Disponible" : n === 1 ? "Normal" : n === 2 ? "Alta" : "Saturado";
const loadColor = (n: number) => n === 0 ? "var(--text-3)" : n === 1 ? "var(--ok)" : n === 2 ? "var(--warn)" : "var(--danger)";
const loadPct = (n: number) => Math.min(100, Math.max(6, (n / 3) * 100));

/** Estado de vacación (hoy o por iniciar en los próximos 3 días) a partir de
    upcomingVacs — misma ventana/criterio que Hoy admin y Asistencia, para
    que el punto del Avatar coincida en toda la plataforma. Solo Aprobada:
    una Pendiente todavía puede no pasar. */
function vacationStatus(vacs: TeamMember["upcomingVacs"], today: string): { today: boolean; soonDays: number | null } {
  const aprobadas = vacs.filter((v) => v.status === "Aprobada");
  if (aprobadas.some((v) => v.start_date <= today && v.end_date >= today)) return { today: true, soonDays: null };
  const soon = aprobadas
    .map((v) => Math.round((new Date(v.start_date + "T12:00:00Z").getTime() - new Date(today + "T12:00:00Z").getTime()) / 86400000))
    .filter((d) => d >= 0 && d <= 3)
    .sort((a, b) => a - b)[0];
  return { today: false, soonDays: soon ?? null };
}
function soonLabel(days: number): string {
  return days === 0 ? "Vacaciones hoy" : `Vacaciones en ${days} día${days === 1 ? "" : "s"}`;
}

export default function EquipoClient({ members, today }: { members: TeamMember[]; today: string }) {
  const [sel, setSel] = useState<TeamMember | null>(null);

  return (
    <>
      <DomainTabs domain="personas" role="admin" />
      <PageHeader
        title="Carga del equipo"
        subtitle="Tareas activas por persona — clic en alguien para ver su detalle"
      />

      {/* Filas horizontales — carga de cada persona de un vistazo, sin tener que abrir tarjeta por tarjeta */}
      <div className="flex flex-col gap-2">
        {members.map((u) => {
          const vac = vacationStatus(u.upcomingVacs, today);
          return (
            <button key={u.id} onClick={() => setSel(u)}
              className="card card-hover w-full text-left cursor-pointer flex items-center gap-4 px-5 py-3.5 flex-wrap md:flex-nowrap">
              {/* Persona */}
              <div className="flex items-center gap-3 w-full md:w-[210px] shrink-0">
                {(() => {
                  const presence = getAttendanceStatus({
                    date: today, today, firstIn: u.today.firstIn, isOpen: u.today.isOpen, noRegistroSalida: u.today.noRegistroSalida,
                    liveStateName: u.today.stateName, liveStateColor: u.today.stateColor,
                    vacation: vac.today ? { start: today, end: today } : null, isBusinessDay: true,
                  });
                  const showSoon = vac.soonDays != null && !vac.today;
                  return (
                    <Avatar name={u.display_name} color={u.nexus_color} size={36} avatarUrl={u.avatar_url}
                      birthday={isBirthdayToday(u.birth_date, todayISO())}
                      status={showSoon ? "var(--purple)" : presence.color}
                      statusLabel={showSoon ? soonLabel(vac.soonDays as number) : presence.label} />
                  );
                })()}
                <div className="min-w-0">
                  <p className="text-[14px] font-bold truncate">{u.display_name}</p>
                  <p className="text-[12px] truncate" style={{ color: "var(--text-3)" }}>
                    {u.specialties.map((sp) => SPECIALTY_LABELS[sp] ?? sp).join(" · ") || u.area}
                  </p>
                </div>
              </div>

              {/* Carga — barra + sensación (Disponible/Normal/Alta/Saturado), se lee sin comparar contra nadie más */}
              <div className="flex-1 min-w-[140px] flex items-center gap-2.5">
                <div className="flex-1 h-[7px] rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${loadPct(u.tasks.length)}%`, background: loadColor(u.tasks.length) }} />
                </div>
                <span className="text-[12px] font-bold shrink-0 w-[68px]" style={{ color: loadColor(u.tasks.length) }}>
                  {loadLabel(u.tasks.length)}
                </span>
              </div>

              {/* Tareas activas — chips en línea (solo si hay algo que mostrar) */}
              {u.tasks.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto nx-scroll w-full md:w-auto md:max-w-[280px] shrink-0">
                  {u.tasks.slice(0, 2).map((t, i) => (
                    <span key={i} className="shrink-0 text-[12px] truncate max-w-[140px]" title={t.title}>
                      <Pill tone="muted">{t.typeLabel ?? t.title}</Pill>
                    </span>
                  ))}
                  {u.tasks.length > 2 && (
                    <span className="text-[12px] font-semibold shrink-0" style={{ color: "var(--accent)" }}>
                      +{u.tasks.length - 2} más
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── L4 · Panel contextual ── */}
      <Sheet open={!!sel} onClose={() => setSel(null)}
        title={sel?.full_name ?? ""} subtitle={sel?.area ?? undefined}>
        {sel && (
          <div className="px-5 pt-4 flex flex-col gap-5">
            {/* Jornada de hoy — indicador grande (mismo lenguaje que Mi jornada),
                en vez de tres cajitas de igual peso (Entrada/Laborado/Objetivo). */}
            <section>
              {(() => {
                const vac = vacationStatus(sel.upcomingVacs, today);
                const presence = getAttendanceStatus({
                  date: today, today, firstIn: sel.today.firstIn, isOpen: sel.today.isOpen, noRegistroSalida: sel.today.noRegistroSalida,
                  liveStateName: sel.today.stateName, liveStateColor: sel.today.stateColor,
                  vacation: vac.today ? { start: today, end: today } : null, isBusinessDay: true,
                });
                if (vac.today) {
                  const current = sel.upcomingVacs.find((v) => v.status === "Aprobada" && v.start_date <= today && v.end_date >= today);
                  return (
                    <div className="flex items-center gap-3 rounded-m px-4 py-3.5" style={{ background: "var(--purple-tint)" }}>
                      <Icon name="plane" size={20} style={{ color: "var(--purple)" }} />
                      <div>
                        <p className="text-[14px] font-bold" style={{ color: "var(--purple)" }}>Vacaciones</p>
                        {current && <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{dmy(current.start_date)} → {dmy(current.end_date)}</p>}
                      </div>
                    </div>
                  );
                }
                const pct = sel.today.targetMin > 0 ? Math.min(100, Math.round((sel.today.totalMin / sel.today.targetMin) * 100)) : 0;
                return (
                  <>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: presence.color }} />
                        <span className="text-[13px] font-bold" style={{ color: "var(--text-2)" }}>Hoy · {presence.label}</span>
                      </div>
                      <span className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>
                        {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                      </span>
                    </div>
                    <p className="text-[30px] font-bold tabular-nums leading-none">
                      {sel.today.noRegistroSalida ? "—" : sel.today.firstIn ? fmtMin(sel.today.totalMin) : "—"}
                    </p>
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--ok)" : "var(--accent)" }} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>
                          {sel.today.firstIn ? `Entrada ${fmtTime(sel.today.firstIn)}` : "Objetivo diario"}
                        </span>
                        <span className="text-[12px] font-bold tabular-nums" style={{ color: "var(--text-3)" }}>{fmtMin(sel.today.targetMin)}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </section>

            {/* Tareas activas */}
            <section>
              <h3 className="text-[13px] font-bold mb-2.5" style={{ color: "var(--text-3)" }}>
                Tareas activas ({sel.tasks.length})
              </h3>
              {sel.tasks.length === 0
                ? <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin tareas activas — disponible para asignar</p>
                : (
                  <div className="flex flex-col gap-2">
                    {sel.tasks.map((t, i) => (
                      <div key={i} className="rounded-sm px-3.5 py-2.5 flex items-center gap-2"
                        style={{ background: "var(--surface-2)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate flex items-center gap-1">
                            {t.is_lead && <Icon name="star" size={12} style={{ color: "var(--warn)" }} />}
                            {t.title}
                          </p>
                          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
                            {t.typeLabel ?? "—"} · {t.status.replace("_", " ")}
                          </p>
                        </div>
                        {t.priority !== "normal" && (
                          <Pill tone={PRIORITY_TONE[t.priority]}>{t.priority}</Pill>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </section>

            {/* Vacaciones próximas */}
            <section>
              <h3 className="text-[13px] font-bold mb-2.5" style={{ color: "var(--text-3)" }}>
                Vacaciones próximas
              </h3>
              {sel.upcomingVacs.length === 0
                ? <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin vacaciones programadas</p>
                : (
                  <div className="flex flex-col gap-1.5">
                    {sel.upcomingVacs.map((v, i) => (
                      <div key={i} className="flex items-center justify-between text-[13px]">
                        <span className="tabular-nums">{dmy(v.start_date)} → {dmy(v.end_date)}</span>
                        <Pill tone={v.status === "Aprobada" ? "ok" : "warn"}>{v.status}</Pill>
                      </div>
                    ))}
                  </div>
                )}
            </section>

            {/* Incidencias pendientes */}
            {sel.pendingIncs.length > 0 && (
              <section>
                <h3 className="text-[13px] font-bold mb-2.5" style={{ color: "var(--text-3)" }}>
                  Incidencias pendientes
                </h3>
                <div className="flex flex-col gap-1.5">
                  {sel.pendingIncs.map((inc, i) => (
                    <div key={i} className="flex items-center justify-between text-[13px]">
                      <span>{KIND_LABELS[inc.kind]} · <span className="tabular-nums">{dmy(inc.start_date)}{inc.end_date !== inc.start_date ? ` → ${dmy(inc.end_date)}` : ""}</span></span>
                      <Pill tone={INCIDENT_TONE[inc.status]}>{inc.status}</Pill>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
