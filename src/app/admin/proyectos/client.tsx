"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Pill, useToast } from "@/components/ui";
import { TYPE_LABELS, STATUS_LABELS } from "@/lib/types";
import type { RequestType, RequestStatus, Priority } from "@/lib/types";
import { STATUS_TONE, PRIORITY_TONE } from "@/lib/ui-maps";

/* ═══════════════════════════════════════════════════════════════
   Dependencias entre Actividades — Plano Maestro §04.
   Una actividad puede bloquearse hasta que otra sea completada,
   para evitar errores operativos (ej. no armar la Landing Page
   antes de que el Diseño Principal esté terminado). El bloqueo
   real vive en la BD (trigger sobre task_time_logs); esta UI solo
   administra qué depende de qué.
   ═══════════════════════════════════════════════════════════════ */

export type ProjectRow = {
  id: string; status: string; priority: string; deadline: string | null; created_at: string;
  requests: { title: string; type: RequestType } | null;
  project_assignments: { is_lead: boolean; users: { display_name: string; nexus_color: string | null } }[];
};
export type DepRow = {
  id: string; project_id: string; depends_on_project_id: string;
  projects: { id: string; status: string; requests: { title: string } | null } | null;
};

export default function ProyectosClient({ projects, dependencies }: { projects: ProjectRow[]; dependencies: DepRow[] }) {
  const toast = useToast();
  const [deps, setDeps] = useState(dependencies);
  const [open, setOpen] = useState<string | null>(null); // project_id con el picker abierto
  const [picked, setPicked] = useState("");
  const [saving, setSaving] = useState(false);

  const active = projects.filter((p) => !["completada", "cancelada"].includes(p.status));
  const done = projects.filter((p) => ["completada", "cancelada"].includes(p.status));

  const depsOf = useMemo(() => {
    const m = new Map<string, DepRow[]>();
    for (const d of deps) (m.get(d.project_id) ?? m.set(d.project_id, []).get(d.project_id)!).push(d);
    return m;
  }, [deps]);

  const titleOf = (p: ProjectRow) => p.requests?.title ?? "Actividad";

  const addDependency = async (projectId: string) => {
    if (!picked) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("project_dependencies")
      .insert({ project_id: projectId, depends_on_project_id: picked })
      .select("id, project_id, depends_on_project_id, projects!project_dependencies_depends_on_project_id_fkey(id, status, requests(title))")
      .single();
    setSaving(false);
    if (error || !data) { toast("No se pudo agregar la dependencia"); return; }
    setDeps((d) => [...d, data as unknown as DepRow]);
    setPicked("");
    setOpen(null);
    toast("Dependencia agregada");
  };

  const removeDependency = async (depId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("project_dependencies").delete().eq("id", depId);
    if (error) { toast("No se pudo quitar"); return; }
    setDeps((d) => d.filter((x) => x.id !== depId));
    toast("Dependencia eliminada");
  };

  const Card = ({ p }: { p: ProjectRow }) => {
    const asgs = p.project_assignments ?? [];
    const myDeps = depsOf.get(p.id) ?? [];
    const pending = myDeps.filter((d) => d.projects && d.projects.status !== "completada");
    const otherOptions = projects.filter((o) => o.id !== p.id && !myDeps.some((d) => d.depends_on_project_id === o.id));

    return (
      <div className="card card-hover p-5">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <Pill tone="accent">{p.requests ? TYPE_LABELS[p.requests.type] : "—"}</Pill>
          <Pill tone={STATUS_TONE[p.status as RequestStatus] ?? "muted"}>{STATUS_LABELS[p.status as RequestStatus] ?? p.status}</Pill>
          {(p.priority as Priority) !== "normal" && <Pill tone={PRIORITY_TONE[p.priority as Priority]}>{p.priority}</Pill>}
          {pending.length > 0 && <Pill tone="danger">🔒 Bloqueada</Pill>}
        </div>
        <h3 className="text-[15px] font-bold leading-snug">{titleOf(p)}</h3>
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
              entrega {p.deadline}
            </span>
          )}
        </div>

        {/* Dependencias */}
        <div className="mt-3 pt-3" style={{ borderTop: "0.5px solid var(--border)" }}>
          <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-3)" }}>Depende de</p>
          {myDeps.length === 0 && open !== p.id && (
            <p className="text-[12.5px]" style={{ color: "var(--text-3)" }}>Sin dependencias</p>
          )}
          <div className="flex flex-col gap-1.5">
            {myDeps.map((d) => {
              const blocked = d.projects && d.projects.status !== "completada";
              return (
                <div key={d.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="truncate" style={{ color: blocked ? "var(--danger)" : "var(--ok)" }}>
                    {blocked ? "🔒" : "✔️"} {d.projects?.requests?.title ?? "Actividad"}
                  </span>
                  <button className="text-[11.5px] font-semibold shrink-0" style={{ color: "var(--text-3)" }}
                    onClick={() => removeDependency(d.id)}>
                    Quitar
                  </button>
                </div>
              );
            })}
          </div>

          {open === p.id ? (
            <div className="flex items-center gap-2 mt-2">
              <select className="input flex-1 text-[12.5px]" value={picked} onChange={(e) => setPicked(e.target.value)}>
                <option value="">— elige una actividad —</option>
                {otherOptions.map((o) => (
                  <option key={o.id} value={o.id}>{titleOf(o)}</option>
                ))}
              </select>
              <button className="btn-secondary text-[12px] px-2.5 py-1.5" disabled={saving} onClick={() => addDependency(p.id)}>
                Agregar
              </button>
              <button className="text-[12px]" style={{ color: "var(--text-3)" }} onClick={() => { setOpen(null); setPicked(""); }}>
                ✕
              </button>
            </div>
          ) : (
            <button className="text-[12px] font-semibold mt-2" style={{ color: "var(--accent)" }}
              onClick={() => setOpen(p.id)}>
              + Agregar dependencia
            </button>
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
      <div className="grid md:grid-cols-2 gap-3.5 mb-8">{active.map((p) => <Card key={p.id} p={p} />)}</div>

      {done.length > 0 && (
        <>
          <h2 className="text-[15px] font-bold mb-3">Cerrados</h2>
          <div className="grid md:grid-cols-2 gap-3.5 opacity-70">{done.map((p) => <Card key={p.id} p={p} />)}</div>
        </>
      )}
    </>
  );
}
