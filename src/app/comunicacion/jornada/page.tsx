import { createClient } from "@/lib/supabase/server";
import { summarizeDay, fmtMin, fmtTime, scheduleFor } from "@/lib/hours";
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
    d, rows, scheduleFor(scheds, profile!.id, d) ?? { target_min: 480, tolerance_min: 15 }, states,
  ));
  const totalMin = days.reduce((s, d) => s + d.totalMin, 0);
  const totalExtra = days.reduce((s, d) => s + d.extraMin, 0);

  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Mi jornada</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>Últimos 30 días</p>
      </header>

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
                    : d.isOpen ? <Pill tone="ok">En curso</Pill>
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
