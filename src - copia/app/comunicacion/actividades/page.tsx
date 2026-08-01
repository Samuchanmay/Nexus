import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/lib/types";
import { STATUS_TONE, PRIORITY_TONE, PRIORITY_LABELS } from "@/lib/ui-maps";
import { dmy } from "@/lib/tz";
import { Pill } from "@/components/ui";

/* ═══════════════════════════════════════════════════════════════
   Actividades del colaborador — todo lo que se le ha asignado alguna
   vez (activas + historial), a diferencia de "Hoy" que solo muestra
   lo pendiente. Pestaña que faltaba en el nav del empleado (existía
   en NAV pero sin página real, así que no aparecía / no llevaba a
   ningún lado).
   ═══════════════════════════════════════════════════════════════ */

type Row = {
  assignmentId: string;
  isLead: boolean;
  projectId: string;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  createdAt: string;
};

export default async function ActividadesEmpleado() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("id").eq("auth_id", user!.id).single();

  const { data: assignments } = await supabase
    .from("project_assignments")
    .select("id, is_lead, projects(id, status, priority, deadline, created_at, requests(title))")
    .eq("user_id", profile!.id);

  const rows: Row[] = (assignments ?? [])
    .map((a) => {
      const p = a.projects as unknown as {
        id: string; status: string; priority: string; deadline: string | null; created_at: string;
        requests: { title: string } | null;
      } | null;
      if (!p) return null;
      return {
        assignmentId: a.id as string,
        isLead: a.is_lead as boolean,
        projectId: p.id,
        title: p.requests?.title ?? "Proyecto",
        status: p.status,
        priority: p.priority,
        deadline: p.deadline,
        createdAt: p.created_at,
      };
    })
    .filter((r): r is Row => r !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const active = rows.filter((r) => !["completada", "cancelada"].includes(r.status));
  const done = rows.filter((r) => ["completada", "cancelada"].includes(r.status));

  const Card = ({ r }: { r: Row }) => (
    <Link href={`/comunicacion?task=${r.projectId}`}
      className="card p-4 flex items-center justify-between gap-3 flex-wrap hover:bg-hover transition-colors">
      <div className="min-w-0">
        <p className="text-[14px] font-bold truncate">{r.title}</p>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
          {r.isLead ? "Responsable" : "Colaborador"}
          {r.deadline && ` · entrega ${dmy(r.deadline)}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {r.priority !== "normal" && (
          <Pill tone={PRIORITY_TONE[r.priority as keyof typeof PRIORITY_TONE] ?? "muted"}>
            {PRIORITY_LABELS[r.priority as keyof typeof PRIORITY_LABELS] ?? r.priority}
          </Pill>
        )}
        <Pill tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? "muted"}>
          {STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status}
        </Pill>
      </div>
    </Link>
  );

  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Actividades</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          Todo lo que se te ha asignado — activo e historial
        </p>
      </header>

      <div className="flex flex-col gap-2.5 mb-7">
        {active.length === 0 ? (
          <div className="card p-6 text-center text-[13px]" style={{ color: "var(--text-3)" }}>
            Sin actividades activas por ahora
          </div>
        ) : active.map((r) => <Card key={r.assignmentId} r={r} />)}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="text-[15px] font-bold mb-3">Historial</h2>
          <div className="flex flex-col gap-2.5">
            {done.map((r) => <Card key={r.assignmentId} r={r} />)}
          </div>
        </>
      )}
    </>
  );
}
