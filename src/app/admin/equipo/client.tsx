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
  specialties: string[];
  tasks: { title: string; type: RequestType | null; typeLabel: string | null; priority: Priority; status: string; is_lead: boolean }[];
  today: {
    firstIn: string | null; totalMin: number; targetMin: number; isOpen: boolean; movesCount: number;
    stateName: string | null; stateColor: string | null;
  };
  upcomingVacs: { start_date: string; end_date: string; status: string }[];
  pendingIncs: { kind: Incident["kind"]; start_date: string; end_date: string; status: Incident["status"] }[];
}

export default function EquipoClient({ members }: { members: TeamMember[] }) {
  const [sel, setSel] = useState<TeamMember | null>(null);
  const max = Math.max(1, ...members.map((u) => u.tasks.length));

  return (
    <>
      <PageHeader
        title="Carga del equipo"
        subtitle="Tareas activas por persona — clic en alguien para ver su detalle"
      />

      <div className="grid md:grid-cols-2 gap-4">
        {members.map((u) => (
          <button key={u.id} onClick={() => setSel(u)}
            className="card card-hover p-5 text-left w-full cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={u.display_name} color={u.nexus_color} size={38} />
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold">{u.display_name}</p>
                <p className="text-[11.5px] truncate" style={{ color: "var(--text-3)" }}>
                  {u.specialties.map((sp) => SPECIALTY_LABELS[sp] ?? sp).join(" · ") || u.area}
                </p>
              </div>
              <p className="text-[21px] font-bold tabular-nums"
                style={{ color: u.tasks.length >= max && max > 1 ? "var(--warn)" : "var(--ok)" }}>
                {u.tasks.length}
              </p>
            </div>
            <div className="h-[7px] rounded-full mb-3 overflow-hidden" style={{ background: "var(--surface-3)" }}>
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${(u.tasks.length / max) * 100}%`,
                  background: u.tasks.length >= max && max > 1
                    ? "linear-gradient(90deg,#FF9F0A,#FF8A00)"
                    : "linear-gradient(90deg,#34D058,#2FB344)",
                }} />
            </div>
            {u.tasks.length === 0
              ? <p className="text-[12.5px]" style={{ color: "var(--text-3)" }}>Disponible</p>
              : (
                <div className="flex flex-col gap-1.5">
                  {u.tasks.slice(0, 3).map((t, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="truncate">{t.title}</span>
                      <Pill tone="accent">{t.typeLabel ?? "—"}</Pill>
                    </div>
                  ))}
                  {u.tasks.length > 3 && (
                    <p className="text-[11.5px] font-semibold" style={{ color: "var(--accent)" }}>
                      +{u.tasks.length - 3} más →
                    </p>
                  )}
                </div>
              )}
          </button>
        ))}
      </div>

      {/* ── L4 · Panel contextual ── */}
      <Sheet open={!!sel} onClose={() => setSel(null)}
        title={sel?.full_name ?? ""} subtitle={sel?.area ?? undefined}>
        {sel && (
          <div className="px-5 pt-4 flex flex-col gap-5">
            {/* Jornada de hoy */}
            <section>
              <h3 className="text-[13px] font-bold uppercase tracking-wide mb-2.5 flex items-center justify-between" style={{ color: "var(--text-3)" }}>
                <span>Hoy</span>
                <span className="normal-case font-semibold text-[11.5px]" style={{ color: "var(--text-2)" }}>
                  {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                </span>
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { v: fmtTime(sel.today.firstIn), l: "ENTRADA" },
                  { v: sel.today.firstIn ? fmtMin(sel.today.totalMin) : "—", l: "LABORADO" },
                  { v: fmtMin(sel.today.targetMin), l: "OBJETIVO" },
                ].map((c) => (
                  <div key={c.l} className="rounded-sm py-3" style={{ background: "var(--surface-2)" }}>
                    <p className="text-[15px] font-bold tabular-nums">{c.v}</p>
                    <p className="text-[9.5px] font-semibold" style={{ color: "var(--text-3)" }}>{c.l}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11.5px] mt-2 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
                {sel.today.stateColor && <span className="w-1.5 h-1.5 rounded-full" style={{ background: sel.today.stateColor }} />}
                {sel.today.movesCount === 0 ? "Sin fichajes hoy"
                  : sel.today.stateName ? `${sel.today.movesCount} fichaje${sel.today.movesCount > 1 ? "s" : ""} · ${sel.today.stateName}`
                  : `${sel.today.movesCount} fichaje${sel.today.movesCount > 1 ? "s" : ""} · jornada cerrada`}
              </p>
            </section>

            {/* Tareas activas */}
            <section>
              <h3 className="text-[13px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-3)" }}>
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
                          <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
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
              <h3 className="text-[13px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-3)" }}>
                Vacaciones próximas
              </h3>
              {sel.upcomingVacs.length === 0
                ? <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin vacaciones programadas</p>
                : (
                  <div className="flex flex-col gap-1.5">
                    {sel.upcomingVacs.map((v, i) => (
                      <div key={i} className="flex items-center justify-between text-[13px]">
                        <span className="tabular-nums">{v.start_date} → {v.end_date}</span>
                        <Pill tone={v.status === "Aprobada" ? "ok" : "warn"}>{v.status}</Pill>
                      </div>
                    ))}
                  </div>
                )}
            </section>

            {/* Incidencias pendientes */}
            {sel.pendingIncs.length > 0 && (
              <section>
                <h3 className="text-[13px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-3)" }}>
                  Incidencias pendientes
                </h3>
                <div className="flex flex-col gap-1.5">
                  {sel.pendingIncs.map((inc, i) => (
                    <div key={i} className="flex items-center justify-between text-[13px]">
                      <span>{KIND_LABELS[inc.kind]} · <span className="tabular-nums">{inc.start_date}{inc.end_date !== inc.start_date ? ` → ${inc.end_date}` : ""}</span></span>
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
