import { createClient } from "@/lib/supabase/server";
import { typeLabels } from "@/lib/types";
import type { ActivityType, RequestStatus } from "@/lib/types";
import { seniorityLabel, todayMerida, dmy } from "@/lib/tz";
import { STATUS_TONE } from "@/lib/ui-maps";
import { PrintButton } from "./print-button";
import { CsvLink } from "./csv-link";

/* ═══════════════════════════════════════════════════════════════
   Reportes — agregados reales de Solicitudes/Actividades.
   Sin datos inventados: todo se calcula aquí mismo a partir de lo
   que ya existe en requests/projects/task_time_logs.
   ═══════════════════════════════════════════════════════════════ */

const STATUS_LABEL: Record<string, string> = {
  solicitada: "Por revisar", aprobada: "Aprobada", cancelada: "Cancelada/rechazada",
};

function Bar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-[13px] mb-1">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums" style={{ color: "var(--text-3)" }}>{count}</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** Donut de proporciones — lectura de "de qué tamaño es cada parte del
    total" más rápida que una pila de barras. Puro SVG server-renderable,
    sin librería de charts. */
function Donut({ segments, size = 96, thickness = 12 }: {
  segments: { value: number; color: string }[]; size?: number; thickness?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" style={{ transform: "rotate(-90deg)" }}>
      {total === 0 ? (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
      ) : segments.filter((s) => s.value > 0).map((s, i) => {
        const frac = s.value / total;
        const dash = frac * c;
        const el = (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset}
            strokeLinecap={segments.filter((x) => x.value > 0).length > 1 ? "butt" : "round"} />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

/** Sparkline de tendencia — misma idea que un mini gráfico de Excel: da
    "sensación" de momentum (subiendo/bajando) de un vistazo, sin ejes ni
    leyenda. Puro SVG, server-renderable. */
function Sparkline({ values, width = 160, height = 40, color = "var(--accent)" }: {
  values: number[]; width?: number; height?: number; color?: string;
}) {
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  const last = values[values.length - 1] ?? 0;
  const lastY = height - ((last - min) / range) * height;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(values.length - 1) * stepX} cy={lastY} r={3} fill={color} />
    </svg>
  );
}

/** Encabezado de card con título discreto + botón de exportar a la derecha. */
function CardHeader({ title, rows, filename, adminId }: { title: string; rows: (string | number)[][]; filename: string; adminId: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[13px] font-bold" style={{ color: "var(--text-3)" }}>{title}</h2>
      <CsvLink rows={rows} filename={filename} adminId={adminId} />
    </div>
  );
}

const TONE_COLOR: Record<string, string> = {
  accent: "var(--accent)", ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)", muted: "var(--text-3)",
};
const STATUS_ORDER: RequestStatus[] = ["solicitada", "aprobada", "cancelada"];

export default async function Reportes() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: requests }, { data: projects }, { data: logs }, { data: types }, { data: team }, { data: vacs }, meRes] = await Promise.all([
    supabase.from("requests").select("id, type, requester_area, status, created_at"),
    supabase.from("projects").select("id, request_id, created_at, status"),
    supabase.from("task_time_logs").select("minutes, project_assignments(project_id, user_id)"),
    supabase.from("activity_types").select("*"),
    supabase.from("users").select("id, display_name, vacation_balance, vacation_days_per_year, hire_date")
      .eq("active", true).in("role", ["admin", "empleado"]).order("display_name"),
    supabase.from("vacations").select("user_id, start_date, end_date, days, status").is("archived_at", null),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  const adminId = meRes?.data?.id ?? "";
  const TYPE_LABEL = typeLabels((types ?? []) as ActivityType[]);

  const reqs = requests ?? [];
  const projs = projects ?? [];

  /* Por estado */
  const byStatus: Record<string, number> = {};
  for (const r of reqs) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

  /* Por tipo */
  const byType: Record<string, number> = {};
  for (const r of reqs) byType[r.type] = (byType[r.type] ?? 0) + 1;

  /* Por coordinación/departamento */
  const byArea: Record<string, number> = {};
  for (const r of reqs) {
    const a = r.requester_area?.trim() || "Sin especificar";
    byArea[a] = (byArea[a] ?? 0) + 1;
  }
  const topAreas = Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 8);

  /* Tiempo promedio de aprobación: creación de solicitud -> creación de actividad */
  const reqById = new Map(reqs.map((r) => [r.id, r]));
  const approvalHours: number[] = [];
  for (const p of projs) {
    const r = reqById.get(p.request_id);
    if (!r) continue;
    const hrs = (new Date(p.created_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000;
    if (hrs >= 0) approvalHours.push(hrs);
  }
  const avgApprovalHours = approvalHours.length
    ? approvalHours.reduce((a, b) => a + b, 0) / approvalHours.length
    : null;

  /* Horas registradas por tipo */
  const projectToRequestType = new Map<string, string>();
  for (const p of projs) {
    const r = reqById.get(p.request_id);
    if (r) projectToRequestType.set(p.id, r.type);
  }
  const minutesByType: Record<string, number> = {};
  for (const l of (logs ?? [])) {
    const pid = (l.project_assignments as unknown as { project_id: string } | null)?.project_id;
    const type = pid ? projectToRequestType.get(pid) : undefined;
    if (!type) continue;
    minutesByType[type] = (minutesByType[type] ?? 0) + (l.minutes ?? 0);
  }

  /* Tendencia — solicitudes por semana (últimas 8 semanas), para el
     sparkline. Bucket simple por lunes-de-la-semana en hora de Mérida. */
  const weeksBack = 8;
  const mondayOf = (iso: string) => {
    const d = new Date(iso + "T12:00:00Z");
    const dow = d.getUTCDay(); // 0=Dom
    const delta = dow === 0 ? -6 : 1 - dow;
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  };
  const weekKeys: string[] = [];
  { const t = new Date(todayMerida() + "T12:00:00Z");
    for (let i = weeksBack - 1; i >= 0; i--) {
      const d = new Date(t); d.setUTCDate(d.getUTCDate() - i * 7);
      weekKeys.push(mondayOf(d.toISOString().slice(0, 10)));
    }
  }
  const reqsPerWeek: Record<string, number> = {};
  for (const r of reqs) {
    const wk = mondayOf(new Date(r.created_at).toISOString().slice(0, 10));
    reqsPerWeek[wk] = (reqsPerWeek[wk] ?? 0) + 1;
  }
  const trendValues = weekKeys.map((wk) => reqsPerWeek[wk] ?? 0);
  const trendTotal = trendValues.reduce((a, b) => a + b, 0);
  const trendPrevHalf = trendValues.slice(0, 4).reduce((a, b) => a + b, 0);
  const trendRecentHalf = trendValues.slice(4).reduce((a, b) => a + b, 0);
  const trendUp = trendRecentHalf >= trendPrevHalf;
  /* % de cambio recent vs. mitad anterior — "nuevo" cuando no había base
     de comparación (mitad anterior en cero pero ya hay actividad ahora). */
  const trendPct = trendPrevHalf > 0
    ? Math.round(((trendRecentHalf - trendPrevHalf) / trendPrevHalf) * 100)
    : trendRecentHalf > 0 ? null : 0;

  /* Horas registradas por persona (todo el historial) — para "top empleado". */
  const minutesByUser: Record<string, number> = {};
  for (const l of (logs ?? [])) {
    const uid = (l.project_assignments as unknown as { user_id: string } | null)?.user_id;
    if (!uid) continue;
    minutesByUser[uid] = (minutesByUser[uid] ?? 0) + (l.minutes ?? 0);
  }
  const nameByUserId = new Map((team ?? []).map((t) => [t.id, t.display_name]));
  const topEmployeeEntry = Object.entries(minutesByUser).sort((a, b) => b[1] - a[1])[0];
  const topEmployee = topEmployeeEntry
    ? { name: nameByUserId.get(topEmployeeEntry[0]) ?? "—", hours: Math.round((topEmployeeEntry[1] / 60) * 10) / 10 }
    : null;

  /* Cuello de botella: la coordinación/departamento cuyo tiempo promedio de
     aprobación (solicitud → actividad creada) es el más alto — es decir,
     donde las solicitudes tardan más en convertirse en trabajo real. Solo
     se considera un área si tiene al menos 2 solicitudes ya aprobadas, para
     no señalar como "cuello de botella" un solo caso aislado. */
  const approvalHoursByArea: Record<string, number[]> = {};
  for (const p of projs) {
    const r = reqById.get(p.request_id);
    if (!r) continue;
    const hrs = (new Date(p.created_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000;
    if (hrs < 0) continue;
    const a = r.requester_area?.trim() || "Sin especificar";
    (approvalHoursByArea[a] ??= []).push(hrs);
  }
  const bottleneckEntry = Object.entries(approvalHoursByArea)
    .filter(([, hrs]) => hrs.length >= 2)
    .map(([area, hrs]) => [area, hrs.reduce((a, b) => a + b, 0) / hrs.length] as const)
    .sort((a, b) => b[1] - a[1])[0];
  const bottleneck = bottleneckEntry
    ? { area: bottleneckEntry[0], hours: Math.round(bottleneckEntry[1] * 10) / 10 }
    : null;

  const totalReqs = reqs.length;
  const totalType = Object.values(byType).reduce((a, b) => a + b, 0);
  const totalStatus = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const maxArea = Math.max(1, ...topAreas.map(([, n]) => n));
  const COLORS = ["var(--accent)", "var(--ok)", "var(--warn)", "var(--purple)", "var(--danger)"];

  // Color estable por tipo de apoyo: se asigna por posición en el catálogo
  // (activity_types.orden), no por orden de aparición en los datos — así el
  // mismo tipo siempre se ve del mismo color en toda la app.
  const activityTypes = (types ?? []) as ActivityType[];
  const typeColorOf: Record<string, string> = {};
  activityTypes.forEach((t, i) => { typeColorOf[t.key] = COLORS[i % COLORS.length]; });
  const byTypeSorted = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const minutesByTypeSorted = Object.entries(minutesByType).sort((a, b) => b[1] - a[1]);
  const maxMinutes = Math.max(1, ...Object.values(minutesByType));

  /* Vacaciones — saldo, antigüedad y próximo periodo por persona */
  const today = todayMerida();
  const vacsByUser = new Map<string, { start_date: string; end_date: string; days: number; status: string }[]>();
  for (const v of (vacs ?? [])) {
    const list = vacsByUser.get(v.user_id) ?? [];
    list.push(v);
    vacsByUser.set(v.user_id, list);
  }
  const vacRows = (team ?? []).map((t) => {
    const mine = vacsByUser.get(t.id) ?? [];
    const total = t.vacation_days_per_year || 0;
    const used = Math.max(0, total - t.vacation_balance);
    const pctUsed = total > 0 ? Math.round((used / total) * 100) : 0;
    const next = mine
      .filter((v) => v.status === "Aprobada" && v.start_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    return {
      name: t.display_name,
      balance: t.vacation_balance,
      total,
      pctUsed,
      seniority: seniorityLabel(t.hire_date) ?? "—",
      next: next ? `${dmy(next.start_date)} → ${dmy(next.end_date)}` : "—",
    };
  });
  const vacTotalDays = vacRows.reduce((a, r) => a + r.total, 0);
  const vacUsedDays = vacRows.reduce((a, r) => a + Math.max(0, r.total - r.balance), 0);
  const vacPctUsed = vacTotalDays > 0 ? Math.round((vacUsedDays / vacTotalDays) * 100) : 0;

  return (
    <>
      <header className="pt-8 pb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Reportes</h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            {totalReqs} solicitud{totalReqs === 1 ? "" : "es"} en total, agregadas en tiempo real.
          </p>
        </div>
        <PrintButton />
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-[19px] font-bold tabular-nums">{totalReqs}</p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Solicitudes totales</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[19px] font-bold tabular-nums">{projs.length}</p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Actividades creadas</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[19px] font-bold tabular-nums">
            {avgApprovalHours == null ? "—" : avgApprovalHours < 24
              ? `${avgApprovalHours.toFixed(1)} h`
              : `${(avgApprovalHours / 24).toFixed(1)} d`}
          </p>
          <p className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--text-3)" }}>Tiempo prom. de aprobación</p>
        </div>
      </div>

      {/* Tendencia ejecutiva: sparkline de solicitudes por semana — da "sensación"
          de momentum sin tener que leer una tabla de números. */}
      <div className="card p-5 mb-4 flex items-center gap-5 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <h2 className="text-[13px] font-bold mb-1" style={{ color: "var(--text-3)" }}>Solicitudes — últimas {weeksBack} semanas</h2>
          <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            {trendTotal} en total ·{" "}
            <span style={{ color: trendUp ? "var(--ok)" : "var(--warn)" }}>
              {trendUp ? "↑" : "↓"} {trendPct == null ? "nuevo esta mitad" : `${trendPct > 0 ? "+" : ""}${trendPct}%`}
            </span>{" "}
            vs. la primera mitad del periodo
          </p>
        </div>
        <Sparkline values={trendValues} color={trendUp ? "var(--ok)" : "var(--warn)"} />
      </div>

      {/* Insights ejecutivos — lo que el admin necesita saber sin leer tablas:
          quién más ha aportado horas, qué área concentra más solicitudes, y
          dónde se está atorando el proceso (aprobación más lenta). */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div className="card p-4">
          <p className="text-[10.5px] font-bold" style={{ color: "var(--text-3)" }}>Top empleado (horas)</p>
          {topEmployee ? (
            <>
              <p className="text-[15px] font-bold mt-1 truncate">{topEmployee.name}</p>
              <p className="text-[12px] tabular-nums" style={{ color: "var(--ok)" }}>{topEmployee.hours} h registradas</p>
            </>
          ) : (
            <p className="text-[13px] mt-1" style={{ color: "var(--text-3)" }}>Aún sin registros.</p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-[10.5px] font-bold" style={{ color: "var(--text-3)" }}>Área con más carga</p>
          {topAreas.length > 0 ? (
            <>
              <p className="text-[15px] font-bold mt-1 truncate">{topAreas[0][0]}</p>
              <p className="text-[12px] tabular-nums" style={{ color: "var(--accent)" }}>{topAreas[0][1]} solicitudes</p>
            </>
          ) : (
            <p className="text-[13px] mt-1" style={{ color: "var(--text-3)" }}>Sin datos todavía.</p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-[10.5px] font-bold" style={{ color: "var(--text-3)" }}>Cuello de botella</p>
          {bottleneck ? (
            <>
              <p className="text-[15px] font-bold mt-1 truncate">{bottleneck.area}</p>
              <p className="text-[12px] tabular-nums" style={{ color: "var(--warn)" }}>
                {bottleneck.hours < 24 ? `${bottleneck.hours} h` : `${(bottleneck.hours / 24).toFixed(1)} d`} prom. de aprobación
              </p>
            </>
          ) : (
            <p className="text-[13px] mt-1" style={{ color: "var(--text-3)" }}>Sin suficientes datos todavía.</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <CardHeader title="Solicitudes por estado"
            rows={[["Estado", "Cantidad"], ...STATUS_ORDER.filter((s) => byStatus[s]).map((s) => [STATUS_LABEL[s] ?? s, byStatus[s]])]}
            filename="solicitudes-por-estado.csv" adminId={adminId} />
          {totalStatus === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin solicitudes todavía.</p>
          ) : (
            <div className="flex items-center gap-5 flex-wrap">
              <Donut segments={STATUS_ORDER.filter((s) => byStatus[s]).map((s) => ({ value: byStatus[s], color: TONE_COLOR[STATUS_TONE[s]] }))} />
              <div className="flex-1 min-w-0">
                {STATUS_ORDER.filter((s) => byStatus[s]).map((s) => (
                  <Bar key={s} label={STATUS_LABEL[s] ?? s} count={byStatus[s]} total={totalStatus} color={TONE_COLOR[STATUS_TONE[s]]} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card p-5">
          <CardHeader title="Por tipo de apoyo"
            rows={[["Tipo", "Cantidad"], ...byTypeSorted.map(([t, n]) => [TYPE_LABEL[t] ?? t, n])]}
            filename="solicitudes-por-tipo.csv" adminId={adminId} />
          {totalType === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin solicitudes todavía.</p>
          ) : (
            <div className="flex items-center gap-5 flex-wrap">
              <Donut segments={byTypeSorted.map(([t, n]) => ({ value: n, color: typeColorOf[t] ?? "var(--accent)" }))} />
              <div className="flex-1 min-w-0">
                {byTypeSorted.map(([t, n]) => (
                  <Bar key={t} label={TYPE_LABEL[t] ?? t} count={n} total={totalType} color={typeColorOf[t] ?? "var(--accent)"} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold" style={{ color: "var(--text-3)" }}>
              Coordinaciones/departamentos que más solicitan
              {Object.keys(byArea).length > 0 && (
                <span className="font-semibold ml-1.5" style={{ color: "var(--text-3)" }}>
                  · {Object.keys(byArea).length} en total
                </span>
              )}
            </h2>
            <CsvLink rows={[["Área", "Cantidad"], ...topAreas.map(([area, n]) => [area, n])]}
              filename="solicitudes-por-area.csv" adminId={adminId} />
          </div>
          {topAreas.map(([area, n], i) => (
            <Bar key={area} label={area} count={n} total={maxArea} color={COLORS[i % COLORS.length]} />
          ))}
          {topAreas.length === 0 && <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin datos todavía.</p>}
        </div>

        <div className="card p-5">
          <CardHeader title="Horas registradas por tipo"
            rows={[["Tipo", "Horas"], ...minutesByTypeSorted.map(([t, min]) => [TYPE_LABEL[t] ?? t, Math.round(min / 6) / 10])]}
            filename="horas-por-tipo.csv" adminId={adminId} />
          {minutesByTypeSorted.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Aún no hay registros de tiempo.</p>
          ) : (
            <div className="flex items-center gap-5 flex-wrap">
              <Donut segments={minutesByTypeSorted.map(([t, min]) => ({ value: min, color: typeColorOf[t] ?? "var(--accent)" }))} />
              <div className="flex-1 min-w-0">
                {minutesByTypeSorted.map(([t, min]) => (
                  <Bar key={t} label={TYPE_LABEL[t] ?? t} count={Math.round(min / 6) / 10}
                    total={maxMinutes / 60}
                    color={typeColorOf[t] ?? "var(--accent)"} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card p-5 mt-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-[13px] font-bold" style={{ color: "var(--text-3)" }}>
              Vacaciones por persona
            </h2>
            {vacTotalDays > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "var(--text-3)" }}>
                <Donut size={20} thickness={4}
                  segments={[
                    { value: vacUsedDays, color: vacPctUsed < 50 ? "var(--ok)" : vacPctUsed < 80 ? "var(--warn)" : "var(--danger)" },
                    { value: vacTotalDays - vacUsedDays, color: "var(--surface-3)" },
                  ]} />
                {vacPctUsed}% del total usado
              </span>
            )}
          </div>
          <CsvLink
            rows={[["Persona", "Saldo", "Días asignados", "% usado", "Antigüedad", "Próxima vacación"],
              ...vacRows.map((r) => [r.name, r.balance, r.total, `${r.pctUsed}%`, r.seniority, r.next])]}
            filename="vacaciones.csv" adminId={adminId} label="Exportar CSV" />
        </div>
        {vacRows.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin personal registrado todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ color: "var(--text-3)" }} className="text-left">
                  <th className="font-semibold pb-2 pr-4">Persona</th>
                  <th className="font-semibold pb-2 pr-4">Saldo</th>
                  <th className="font-semibold pb-2 pr-4">% usado</th>
                  <th className="font-semibold pb-2 pr-4">Antigüedad</th>
                  <th className="font-semibold pb-2">Próxima vacación</th>
                </tr>
              </thead>
              <tbody>
                {vacRows.map((r) => (
                  <tr key={r.name} className="border-t transition-colors hover:bg-hover" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2 pr-4 font-semibold">{r.name}</td>
                    <td className="py-2 pr-4 tabular-nums">{r.balance}/{r.total}</td>
                    <td className="py-2 pr-4 tabular-nums"
                      style={{ color: r.pctUsed < 50 ? "var(--ok)" : r.pctUsed < 80 ? "var(--warn)" : "var(--danger)" }}>
                      {r.pctUsed}%
                    </td>
                    <td className="py-2 pr-4" style={{ color: "var(--text-2)" }}>{r.seniority}</td>
                    <td className="py-2" style={{ color: "var(--text-2)" }}>{r.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
