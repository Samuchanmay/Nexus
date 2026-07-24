import { createClient } from "@/lib/supabase/server";
import { summarizeDay, fmtMin, fmtTime, scheduleFor } from "@/lib/hours";
import { resolvePresence } from "@/lib/status";
import type { JornadaState } from "@/lib/hours";
import type { AttendanceRow, Schedule } from "@/lib/types";
import { Pill } from "@/components/ui";
import { todayMerida, addDays } from "@/lib/tz";

export default async function Jornada() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("id, display_name").eq("auth_id", user!.id).single();

  const since = addDays(todayMerida(), -30);
  const [{ data: att }, { data: sched }, { data: hols }, { data: jornadaStates }] = await Promise.all([
    supabase.from("attendance").select("*").eq("user_id", profile!.id)
      .gte("date", since).order("date", { ascending: false }).order("time"),
    supabase.from("schedules").select("*").eq("user_id", profile!.id),
    supabase.from("holidays").select("date"),
    supabase.from("jornada_states").select("*").eq("activo", true),
  ]);
  const states = (jornadaStates ?? []) as JornadaState[];

  const scheds = (sched ?? []) as Schedule[];
  const holidaySet = new Set((hols ?? []).map((h) => h.date as string));
  const rows = (att ?? []) as AttendanceRow[];
  const dates = [...new Set(rows.map((r) => r.date))];
  const days = dates.map((d) => summarizeDay(
    d, rows, scheduleFor(scheds, profile!.id, d) ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" }, states,
  ));
  const totalMin = days.reduce((s, d) => s + d.totalMin, 0);
  const totalExtra = days.reduce((s, d) => s + d.extraMin, 0);

  // ── Hoy — indicador grande (Plano de refinamiento Fase 2): el número de
  // hoy es lo primero que se debe leer, no un dato más perdido en la lista.
  const todayIso = todayMerida();
  const todaySchedule = scheduleFor(scheds, profile!.id, todayIso) ?? { target_min: 480, tolerance_min: 15, end_time: "18:00:00" };
  const todayEntry = days.find((d) => d.date === todayIso);
  const todayTotalMin = todayEntry?.totalMin ?? 0;
  const todayTargetMin = todayEntry?.targetMin ?? todaySchedule.target_min;
  const todayPct = todayTargetMin > 0 ? Math.min(100, Math.round((todayTotalMin / todayTargetMin) * 100)) : 0;
  const todayPresence = resolvePresence({
    firstIn: todayEntry?.firstIn ?? null, isOpen: todayEntry?.isOpen ?? false,
    noRegistroSalida: todayEntry?.noRegistroSalida ?? false, liveStateName: null, liveStateColor: null,
  });
  const todayStatus = todayPresence.label;
  const todayStatusColor = !todayEntry ? "var(--text-3)"
    : todayEntry.noRegistroSalida ? "var(--danger)"
    : todayEntry.isOpen ? "var(--ok)" : todayEntry.metTarget ? "var(--ok)" : "var(--warn)";

  return (
    <>
      <header className="pt-8 pb-5">
        <h1 className="text-[28px] font-bold tracking-tight">Mi jornada</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>Últimos 30 días</p>
      </header>

      <div className="mb-7">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: todayStatusColor }} />
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>Hoy · {todayStatus}</p>
        </div>
        <p className="text-[40px] font-bold tabular-nums leading-none">{todayEntry?.noRegistroSalida ? "—" : fmtMin(todayTotalMin)}</p>
        <div className="mt-4">
          <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${todayPct}%`, background: todayPct >= 100 ? "var(--ok)" : "var(--accent)" }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-3)" }}>Objetivo diario</span>
            <span className="text-[11.5px] font-bold tabular-nums" style={{ color: "var(--text-3)" }}>{fmtMin(todayTargetMin)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-6">
        <div className="card p-4 text-center">
          <p className="text-[19px] font-bold tabular-nums">{days.length}</p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Días con registro</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[19px] font-bold tabular-nums">{fmtMin(totalMin)}</p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Total laborado</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[19px] font-bold tabular-nums" style={{ color: totalExtra > 0 ? "var(--ok)" : undefined }}>
            {totalExtra > 0 ? `+${fmtMin(totalExtra)}` : "—"}
          </p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Tiempo extra</p>
        </div>
      </div>

      {days.length === 0 && (
        <div className="card p-8 text-center">
          <p className="font-semibold text-[14px]">Aún sin registros</p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Tus fichajes de los últimos 30 días aparecerán aquí
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {days.map((d) => {
          const dateObj = new Date(d.date + "T00:00:00");
          const isHoliday = holidaySet.has(d.date);
          const label = dateObj.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
          return (
            <details key={d.date} className="card overflow-hidden group">
              <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer list-none">
                <div className="flex items-center gap-3">
                  <p className="text-[14px] font-bold capitalize w-[92px]">{label}</p>
                  <p className="text-[13px] tabular-nums" style={{ color: "var(--text-2)" }}>
                    {fmtTime(d.firstIn)} → {fmtTime(d.lastOut)}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  {isHoliday
                    ? <Pill tone="accent">Inhábil</Pill>
                    : d.noRegistroSalida ? <Pill tone="danger">No registró salida</Pill>
                    : d.isOpen ? <Pill tone="ok">Trabajando</Pill>
                    : <Pill tone={d.metTarget ? "ok" : "warn"}>{fmtMin(d.totalMin)}</Pill>}
                </div>
              </summary>
              <div style={{ borderTop: "0.5px solid var(--border)" }}>
                {d.movements.map((m) => (
                  <div key={m.id} className="flex justify-between px-5 py-2.5 text-[13px]"
                    style={{ borderBottom: "0.5px solid var(--border)" }}>
                    <span>{m.reason}</span>
                    <span className="font-semibold tabular-nums">{fmtTime(m.time)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-5 py-2.5 text-[12.5px] font-bold">
                  <span style={{ color: "var(--text-2)" }}>Total trabajado</span>
                  <span className="tabular-nums">{fmtMin(d.totalMin)}{d.extraMin > 0 && <span style={{ color: "var(--ok)" }}> · +{fmtMin(d.extraMin)} extra</span>}</span>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
