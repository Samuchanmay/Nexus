import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayMerida, isoWeekday, addDays, dmy } from "@/lib/tz";

/* ═══════════════════════════════════════════════════════════════
   Calendario personal del colaborador — vista de mes con:
   · fechas límite de sus actividades asignadas
   · sus vacaciones aprobadas
   · días inhábiles del departamento
   Todo derivado de Supabase; nada inventado.
   ═══════════════════════════════════════════════════════════════ */

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type ProjectRow = {
  deadline: string | null;
  status: string;
  requests: { title: string; type: string } | null;
};

export default async function CalendarioEmpleado({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const today = todayMerida();
  const ym = /^\d{4}-\d{2}$/.test(m ?? "") ? m! : today.slice(0, 7);
  const [year, month] = ym.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = `${ym}-01`;
  const last = `${ym}-${String(daysInMonth).padStart(2, "0")}`;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("id, display_name").eq("auth_id", user!.id).single();

  const [{ data: vacs }, { data: hols }, { data: assignments }, { data: allAssignments }] = await Promise.all([
    supabase.from("vacations").select("start_date, end_date")
      .eq("user_id", profile!.id).eq("status", "Aprobada").is("archived_at", null)
      .lte("start_date", last).gte("end_date", first),
    supabase.from("holidays").select("date, name").gte("date", first).lte("date", last),
    supabase.from("project_assignments")
      .select("projects(deadline, status, requests(title, type))")
      .eq("user_id", profile!.id),
    // Todas las asignaciones (sin acotar al mes en pantalla) — para el aviso
    // de "próxima actividad", que no debe depender de qué mes se esté viendo.
    supabase.from("project_assignments")
      .select("projects(deadline, status, requests(title))")
      .eq("user_id", profile!.id),
  ]);

  const nextActivity = (allAssignments ?? [])
    .map((a) => a.projects as unknown as { deadline: string | null; status: string; requests: { title: string } | null } | null)
    .filter((p): p is { deadline: string; status: string; requests: { title: string } | null } =>
      !!p?.deadline && p.deadline >= today && !["completada", "cancelada", "rechazada"].includes(p.status))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))[0] ?? null;

  const holidayOf = new Map((hols ?? []).map((h) => [h.date, h.name]));
  const onVacation = (date: string) =>
    (vacs ?? []).some((v) => v.start_date <= date && v.end_date >= date);

  const deadlines = new Map<string, { title: string; type: string }[]>();
  for (const a of assignments ?? []) {
    const p = a.projects as unknown as ProjectRow | null;
    if (!p?.deadline || p.deadline < first || p.deadline > last) continue;
    if (p.status === "cancelada" || p.status === "rechazada") continue;
    const list = deadlines.get(p.deadline) ?? [];
    list.push({ title: p.requests?.title ?? "Actividad", type: p.requests?.type ?? "" });
    deadlines.set(p.deadline, list);
  }

  // Semanas Lun–Dom, empezando en la semana que contiene el día 1.
  const firstDow = isoWeekday(first); // 0=dom..6=sáb
  const leadDays = firstDow === 0 ? 6 : firstDow - 1; // días del mes anterior a rellenar
  const gridStart = addDays(first, -leadDays);
  const totalCells = Math.ceil((leadDays + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const date = addDays(gridStart, i);
    return {
      date,
      inMonth: date >= first && date <= last,
      day: Number(date.slice(8, 10)),
      holiday: holidayOf.get(date) ?? null,
      vacation: onVacation(date),
      acts: deadlines.get(date) ?? [],
    };
  });

  return (
    <>
      <header className="pt-8 pb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight capitalize">
            {MONTHS[month - 1]} {year}
          </h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Tus fechas límite, vacaciones y días inhábiles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/comunicacion/calendario?m=${shiftMonth(ym, -1)}`} className="btn-secondary px-3.5 py-2 text-[13px]">←</Link>
          <Link href="/comunicacion/calendario" className="btn-secondary px-3.5 py-2 text-[13px]">Hoy</Link>
          <Link href={`/comunicacion/calendario?m=${shiftMonth(ym, 1)}`} className="btn-secondary px-3.5 py-2 text-[13px]">→</Link>
        </div>
      </header>

      {nextActivity && (nextActivity.deadline < first || nextActivity.deadline > last) && (
        <Link href={`/comunicacion/calendario?m=${nextActivity.deadline.slice(0, 7)}`}
          className="card p-4 mb-4 flex items-center justify-between gap-3 hover:bg-hover transition-colors">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Tu próxima actividad</p>
            <p className="text-[13.5px] font-semibold truncate mt-0.5">{nextActivity.requests?.title ?? "Actividad"}</p>
          </div>
          <span className="text-[12.5px] font-bold shrink-0" style={{ color: "var(--accent)" }}>
            {nextActivity.deadline.slice(8, 10)}/{nextActivity.deadline.slice(5, 7)}/{nextActivity.deadline.slice(2, 4)} →
          </span>
        </Link>
      )}

      <div className="card p-4">
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {DOW.map((d) => (
            <p key={d} className="text-center text-[11px] font-bold" style={{ color: "var(--text-3)" }}>{d}</p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((c) => (
            <div key={c.date}
              className="rounded-sm p-1.5 min-h-[74px] flex flex-col gap-1"
              style={{
                background: c.vacation ? "var(--purple-tint)" : c.holiday ? "var(--accent-tint)" : "var(--surface-2)",
                opacity: c.inMonth ? 1 : 0.35,
                outline: c.date === today ? "2px solid var(--accent)" : undefined,
                outlineOffset: "-2px",
              }}>
              <p className="text-[11.5px] font-bold tabular-nums" style={{ color: "var(--text-2)" }}>{c.day}</p>
              {c.holiday && <p className="text-[9.5px] font-semibold truncate" style={{ color: "var(--accent)" }}>{c.holiday}</p>}
              {c.vacation && <p className="text-[9.5px] font-semibold" style={{ color: "var(--purple)" }}>Vacaciones</p>}
              {c.acts.map((a, i) => (
                <p key={i} className="text-[9.5px] font-semibold truncate px-1 py-0.5 rounded-[4px]"
                  style={{ background: "var(--warn-tint)", color: "var(--warn)" }} title={a.title}>
                  {a.title}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {(hols ?? []).length > 0 && (
        <div className="card p-5 mt-4">
          <h2 className="text-[15px] font-bold mb-2.5">Días inhábiles de {MONTHS[month - 1]}</h2>
          <div className="flex flex-col gap-1.5">
            {(hols ?? []).map((h) => (
              <div key={h.date} className="flex items-center justify-between text-[13px]">
                <span className="font-semibold">{h.name}</span>
                <span className="tabular-nums" style={{ color: "var(--text-3)" }}>{dmy(h.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
