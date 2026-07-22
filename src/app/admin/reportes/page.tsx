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

/** Encabezado de card con título uppercase + botón de exportar a la derecha. */
function CardHeader({ title, rows, filename, adminId }: { title: string; rows: (string | number)[][]; filename: string; adminId: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>{title}</h2>
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
    supabase.from("task_time_logs").select("minutes, project_assignments(project_id)"),
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

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <CardHeader title="Solicitudes por estado"
            rows={[["Estado", "Cantidad"], ...STATUS_ORDER.filter((s) => byStatus[s]).map((s) => [STATUS_LABEL[s] ?? s, byStatus[s]])]}
            filename="solicitudes-por-estado.csv" adminId={adminId} />
          {STATUS_ORDER.filter((s) => byStatus[s]).map((s) => (
            <Bar key={s} label={STATUS_LABEL[s] ?? s} count={byStatus[s]} total={totalStatus} color={TONE_COLOR[STATUS_TONE[s]]} />
          ))}
          {totalStatus === 0 && <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin solicitudes todavía.</p>}
        </div>

        <div className="card p-5">
          <CardHeader title="Por tipo de apoyo"
            rows={[["Tipo", "Cantidad"], ...byTypeSorted.map(([t, n]) => [TYPE_LABEL[t] ?? t, n])]}
            filename="solicitudes-por-tipo.csv" adminId={adminId} />
          {byTypeSorted.map(([t, n]) => (
            <Bar key={t} label={TYPE_LABEL[t] ?? t} count={n} total={totalType} color={typeColorOf[t] ?? "var(--accent)"} />
          ))}
          {totalType === 0 && <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin solicitudes todavía.</p>}
        </div>

        <div className="card p-5">
          <CardHeader title="Coordinaciones/departamentos que más solicitan"
            rows={[["Área", "Cantidad"], ...topAreas.map(([area, n]) => [area, n])]}
            filename="solicitudes-por-area.csv" adminId={adminId} />
          {topAreas.map(([area, n], i) => (
            <Bar key={area} label={area} count={n} total={maxArea} color={COLORS[i % COLORS.length]} />
          ))}
          {topAreas.length === 0 && <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin datos todavía.</p>}
        </div>

        <div className="card p-5">
          <CardHeader title="Horas registradas por tipo"
            rows={[["Tipo", "Horas"], ...minutesByTypeSorted.map(([t, min]) => [TYPE_LABEL[t] ?? t, Math.round(min / 6) / 10])]}
            filename="horas-por-tipo.csv" adminId={adminId} />
          {minutesByTypeSorted.length === 0 && (
            <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Aún no hay registros de tiempo.</p>
          )}
          {minutesByTypeSorted.map(([t, min]) => (
            <Bar key={t} label={TYPE_LABEL[t] ?? t} count={Math.round(min / 6) / 10}
              total={maxMinutes / 60}
              color={typeColorOf[t] ?? "var(--accent)"} />
          ))}
        </div>
      </div>

      <div className="card p-5 mt-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
            Vacaciones por persona
          </h2>
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
                  <tr key={r.name} className="border-t" style={{ borderColor: "var(--border)" }}>
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
