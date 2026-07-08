import { createClient } from "@/lib/supabase/server";

/* ═══════════════════════════════════════════════════════════════
   Reportes — agregados reales de Solicitudes/Actividades.
   Sin datos inventados: todo se calcula aquí mismo a partir de lo
   que ya existe en requests/projects/task_time_logs.
   ═══════════════════════════════════════════════════════════════ */

const TYPE_LABEL: Record<string, string> = {
  cobertura: "Cobertura", diseno: "Diseño", lona: "Lona", video: "Video", difusion: "Difusión",
};
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

export default async function Reportes() {
  const supabase = await createClient();

  const [{ data: requests }, { data: projects }, { data: logs }] = await Promise.all([
    supabase.from("requests").select("id, type, requester_area, status, created_at"),
    supabase.from("projects").select("id, request_id, created_at, status"),
    supabase.from("task_time_logs").select("minutes, project_assignments(project_id)"),
  ]);

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

  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Reportes</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          {totalReqs} solicitud{totalReqs === 1 ? "" : "es"} en total, agregadas en tiempo real.
        </p>
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
          <h2 className="text-[13px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-3)" }}>
            Solicitudes por estado
          </h2>
          {Object.entries(byStatus).map(([s, n], i) => (
            <Bar key={s} label={STATUS_LABEL[s] ?? s} count={n} total={totalStatus} color={COLORS[i % COLORS.length]} />
          ))}
          {totalStatus === 0 && <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin solicitudes todavía.</p>}
        </div>

        <div className="card p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-3)" }}>
            Por tipo de apoyo
          </h2>
          {Object.entries(byType).map(([t, n], i) => (
            <Bar key={t} label={TYPE_LABEL[t] ?? t} count={n} total={totalType} color={COLORS[i % COLORS.length]} />
          ))}
          {totalType === 0 && <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin solicitudes todavía.</p>}
        </div>

        <div className="card p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-3)" }}>
            Coordinaciones/departamentos que más solicitan
          </h2>
          {topAreas.map(([area, n], i) => (
            <Bar key={area} label={area} count={n} total={maxArea} color={COLORS[i % COLORS.length]} />
          ))}
          {topAreas.length === 0 && <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Sin datos todavía.</p>}
        </div>

        <div className="card p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-3)" }}>
            Horas registradas por tipo
          </h2>
          {Object.entries(minutesByType).length === 0 && (
            <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Aún no hay registros de tiempo.</p>
          )}
          {Object.entries(minutesByType)
            .sort((a, b) => b[1] - a[1])
            .map(([t, min], i) => (
              <Bar key={t} label={TYPE_LABEL[t] ?? t} count={Math.round(min / 6) / 10}
                total={Math.max(1, ...Object.values(minutesByType)) / 60}
                color={COLORS[i % COLORS.length]} />
            ))}
        </div>
      </div>
    </>
  );
}
