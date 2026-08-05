import { createClient } from "@/lib/supabase/server";
import { typeLabels } from "@/lib/types";
import type { ActivityType, RequestStatus } from "@/lib/types";
import { seniorityLabel, todayMerida, dmy } from "@/lib/tz";
import { STATUS_TONE } from "@/lib/ui-maps";
import { PageHeader } from "@/components/shared";
import { IconClock, IconUsers, IconFolder } from "@/components/icons";
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
      <div className="flex items-center justify-between text-[13.5px] mb-1">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums" style={{ color: "var(--text-3)" }}>{count}</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
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

  const vacCsvRows: (string | number)[][] = vacRows.map((r) => [r.name, r.balance, r.total, `${r.pctUsed}%`, r.seniority, r.next]);

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle={`${totalReqs} solicitud${totalReqs === 1 ? "" : "es"} en total · agregados reales de Solicitudes y Actividades`}
      >
        <PrintButton />
      </PageHeader>

      {/* Métrica protagonista + KPIs secundarios — cada uno en su tarjeta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 md:row-span-2 flex flex-col justify-between">
          <p className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>Solicitudes totales</p>
          <div className="mt-4">
            <div className="flex items-baseline gap-3">
              <span className="text-[56px] font-bold tabular-nums leading-none text-text-1">{totalReqs}</span>
              <span className="text-[15px] font-medium" style={{ color: "var(--text-2)" }}>solicitudes</span>
            </div>
            <div className="flex items-center gap-2 text-[14px] mt-2">
              <span style={{ color: trendUp ? "var(--ok)" : "var(--warn)" }}>
                {trendUp ? "↑" : "↓"} {trendPct == null ? "nuevo" : `${trendPct > 0 ? "+" : ""}${trendPct}%`}
              </span>
              <span style={{ color: "var(--text-3)" }}>vs periodo anterior</span>
            </div>
          </div>
        </div>
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>Actividades creadas</p>
            <p className="text-[28px] font-bold tabular-nums text-text-1 mt-1">{projs.length}</p>
          </div>
          <div className="w-12 h-12 rounded-xl grid place-items-center" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
            <IconFolder className="w-5 h-5" />
          </div>
        </div>
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>Tiempo prom. aprobación</p>
            <p className="text-[28px] font-bold tabular-nums text-text-1 mt-1">
              {avgApprovalHours == null ? "—" : avgApprovalHours < 24
                ? `${avgApprovalHours.toFixed(1)}h`
                : `${(avgApprovalHours / 24).toFixed(1)}d`}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl grid place-items-center" style={{ background: "var(--ok-tint)", color: "var(--ok)" }}>
            <IconClock className="w-5 h-5" />
          </div>
        </div>
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold" style={{ color: "var(--text-3)" }}>Áreas solicitantes</p>
            <p className="text-[28px] font-bold tabular-nums text-text-1 mt-1">{topAreas.length}</p>
          </div>
          <div className="w-12 h-12 rounded-xl grid place-items-center" style={{ background: "var(--purple-tint)", color: "var(--purple)" }}>
            <IconUsers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tendencia + Resumen */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-[15px] font-bold text-text-1 mb-4">Tendencia</h2>
          <div className="flex items-center gap-6">
            <Sparkline values={trendValues} width={280} height={60} color={trendUp ? "var(--ok)" : "var(--warn)"} />
            <p className="text-[14px]" style={{ color: "var(--text-2)" }}>
              {trendTotal} solicitudes en las últimas {weeksBack} semanas
            </p>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-[15px] font-bold text-text-1 mb-4">Resumen</h2>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>Top empleado</p>
              {topEmployee ? (
                <p className="text-[15px] font-bold text-text-1 truncate">{topEmployee.name} <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: "var(--ok)" }}>· {topEmployee.hours}h</span></p>
              ) : (
                <p className="text-[14px]" style={{ color: "var(--text-3)" }}>Sin registros</p>
              )}
            </div>
            <div>
              <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>Área con más carga</p>
              {topAreas.length > 0 ? (
                <p className="text-[15px] font-bold text-text-1 truncate">{topAreas[0][0]} <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: "var(--accent)" }}>· {topAreas[0][1]}</span></p>
              ) : (
                <p className="text-[14px]" style={{ color: "var(--text-3)" }}>Sin datos</p>
              )}
            </div>
            <div>
              <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>Cuello de botella</p>
              {bottleneck ? (
                <p className="text-[15px] font-bold text-text-1 truncate">{bottleneck.area} <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: "var(--warn)" }}>
                  {bottleneck.hours < 24 ? `${bottleneck.hours}h` : `${(bottleneck.hours / 24).toFixed(1)}d`}
                </span></p>
              ) : (
                <p className="text-[14px]" style={{ color: "var(--text-3)" }}>Sin datos suficientes</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Distribuciones - Solo barras, sin donuts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <h2 className="text-[15px] font-bold text-text-1 mb-4">Solicitudes por estado</h2>
          {totalStatus === 0 ? (
            <p className="text-[14px]" style={{ color: "var(--text-3)" }}>Sin solicitudes todavía.</p>
          ) : (
            <div className="space-y-3">
              {STATUS_ORDER.filter((s) => byStatus[s]).map((s) => (
                <Bar key={s} label={STATUS_LABEL[s] ?? s} count={byStatus[s]} total={totalStatus} color={TONE_COLOR[STATUS_TONE[s]]} />
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-[15px] font-bold text-text-1 mb-4">Por tipo de apoyo</h2>
          {totalType === 0 ? (
            <p className="text-[14px]" style={{ color: "var(--text-3)" }}>Sin solicitudes todavía.</p>
          ) : (
            <div className="space-y-3">
              {byTypeSorted.slice(0, 6).map(([t, n]) => (
                <Bar key={t} label={TYPE_LABEL[t] ?? t} count={n} total={totalType} color={typeColorOf[t] ?? "var(--accent)"} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Áreas que más solicitan */}
      <div className="card p-5 mb-6">
        <h2 className="text-[15px] font-bold text-text-1 mb-4">
          Áreas que más solicitan
          {Object.keys(byArea).length > 0 && (
            <span className="text-[13.5px] font-medium ml-2" style={{ color: "var(--text-3)" }}>
              · {Object.keys(byArea).length} en total
            </span>
          )}
        </h2>
        {topAreas.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--text-3)" }}>Sin datos todavía.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
            {topAreas.map(([area, n], i) => (
              <Bar key={area} label={area} count={n} total={maxArea} color={COLORS[i % COLORS.length]} />
            ))}
          </div>
        )}
      </div>

      {/* Horas registradas por tipo */}
      <div className="card p-5 mb-6">
        <h2 className="text-[15px] font-bold text-text-1 mb-4">Horas registradas por tipo</h2>
        {minutesByTypeSorted.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--text-3)" }}>Aún no hay registros de tiempo.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
            {minutesByTypeSorted.slice(0, 6).map(([t, min]) => (
              <Bar key={t} label={TYPE_LABEL[t] ?? t} count={Math.round(min / 6) / 10}
                total={maxMinutes / 60}
                color={typeColorOf[t] ?? "var(--accent)"} />
            ))}
          </div>
        )}
      </div>

      {/* Vacaciones por persona */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-[15px] font-bold text-text-1">Vacaciones por persona</h2>
          <div className="flex items-center gap-3">
            {vacTotalDays > 0 && (
              <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-3)" }}>
                {vacPctUsed}% del total usado
              </span>
            )}
            <CsvLink rows={vacCsvRows} filename="vacaciones-por-persona" adminId={adminId} />
          </div>
        </div>
        {vacRows.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--text-3)" }}>Sin personal registrado todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr style={{ color: "var(--text-3)" }} className="text-left">
                  <th className="font-semibold pb-3 pr-4">Persona</th>
                  <th className="font-semibold pb-3 pr-4">Saldo</th>
                  <th className="font-semibold pb-3 pr-4">% usado</th>
                  <th className="font-semibold pb-3 pr-4">Antigüedad</th>
                  <th className="font-semibold pb-3">Próxima vacación</th>
                </tr>
              </thead>
              <tbody>
                {vacRows.map((r) => (
                  <tr key={r.name} className="border-t transition-colors hover:bg-hover" style={{ borderColor: "var(--border)" }}>
                    <td className="py-3 pr-4 font-semibold">{r.name}</td>
                    <td className="py-3 pr-4 tabular-nums">{r.balance}/{r.total}</td>
                    <td className="py-3 pr-4 tabular-nums"
                      style={{ color: r.pctUsed < 50 ? "var(--ok)" : r.pctUsed < 80 ? "var(--warn)" : "var(--danger)" }}>
                      {r.pctUsed}%
                    </td>
                    <td className="py-3 pr-4" style={{ color: "var(--text-2)" }}>{r.seniority}</td>
                    <td className="py-3" style={{ color: "var(--text-2)" }}>{r.next}</td>
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
