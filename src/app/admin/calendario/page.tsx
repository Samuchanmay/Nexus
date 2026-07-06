import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui";
import { todayMerida } from "@/lib/tz";

/* ═══════════════════════════════════════════════════════════════
   L5 · Calendario mensual del equipo (legado cert_nexus)
   Heatmap por persona × día: fichaje, vacaciones, día inhábil,
   día hábil sin registro (informativo — NO es falta).
   ═══════════════════════════════════════════════════════════════ */

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function Calendario({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const today = todayMerida();
  const ym = /^\d{4}-\d{2}$/.test(m ?? "") ? m! : today.slice(0, 7);
  const [year, month] = ym.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = `${ym}-01`;
  const last = `${ym}-${String(daysInMonth).padStart(2, "0")}`;

  const supabase = await createClient();
  const [{ data: team }, { data: att }, { data: vacs }, { data: hols }] = await Promise.all([
    supabase.from("users").select("id, display_name, nexus_color").eq("active", true).in("role", ["admin", "empleado"]).order("display_name"),
    supabase.from("attendance").select("user_id, date").gte("date", first).lte("date", last),
    supabase.from("vacations").select("user_id, start_date, end_date").eq("status", "Aprobada").lte("start_date", last).gte("end_date", first),
    supabase.from("holidays").select("date, name").gte("date", first).lte("date", last),
  ]);

  const holidayOf = new Map((hols ?? []).map((h) => [h.date, h.name]));
  const attSet = new Set((att ?? []).map((a) => `${a.user_id}|${a.date}`));
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    const date = `${ym}-${d}`;
    const dow = new Date(`${date}T12:00:00`).getDay();
    return { n: i + 1, date, isWeekend: dow === 0 || dow === 6, holiday: holidayOf.get(date) ?? null };
  });

  type Cell = { kind: "fichaje" | "vacacion" | "inhabil" | "sin" | "off" | "futuro"; tip: string };
  const grid = (team ?? []).map((u) => {
    const cells: Cell[] = days.map((d) => {
      const onVac = (vacs ?? []).some((v) => v.user_id === u.id && v.start_date <= d.date && v.end_date >= d.date);
      if (onVac) return { kind: "vacacion", tip: `${d.date} · Vacaciones` };
      if (d.holiday) return { kind: "inhabil", tip: `${d.date} · ${d.holiday}` };
      if (d.isWeekend) return { kind: "off", tip: `${d.date} · Fin de semana` };
      if (attSet.has(`${u.id}|${d.date}`)) return { kind: "fichaje", tip: `${d.date} · Con registro` };
      if (d.date > today) return { kind: "futuro", tip: d.date };
      return { kind: "sin", tip: `${d.date} · Sin registro (informativo)` };
    });
    const habiles = cells.filter((c) => c.kind === "fichaje" || c.kind === "sin").length;
    const conRegistro = cells.filter((c) => c.kind === "fichaje").length;
    return { user: u, cells, habiles, conRegistro };
  });

  const CELL: Record<Cell["kind"], { bg: string; border?: string }> = {
    fichaje:  { bg: "linear-gradient(155deg,#34D058,#2FB344)" },
    vacacion: { bg: "linear-gradient(155deg,#A78BFA,#8E5CF7)" },
    inhabil:  { bg: "var(--accent-tint)", border: "1px solid var(--accent)" },
    sin:      { bg: "var(--warn-tint)", border: "1px dashed var(--warn)" },
    off:      { bg: "var(--surface-2)" },
    futuro:   { bg: "transparent", border: "1px dashed var(--border)" },
  };

  return (
    <>
      <header className="pt-8 pb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight capitalize">
            {MONTHS[month - 1]} {year}
          </h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Calendario del equipo · fichajes, vacaciones y días inhábiles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/calendario?m=${shiftMonth(ym, -1)}`} className="btn-secondary px-3.5 py-2 text-[13px]">←</Link>
          <Link href="/admin/calendario" className="btn-secondary px-3.5 py-2 text-[13px]">Hoy</Link>
          <Link href={`/admin/calendario?m=${shiftMonth(ym, 1)}`} className="btn-secondary px-3.5 py-2 text-[13px]">→</Link>
        </div>
      </header>

      <div className="card p-5 overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Encabezado de días */}
          <div className="flex items-center gap-3 pb-2" style={{ borderBottom: "0.5px solid var(--border)" }}>
            <div className="w-[150px] shrink-0" />
            <div className="flex-1 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(0,1fr))` }}>
              {days.map((d) => (
                <span key={d.n}
                  className="text-center text-[9px] font-bold tabular-nums"
                  style={{ color: d.date === today ? "var(--accent)" : d.isWeekend ? "var(--text-3)" : "var(--text-2)" }}>
                  {d.n}
                </span>
              ))}
            </div>
            <div className="w-[70px] shrink-0" />
          </div>

          {/* Filas por persona */}
          {grid.map(({ user: u, cells, habiles, conRegistro }) => (
            <div key={u.id} className="flex items-center gap-3 py-2.5"
              style={{ borderBottom: "0.5px solid var(--border)" }}>
              <div className="flex items-center gap-2.5 w-[150px] shrink-0">
                <Avatar name={u.display_name} color={u.nexus_color} size={28} />
                <p className="text-[12.5px] font-bold truncate">{u.display_name}</p>
              </div>
              <div className="flex-1 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(0,1fr))` }}>
                {cells.map((c, i) => (
                  <div key={i} title={c.tip}
                    className="h-5 rounded-[4px]"
                    style={{
                      background: CELL[c.kind].bg,
                      border: CELL[c.kind].border,
                      outline: days[i].date === today ? "2px solid var(--accent)" : undefined,
                      outlineOffset: days[i].date === today ? "1px" : undefined,
                    }} />
                ))}
              </div>
              <div className="w-[70px] shrink-0 text-right">
                <p className="text-[12px] font-bold tabular-nums">{conRegistro}/{habiles}</p>
                <p className="text-[9px]" style={{ color: "var(--text-3)" }}>días reg.</p>
              </div>
            </div>
          ))}

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3.5 text-[10.5px] font-semibold" style={{ color: "var(--text-2)" }}>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.fichaje.bg }} /> Con registro
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.vacacion.bg }} /> Vacaciones
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.inhabil.bg, border: CELL.inhabil.border }} /> Día inhábil
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.sin.bg, border: CELL.sin.border }} /> Sin registro (informativo)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3 rounded-[3px]" style={{ background: CELL.off.bg }} /> Fin de semana
            </span>
          </div>
        </div>
      </div>

      {/* Días inhábiles del mes */}
      {(hols ?? []).length > 0 && (
        <div className="card p-5 mt-4">
          <h2 className="text-[15px] font-bold mb-2.5">Días inhábiles de {MONTHS[month - 1]}</h2>
          <div className="flex flex-col gap-1.5">
            {(hols ?? []).map((h) => (
              <div key={h.date} className="flex items-center justify-between text-[13px]">
                <span className="font-semibold">{h.name}</span>
                <span className="tabular-nums" style={{ color: "var(--text-3)" }}>{h.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
