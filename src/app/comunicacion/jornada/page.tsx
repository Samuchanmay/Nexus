import { createClient } from "@/lib/supabase/server";
import { summarizeDay, fmtMin, fmtTime, scheduleFor } from "@/lib/hours";
import { getAttendanceStatus, type IncidentKind, type ResolveInput } from "@/lib/domain/attendance/status";
import type { JornadaState } from "@/lib/hours";
import type { AttendanceRow, Schedule } from "@/lib/types";
import { Pill } from "@/components/ui";
import { todayMerida, addDays } from "@/lib/tz";
import { syncPendingExits, getPendingExitsMap, exitPillFor } from "@/lib/pending-exits";
import { ResolvePendingExit } from "@/components/os/resolve-pending-exit";
import { RequestAttendanceCorrection } from "@/components/os/request-attendance-correction";
import { LiveJornadaHero } from "@/components/shared/live-jornada-hero";
import { AutoRefresh } from "@/components/shared/auto-refresh";
import { DomainTabs } from "@/components/os/domain-tabs";

// La corrección la aplica el admin y esta página la sirve el server —
// nunca cachear para que el historial refleje siempre el último dato.
export const dynamic = "force-dynamic";

/** Motivos administrativos que explican una ausencia real (lo que prioriza el
    resolver antes de "Sin iniciar"/falta) — se usan para el badge del historial. */
const REASON_KEYS = new Set<string>([
  "vacaciones", "incapacidad", "permiso", "comision", "home_office",
  "falta_justificada", "dia_inhabil", "descanso", "evento_externo",
]);

export default async function Jornada() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("id, display_name, role").eq("auth_id", user!.id).single();
  // Esta ruta la sirven tanto empleado como admin (ComunicacionLayout es
  // superset) — DomainTabs necesita el rol real para saber si también debe
  // ofrecer Asistencia/Días inhábiles (solo admin).
  const role = profile!.role === "admin" ? "admin" : "empleado";

  const since = addDays(todayMerida(), -30);
  const [{ data: att }, { data: sched }, { data: hols }, { data: jornadaStates }, { data: myVacs }, { data: myIncs }, { data: myRests }] = await Promise.all([
    supabase.from("attendance").select("*").eq("user_id", profile!.id)
      .gte("date", since).order("date", { ascending: false }).order("time"),
    supabase.from("schedules").select("*").eq("user_id", profile!.id),
    supabase.from("holidays").select("date"),
    supabase.from("jornada_states").select("*").eq("activo", true),
    // Motivos reales (vacaciones/incidencia/descanso aprobados o autorizados)
    // que caen en la ventana — para que nunca se muestre "Sin iniciar" cuando
    // existe una razón conocida (mismo resolver que el resto de EMET).
    supabase.from("vacations").select("start_date, end_date")
      .eq("user_id", profile!.id).eq("status", "Aprobada").is("archived_at", null)
      .lte("start_date", todayMerida()).gte("end_date", since),
    supabase.from("incidents").select("kind, note, start_date, end_date")
      .eq("user_id", profile!.id).eq("status", "Autorizado").is("archived_at", null)
      .lte("start_date", todayMerida()).gte("end_date", since),
    supabase.from("rest_days").select("note, start_date, end_date")
      .eq("user_id", profile!.id).lte("start_date", todayMerida()).gte("end_date", since),
  ]);
  const states = (jornadaStates ?? []) as JornadaState[];

  const scheds = (sched ?? []) as Schedule[];
  const holidaySet = new Set((hols ?? []).map((h) => h.date as string));
  const myVacsRows = (myVacs ?? []) as { start_date: string; end_date: string }[];
  const myIncsRows = (myIncs ?? []) as { kind: IncidentKind; note: string | null; start_date: string; end_date: string }[];
  const myRestsRows = (myRests ?? []) as { note: string | null; start_date: string; end_date: string }[];
  const rows = (att ?? []) as AttendanceRow[];
  const dates = [...new Set(rows.map((r) => r.date))];
  const days = dates.map((d) => summarizeDay(
    d, rows, scheduleFor(scheds, profile!.id, d) ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" }, states,
  ));
  const totalMin = days.reduce((s, d) => s + d.totalMin, 0);
  const totalExtra = days.reduce((s, d) => s + d.extraMin, 0);

  /** Motivos administrativos vigentes en `date` — mismas prioridades que el
      resolver central: una razón conocida nunca deja que caiga a "Sin iniciar". */
  const reasonInputsFor = (date: string): Pick<ResolveInput, "vacation" | "incident" | "isHoliday" | "restDay"> => {
    const vac = myVacsRows.find((v) => v.start_date <= date && v.end_date >= date) ?? null;
    const inc = myIncsRows.find((i) => i.start_date <= date && i.end_date >= date) ?? null;
    const rd = myRestsRows.find((r) => r.start_date <= date && r.end_date >= date) ?? null;
    return {
      vacation: vac ? { start: vac.start_date, end: vac.end_date } : null,
      incident: inc ? { kind: inc.kind, note: inc.note } : null,
      isHoliday: holidaySet.has(date),
      restDay: rd ? { note: rd.note } : null,
    };
  };

  // Días pasados que quedaron abiertos: nunca se muestran directamente como
  // "No registró salida" — se dan de alta en pending_exits (si no existían
  // ya) y se leen desde ahí para saber si siguen 'pendiente' o si RH ya los
  // marcó como definitivos ('no_registro') o la persona los resolvió.
  await syncPendingExits(supabase, profile!.id, days);
  const pendingExitsMap = await getPendingExitsMap(supabase, profile!.id, days.filter((d) => d.noRegistroSalida).map((d) => d.date));

  // ── Hoy — indicador grande (Plano de refinamiento Fase 2): el número de
  // hoy es lo primero que se debe leer, no un dato más perdido en la lista.
  const todayIso = todayMerida();
  const todaySchedule = scheduleFor(scheds, profile!.id, todayIso) ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" };
  const todayEntry = days.find((d) => d.date === todayIso);
  const todayTotalMin = todayEntry?.totalMin ?? 0;
  const todayTargetMin = todayEntry?.targetMin ?? todaySchedule.target_min;
  const todayPresence = getAttendanceStatus({
    date: todayIso, today: todayIso, firstIn: todayEntry?.firstIn ?? null, isOpen: todayEntry?.isOpen ?? false,
    noRegistroSalida: false, liveStateName: null, liveStateColor: null,
    ...reasonInputsFor(todayIso), isBusinessDay: true,
  });
  const todayStatus = todayPresence.label;
  const todayStatusColor = !todayEntry ? "var(--text-3)"
    : todayEntry.isOpen ? "var(--ok)" : todayEntry.metTarget ? "var(--ok)" : "var(--warn)";

  return (
    <>
      <AutoRefresh />
      <DomainTabs domain="tiempo" role={role} />
      
      {/* Header compacto */}
      <header className="pt-6 pb-5">
        <h1 className="text-[28px] font-bold tracking-tight text-text-1 leading-none">Mi jornada</h1>
        <p className="text-[15px] mt-2" style={{ color: "var(--text-2)" }}>Últimos 30 días</p>
      </header>

      {/* Hero con métrica protagonista */}
      <div className="mb-8">
        <LiveJornadaHero
          firstIn={todayEntry?.firstIn ?? null} totalMin={todayTotalMin} targetMin={todayTargetMin}
          openSegmentStartsAt={todayEntry?.openSegmentStartsAt ?? null}
          statusLabel={todayStatus} dotColor={todayStatusColor} showEntrada={false}
        />
      </div>

      {/* KPIs secundarios reordenados */}
      <div className="flex items-center gap-8 mb-8 pb-8" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <p className="text-[24px] font-bold tabular-nums text-text-1">{fmtMin(totalMin)}</p>
          <p className="text-[13.5px]" style={{ color: "var(--text-3)" }}>Total laborado</p>
        </div>
        <div>
          <p className="text-[24px] font-bold tabular-nums" style={{ color: totalExtra > 0 ? "var(--ok)" : "var(--text-1)" }}>
            {totalExtra > 0 ? `+${fmtMin(totalExtra)}` : "—"}
          </p>
          <p className="text-[13.5px]" style={{ color: "var(--text-3)" }}>Tiempo extra</p>
        </div>
        <div>
          <p className="text-[24px] font-bold tabular-nums text-text-1">{days.length}</p>
          <p className="text-[13.5px]" style={{ color: "var(--text-3)" }}>Días registrados</p>
        </div>
      </div>

      {/* Estado vacío */}
      {days.length === 0 && (
        <div className="text-center py-16">
          <div 
            className="w-16 h-16 rounded-2xl grid place-items-center mb-4 mx-auto"
            style={{ background: "var(--surface-2)" }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-3)" }}>
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <h2 className="text-[19px] font-semibold text-text-1 mb-1">Aún sin registros</h2>
          <p className="text-[14px] text-text-3 max-w-[360px] mx-auto">
            Tus fichajes de los últimos 30 días aparecerán aquí
          </p>
        </div>
      )}

      {/* Historial diario mejorado */}
      <div>
        <h2 className="text-[19px] font-bold text-text-1 mb-4">Historial</h2>
        <div className="flex flex-col gap-2">
          {days.map((d) => {
            const dateObj = new Date(d.date + "T00:00:00");
            const isHoliday = holidaySet.has(d.date);
            const label = dateObj.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });

            // Motivo real del día (Vacaciones/Permiso/Incapacidad/Día inhábil/
            // Descanso) vía el resolver central — un día sin fichar pero con
            // razón conocida nunca debe quedar como "Sin registros".
            const dayReason = (() => {
              const wd = dateObj.getDay();
              const s = getAttendanceStatus({
                date: d.date, today: todayIso, firstIn: d.firstIn, isOpen: d.isOpen, noRegistroSalida: d.noRegistroSalida,
                liveStateName: null, liveStateColor: null,
                ...reasonInputsFor(d.date), isBusinessDay: wd !== 0 && wd !== 6,
              });
              return REASON_KEYS.has(s.key) ? s : null;
            })();
            
            // Color según cumplimiento
            const dayColor = dayReason ? dayReason.color
              : isHoliday ? "var(--accent)" 
              : d.noRegistroSalida ? "var(--danger)"
              : d.isOpen ? "var(--ok)"
              : d.metTarget ? "var(--ok)" 
              : "var(--warn)";
            
            return (
              <details key={d.date} className="group rounded-2xl overflow-hidden transition-all duration-200" style={{ background: "var(--surface)" }}>
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none hover:bg-hover transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Indicador de color */}
                    <div className="w-1 h-10 rounded-full" style={{ background: dayColor }} />
                    
                    <div>
                      <p className="text-[14px] font-semibold capitalize text-text-1">{label}</p>
                      <p className="text-[13.5px] tabular-nums mt-0.5" style={{ color: "var(--text-2)" }}>
                        {d.firstIn ? `${fmtTime(d.firstIn)} → ${fmtTime(d.lastOut)}` : "Sin registros"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Porcentaje si hay datos */}
                    {d.firstIn && d.targetMin > 0 && (
                      <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: dayColor }}>
                        {Math.round((d.totalMin / d.targetMin) * 100)}%
                      </span>
                    )}
                    
                    {/* Badge de estado — motivo real (vacaciones/permiso/etc.)
                        antes que el matiz de cumplimiento */}
                    {dayReason
                      ? <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: dayReason.badgeVariant === "muted" ? "var(--surface-2)" : `var(--${dayReason.badgeVariant}-tint)`, color: dayReason.color }}>{dayReason.label}</span>
                      : isHoliday
                      ? <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>Inhábil</span>
                      : d.noRegistroSalida 
                        ? <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>Pendiente</span>
                        : d.isOpen 
                          ? <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--ok-tint)", color: "var(--ok)" }}>Trabajando</span>
                          : <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full tabular-nums" style={{ background: d.metTarget ? "var(--ok-tint)" : "var(--warn-tint)", color: dayColor }}>{fmtMin(d.totalMin)}</span>}
                  </div>
                </summary>
                
                {/* Detalles expandibles */}
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  {/* Movimientos del día */}
                  <div className="px-5 py-3">
                    <div className="flex flex-col gap-2">
                      {d.movements.map((m, i) => (
                        <div key={m.id} className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--text-3)" }} />
                            <span className="text-[13.5px] text-text-2">{m.reason}</span>
                          </div>
                          <span className="text-[13.5px] font-semibold tabular-nums text-text-1">{fmtTime(m.time)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Total del día */}
                  <div className="flex justify-between items-center px-5 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
                    <span className="text-[13.5px] font-semibold" style={{ color: "var(--text-2)" }}>Total trabajado</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold tabular-nums text-text-1">{fmtMin(d.totalMin)}</span>
                      {d.extraMin > 0 && (
                        <span className="text-[12px] font-semibold tabular-nums px-2 py-0.5 rounded-full" style={{ background: "var(--ok-tint)", color: "var(--ok)" }}>
                          +{fmtMin(d.extraMin)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Resolver pendiente si aplica */}
                  {d.noRegistroSalida && pendingExitsMap.get(d.date)?.status !== "no_registro" && (
                    <div className="px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
                      <ResolvePendingExit userId={profile!.id} date={d.date} />
                    </div>
                  )}

                  {/* Pedir corrección — gap de producto cerrado a pedido del
                      usuario: antes no había forma de avisar un error de
                      asistencia dentro de EMET, solo hablando con un admin
                      fuera del sistema. */}
                  <div className="px-5 py-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <RequestAttendanceCorrection userId={profile!.id} userName={profile!.display_name} date={d.date} />
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </>
  );
}
