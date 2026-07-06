import { createClient } from "@/lib/supabase/server";
import { Avatar, Pill } from "@/components/ui";
import { TYPE_LABELS, STATUS_LABELS } from "@/lib/types";
import type { RequestType, RequestStatus, Priority } from "@/lib/types";

import { STATUS_TONE, PRIORITY_TONE } from "@/lib/ui-maps";

export default async function Proyectos() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, status, priority, deadline, created_at, requests(title, type), project_assignments(is_lead, users(display_name, nexus_color))")  // B7: embed duplicado eliminado (nunca se usaba)
    .order("created_at", { ascending: false });

  const active = (projects ?? []).filter((p) => !["completada", "cancelada"].includes(p.status as string));
  const done = (projects ?? []).filter((p) => ["completada", "cancelada"].includes(p.status as string));

  const Card = ({ p }: { p: NonNullable<typeof projects>[number] }) => {
    const req = p.requests as unknown as { title: string; type: RequestType } | null;
    const asgs = (p.project_assignments ?? []) as unknown as { is_lead: boolean; users: { display_name: string; nexus_color: string | null } }[];
    return (
      <div className="card card-hover p-5">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <Pill tone="accent">{req ? TYPE_LABELS[req.type] : "—"}</Pill>
          <Pill tone={STATUS_TONE[p.status as RequestStatus] ?? "muted"}>{STATUS_LABELS[p.status as RequestStatus] ?? p.status}</Pill>
          {(p.priority as Priority) !== "normal" && <Pill tone={PRIORITY_TONE[p.priority as Priority]}>{p.priority as string}</Pill>}
        </div>
        <h3 className="text-[15px] font-bold leading-snug">{req?.title ?? "Proyecto"}</h3>
        <div className="flex items-center justify-between mt-3">
          <div className="flex -space-x-2">
            {asgs.map((a, i) => (
              <div key={i} title={a.users.display_name + (a.is_lead ? " (responsable)" : "")}
                style={{ border: "2px solid var(--surface)", borderRadius: "100px" }}>
                <Avatar name={a.users.display_name} color={a.users.nexus_color} size={28} />
              </div>
            ))}
          </div>
          {p.deadline && (
            <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              entrega {p.deadline as string}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Proyectos</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          {active.length} activos · {done.length} cerrados
        </p>
      </header>

      <h2 className="text-[15px] font-bold mb-3">Activos</h2>
      {active.length === 0 && (
        <div className="card p-6 text-center mb-6">
          <p className="text-[13px]" style={{ color: "var(--text-2)" }}>Sin proyectos activos — aprueba una solicitud para crear uno</p>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3.5 mb-8">{active.map((p) => <Card key={p.id as string} p={p} />)}</div>

      {done.length > 0 && (
        <>
          <h2 className="text-[15px] font-bold mb-3">Cerrados</h2>
          <div className="grid md:grid-cols-2 gap-3.5 opacity-70">{done.map((p) => <Card key={p.id as string} p={p} />)}</div>
        </>
      )}
    </>
  );
}
