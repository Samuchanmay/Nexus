"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Pill, Sheet, useToast } from "@/components/ui";
import { STATUS_LABELS } from "@/lib/types";
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
type Member = { id: string; display_name: string; nexus_color: string | null };
type ActTypeOpt = { key: string; label: string };

const PRIORITIES: Priority[] = ["baja", "normal", "alta", "urgente"];

export default function ProyectosClient({ projects, dependencies, typeLabel, types, team, adminId }: {
  projects: ProjectRow[]; dependencies: DepRow[]; typeLabel: Record<string, string>;
  types: ActTypeOpt[]; team: Member[]; adminId: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [deps, setDeps] = useState(dependencies);
  const [open, setOpen] = useState<string | null>(null); // project_id con el picker abierto
  const [picked, setPicked] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Añadir proyecto (directo, sin pasar por Solicitud) ──
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", type: types[0]?.key ?? "", priority: "normal" as Priority, deadline: "",
  });
  const [assignees, setAssignees] = useState<string[]>([]);
  const [lead, setLead] = useState("");
  const [creating, setCreating] = useState(false);

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

  const openAdd = () => {
    setForm({ title: "", type: types[0]?.key ?? "", priority: "normal", deadline: "" });
    setAssignees([]);
    setLead("");
    setAddOpen(true);
  };

  const toggleAssignee = (id: string) => {
    setAssignees((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!next.includes(lead)) setLead(next[0] ?? "");
      if (next.length === 1) setLead(next[0]);
      return next;
    });
  };

  // Crea la actividad directamente, ya "aprobada" — pensada para cuando el
  // admin arranca un trabajo interno que no vino de una Solicitud. Por
  // debajo sigue existiendo una fila en `requests` (la BD lo exige), pero
  // se marca requester_type: "externo" — el mismo patrón que ya usa
  // empleado/tasks.tsx para actividades manuales — así no aparece como
  // "pendiente por revisar" en Solicitudes.
  const createProject = async () => {
    if (!form.title.trim()) { toast("Escribe el nombre de la actividad"); return; }
    if (!form.type) { toast("Elige un tipo de actividad"); return; }
    if (assignees.length === 0) { toast("Asigna al menos a una persona"); return; }
    if (!lead) { toast("Elige al responsable principal"); return; }
    setCreating(true);
    const supabase = createClient();

    const { data: req, error: e1 } = await supabase.from("requests").insert({
      requester_id: adminId || null, requester_type: "externo",
      requester_name: "Creación directa (admin)",
      type: form.type, title: form.title.trim(),
      status: "aprobada", priority: form.priority, min_hours_required: 0,
    }).select("id").single();
    if (e1 || !req) { setCreating(false); toast("No se pudo registrar la actividad"); return; }

    const { data: prj, error: e2 } = await supabase.from("projects").insert({
      request_id: req.id, lead_user_id: lead, status: "aprobada",
      priority: form.priority, deadline: form.deadline || null,
    }).select("id").single();
    if (e2 || !prj) { setCreating(false); toast("No se pudo crear el proyecto"); return; }

    const { data: asgs } = await supabase.from("project_assignments")
      .insert(assignees.map((uid) => ({ project_id: prj.id, user_id: uid, is_lead: uid === lead })))
      .select("id, user_id");

    // Copia el checklist de la plantilla al responsable, igual que al
    // aprobar una Solicitud normal.
    const { data: tpl } = await supabase.from("checklist_templates")
      .select("id, checklist_items(position, label)").eq("type", form.type).single();
    const leadAsg = (asgs ?? []).find((a) => a.user_id === lead);
    if (tpl && leadAsg) {
      const items = (tpl.checklist_items as { position: number; label: string }[])
        .map((i) => ({ assignment_id: leadAsg.id, position: i.position, label: i.label }));
      if (items.length) await supabase.from("project_checklist").insert(items);
    }

    setCreating(false);
    setAddOpen(false);
    toast("Actividad creada");
    router.refresh();
  };

  const Card = ({ p }: { p: ProjectRow }) => {
    const asgs = p.project_assignments ?? [];
    const myDeps = depsOf.get(p.id) ?? [];
    const pending = myDeps.filter((d) => d.projects && d.projects.status !== "completada");
    const otherOptions = projects.filter((o) => o.id !== p.id && !myDeps.some((d) => d.depends_on_project_id === o.id));

    return (
      <div className="card card-hover p-5">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <Pill tone="accent">{p.requests ? (typeLabel[p.requests.type] ?? p.requests.type) : "—"}</Pill>
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
      <header className="pt-8 pb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Proyectos</h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            {active.length} activos · {done.length} cerrados
          </p>
        </div>
        <button className="btn-primary text-[13px] px-4 py-2" onClick={openAdd}>
          + Añadir proyecto
        </button>
      </header>

      <h2 className="text-[15px] font-bold mb-3">Activos</h2>
      {active.length === 0 && (
        <div className="card p-6 text-center mb-6">
          <p className="text-[13px]" style={{ color: "var(--text-2)" }}>Sin proyectos activos — aprueba una solicitud o añade uno directamente</p>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3.5 mb-8">{active.map((p) => <Card key={p.id} p={p} />)}</div>

      {done.length > 0 && (
        <>
          <h2 className="text-[15px] font-bold mb-3">Cerrados</h2>
          <div className="grid md:grid-cols-2 gap-3.5 opacity-70">{done.map((p) => <Card key={p.id} p={p} />)}</div>
        </>
      )}

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Añadir proyecto" subtitle="Crea una actividad directamente, sin pasar por Solicitudes">
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-[12px] font-semibold mb-1 block" style={{ color: "var(--text-2)" }}>Nombre de la actividad</label>
            <input className="input w-full" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ej. Actualización del sitio web" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-semibold mb-1 block" style={{ color: "var(--text-2)" }}>Tipo</label>
              <select className="input w-full" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-semibold mb-1 block" style={{ color: "var(--text-2)" }}>Prioridad</label>
              <select className="input w-full" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}>
                {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold mb-1 block" style={{ color: "var(--text-2)" }}>Fecha de entrega (opcional)</label>
            <input type="date" className="input w-full" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
          </div>

          <div>
            <label className="text-[12px] font-semibold mb-2 block" style={{ color: "var(--text-2)" }}>Asignar a</label>
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
              {team.map((m) => (
                <label key={m.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-sm cursor-pointer"
                  style={{ background: assignees.includes(m.id) ? "var(--bg-2)" : "transparent" }}>
                  <input type="checkbox" checked={assignees.includes(m.id)} onChange={() => toggleAssignee(m.id)} />
                  <Avatar name={m.display_name} color={m.nexus_color} size={26} />
                  <span className="text-[13px] font-medium flex-1">{m.display_name}</span>
                  {assignees.includes(m.id) && (
                    assignees.length > 1 ? (
                      <button className="text-[11px] font-semibold shrink-0"
                        style={{ color: lead === m.id ? "var(--accent)" : "var(--text-3)" }}
                        onClick={(e) => { e.preventDefault(); setLead(m.id); }}>
                        {lead === m.id ? "★ responsable" : "hacer responsable"}
                      </button>
                    ) : null
                  )}
                </label>
              ))}
            </div>
          </div>

          <button className="btn-primary w-full mt-1" disabled={creating} onClick={createProject}>
            {creating ? "Creando…" : "Crear actividad"}
          </button>
        </div>
      </Sheet>
    </>
  );
}
