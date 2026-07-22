"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Pill, Sheet, useToast, SelectField, CheckBox } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import { IconDownload } from "@/components/icons";
import { logAdminAction } from "@/lib/admin-log";
import { STATUS_LABELS } from "@/lib/types";
import type { RequestType, RequestStatus, Priority } from "@/lib/types";
import { STATUS_TONE, PRIORITY_TONE } from "@/lib/ui-maps";
import { PrintButton } from "../reportes/print-button";
import { fmtMin } from "@/lib/hours";
import { dmy, todayMerida } from "@/lib/tz";
import { isBirthdayToday, todayISO } from "@/lib/birthday";

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
  project_assignments: { is_lead: boolean; users: { id: string; display_name: string; full_name: string; nexus_color: string | null; avatar_url: string | null; birth_date: string | null } }[];
};
export type DepRow = {
  id: string; project_id: string; depends_on_project_id: string;
  projects: { id: string; status: string; requests: { title: string } | null } | null;
};
type Member = { id: string; display_name: string; full_name: string; nexus_color: string | null; avatar_url: string | null; birth_date: string | null };
type ActTypeOpt = { key: string; label: string };

const PRIORITIES: Priority[] = ["baja", "normal", "alta", "urgente"];

/** Reporte HTML de Actividades agrupadas por persona — título, tipo, estado,
 * prioridad y entrega de cada quien, más el total de horas registradas
 * (histórico, vía task_time_logs) por persona. */
function printByEmployeeReport(
  team: Member[], projects: ProjectRow[], hoursByUserMin: Record<string, number>, typeLabel: Record<string, string>,
) {
  const today = dmy(todayMerida());
  const byUser = new Map<string, ProjectRow[]>();
  for (const p of projects) {
    for (const a of p.project_assignments) {
      const arr = byUser.get(a.users.id) ?? [];
      arr.push(p);
      byUser.set(a.users.id, arr);
    }
  }
  const sections = team.map((m) => {
    const mine = (byUser.get(m.id) ?? []).slice().sort((a, b) => (b.deadline ?? "").localeCompare(a.deadline ?? ""));
    const color = m.nexus_color || "#5856D6";
    const initial = (m.display_name || m.full_name || "?").charAt(0).toUpperCase();
    const min = hoursByUserMin[m.id] ?? 0;
    const horasTxt = min > 0 ? fmtMin(min) : "—";
    const rows = mine.map((p) => {
      const statusBg = p.status === "completada" ? "#D1FAE5" : p.status === "cancelada" ? "#FEE2E2" : "#DBEAFE";
      const statusFg = p.status === "completada" ? "#065F46" : p.status === "cancelada" ? "#991B1B" : "#1D4ED8";
      return `<tr>
        <td style="padding:9px 12px">${p.requests?.title ?? "Actividad"}</td>
        <td style="padding:9px 12px;color:#6B7280">${p.requests ? (typeLabel[p.requests.type] ?? p.requests.type) : "—"}</td>
        <td style="padding:9px 12px"><span style="background:${statusBg};color:${statusFg};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">${STATUS_LABELS[p.status as RequestStatus] ?? p.status}</span></td>
        <td style="padding:9px 12px;text-transform:capitalize">${p.priority}</td>
        <td style="padding:9px 12px;color:#6B7280">${p.deadline ? p.deadline.split("-").reverse().join("/") : "—"}</td>
      </tr>`;
    }).join("");
    return `<div class="card">
      <div style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;background:${color}14">
        <span style="display:flex;align-items:center;gap:10px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:${color};color:#fff;font-size:13px;font-weight:800">${initial}</span>
          <strong style="font-size:14px">${m.full_name}</strong>
        </span>
        <span style="font-size:12px;color:#6B7280">${mine.length} actividad${mine.length === 1 ? "" : "es"} · <strong style="color:${color}">${horasTxt}</strong> registradas</span>
      </div>
      <table><thead><tr><th>Actividad</th><th>Tipo</th><th>Estado</th><th>Prioridad</th><th>Entrega</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="padding:12px;color:#9CA3AF">Sin actividades asignadas</td></tr>'}</tbody></table>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Actividades por empleado — ${today}</title>
    <style>
      *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#F3F4F6;margin:0;padding:24px;color:#111827}
      .wrap{max-width:900px;margin:0 auto}
      .header{background:linear-gradient(135deg,#1E293B,#334155);border-radius:16px;padding:28px 32px;margin-bottom:20px;color:#fff}
      .header h1{margin:0 0 4px;font-size:22px;font-weight:800}.header p{margin:0;color:#94A3B8;font-size:13px}
      .card{background:#fff;border-radius:14px;margin-bottom:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.07)}
      table{width:100%;border-collapse:collapse;font-size:12.5px}
      th{padding:9px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;border-bottom:1px solid #F1F5F9}
      td{border-bottom:.5px solid #F1F5F9}tr:last-child td{border-bottom:none}
      @media print{body{background:#fff;padding:0}.no-print{display:none}}
    </style></head><body><div class="wrap">
    <div class="header"><h1>Actividades por empleado</h1><p>CERT Comunicación · Generado el ${today}</p></div>
    <div class="no-print" style="text-align:right;margin-bottom:12px">
      <button onclick="window.print()" style="padding:10px 22px;background:#1E293B;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Imprimir / Guardar PDF</button>
    </div>
    ${sections}
    </div></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

export default function ProyectosClient({ projects, dependencies, typeLabel, types, team, hoursByUserMin, adminId }: {
  projects: ProjectRow[]; dependencies: DepRow[]; typeLabel: Record<string, string>;
  types: ActTypeOpt[]; team: Member[]; hoursByUserMin: Record<string, number>; adminId: string;
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

  const activitiesCsvHref = useMemo(() => {
    const rows = [
      ["Actividad", "Tipo", "Estado", "Prioridad", "Entrega", "Responsable", "Asignados"],
      ...projects.map((p) => {
        const asgs = p.project_assignments ?? [];
        const lead = asgs.find((a) => a.is_lead)?.users ?? asgs[0]?.users ?? null;
        return [
          p.requests?.title ?? "Actividad", p.requests ? (typeLabel[p.requests.type] ?? p.requests.type) : "—",
          STATUS_LABELS[p.status as RequestStatus] ?? p.status, p.priority,
          p.deadline ?? "", lead?.display_name ?? "", asgs.map((a) => a.users.display_name).join(" · "),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join(String.fromCharCode(10));
    return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  }, [projects, typeLabel]);

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

    if (adminId) logAdminAction(supabase, adminId, "Creó actividad directa", form.title.trim());
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
          {pending.length > 0 && <Pill tone="danger"><span className="inline-flex items-center gap-1"><Icon name="lock" size={11} /> Bloqueada</span></Pill>}
        </div>
        <h3 className="text-[15px] font-bold leading-snug">{titleOf(p)}</h3>
        <div className="flex items-center justify-between mt-3">
          <div className="flex -space-x-2">
            {asgs.map((a, i) => (
              <div key={i} title={a.users.display_name + (a.is_lead ? " (responsable)" : "")}
                style={{ border: "2px solid var(--surface)", borderRadius: "100px" }}>
                <Avatar name={a.users.display_name} color={a.users.nexus_color} avatarUrl={a.users.avatar_url} size={28} birthday={isBirthdayToday(a.users.birth_date, todayISO())} />
              </div>
            ))}
          </div>
          {p.deadline && (
            <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              entrega {dmy(p.deadline)}
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
                  <span className="truncate flex items-center gap-1" style={{ color: blocked ? "var(--danger)" : "var(--ok)" }}>
                    <Icon name={blocked ? "lock" : "check"} size={11} /> {d.projects?.requests?.title ?? "Actividad"}
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
              <SelectField className="flex-1" value={picked} onChange={setPicked}>
                <option value="">— elige una actividad —</option>
                {otherOptions.map((o) => (
                  <option key={o.id} value={o.id}>{titleOf(o)}</option>
                ))}
              </SelectField>
              <button className="btn-secondary text-[12px] px-2.5 py-1.5" disabled={saving} onClick={() => addDependency(p.id)}>
                Agregar
              </button>
              <button className="text-[12px]" style={{ color: "var(--text-3)" }} onClick={() => { setOpen(null); setPicked(""); }}>
                <Icon name="close" size={13} />
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
        <div className="flex items-center gap-2">
          <a href={activitiesCsvHref} download="actividades.csv" className="btn-secondary text-[13px] px-4 py-2 flex items-center gap-1.5"
            onClick={() => { if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", "actividades.csv"); }}>
            <IconDownload className="w-3.5 h-3.5" /> Exportar CSV
          </a>
          <button className="btn-secondary text-[13px] px-4 py-2 flex items-center gap-1.5"
            onClick={() => {
              if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", "actividades-por-empleado.html");
              printByEmployeeReport(team, projects, hoursByUserMin, typeLabel);
            }}>
            <IconDownload className="w-3.5 h-3.5" /> Por empleado
          </button>
          <PrintButton />
          <button className="btn-primary text-[13px] px-4 py-2" onClick={openAdd}>
            + Añadir proyecto
          </button>
        </div>
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
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: "var(--text-2)" }}>Nombre de la actividad</label>
            <input className="field-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ej. Actualización del sitio web" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Tipo" value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </SelectField>
            <SelectField label="Prioridad" value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}>
              {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
            </SelectField>
          </div>

          <div>
            <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: "var(--text-2)" }}>Fecha de entrega (opcional)</label>
            <input type="date" className="field-input" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
          </div>

          <div>
            <label className="text-[12px] font-semibold mb-2 block" style={{ color: "var(--text-2)" }}>Asignar a</label>
            <div className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto pr-0.5">
              {team.map((m) => (
                <label key={m.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm cursor-pointer transition-colors"
                  style={{
                    background: assignees.includes(m.id) ? "var(--accent-tint)" : "var(--surface-2)",
                    border: assignees.includes(m.id) ? "1px solid var(--accent)" : "1px solid transparent",
                  }}>
                  <input type="checkbox" className="hidden" checked={assignees.includes(m.id)} onChange={() => toggleAssignee(m.id)} />
                  <CheckBox checked={assignees.includes(m.id)} />
                  <Avatar name={m.display_name} color={m.nexus_color} avatarUrl={m.avatar_url} size={26} birthday={isBirthdayToday(m.birth_date, todayISO())} />
                  <span className="text-[13px] font-medium flex-1">{m.display_name}</span>
                  {assignees.includes(m.id) && (
                    assignees.length > 1 ? (
                      <button className="text-[11px] font-semibold shrink-0"
                        style={{ color: lead === m.id ? "var(--accent)" : "var(--text-3)" }}
                        onClick={(e) => { e.preventDefault(); setLead(m.id); }}>
                        {lead === m.id ? <span className="inline-flex items-center gap-1"><Icon name="star" size={10} /> responsable</span> : "hacer responsable"}
                      </button>
                    ) : null
                  )}
                </label>
              ))}
            </div>
          </div>

          <button className="btn-primary w-full mt-1 py-3" disabled={creating} onClick={createProject}>
            {creating ? "Creando…" : "Crear actividad"}
          </button>
        </div>
      </Sheet>
    </>
  );
}
