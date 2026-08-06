"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Pill, Sheet, useToast, CheckBox, DatePicker, Menu, MenuItem, Select, SlidingSegments } from "@/components/ui";
import { EmptyState, Field } from "@/components/shared";
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
import { usePersistedView } from "@/lib/persisted-view";
import { notifyUser } from "@/lib/notify";

/* ═══════════════════════════════════════════════════════════════
   Dependencias entre Actividades — Plano Maestro §04.
   Una actividad puede bloquearse hasta que otra sea completada,
   para evitar errores operativos (ej. no armar la Landing Page
   antes de que el Diseño Principal esté terminado). El bloqueo
   real vive en la BD (trigger sobre task_time_logs); esta UI solo
   administra qué depende de qué.
   ═══════════════════════════════════════════════════════════════ */

export type ProjectRow = {
  id: string; status: string; priority: string; deadline: string | null; completed_at: string | null; created_at: string;
  requests: { title: string; type: RequestType } | null;
  project_assignments: {
    is_lead: boolean;
    users: { id: string; display_name: string; full_name: string; nexus_color: string | null; avatar_url: string | null; birth_date: string | null };
    project_checklist?: { done: boolean }[];
  }[];
};
export type DepRow = {
  id: string; project_id: string; depends_on_project_id: string;
  projects: { id: string; status: string; requests: { title: string } | null } | null;
};
/** Solicitud sin triar (status "solicitada") — Fase 3, columna "Solicitada"
    de la vista Pipeline. Solo lectura aquí: aprobar/rechazar sigue siendo
    responsabilidad de Solicitudes (evita duplicar esa lógica). */
export type PendingRequestRow = {
  id: string; title: string; type: RequestType; requester_name: string | null;
  priority: string; created_at: string;
};
type Member = { id: string; display_name: string; full_name: string; nexus_color: string | null; avatar_url: string | null; birth_date: string | null };
type ActTypeOpt = { key: string; label: string };

const PRIORITIES: Priority[] = ["baja", "normal", "alta", "urgente"];

/** Etapas del flujo Solicitud → Actividad, en orden — Fase 3. "Pausada" y
    "Cancelada" son estados terminales fuera del flujo activo, así que no
    tienen columna propia (siguen visibles en la vista Lista → Cerrados). */
const PIPELINE_STAGES: { key: RequestStatus; label: string }[] = [
  { key: "solicitada", label: "Solicitada" },
  { key: "aprobada", label: "Aprobada" },
  { key: "en_progreso", label: "En progreso" },
  { key: "en_revision", label: "En revisión" },
  { key: "completada", label: "Completada" },
];

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
        <td style="padding:9px 12px"><span style="background:${statusBg};color:${statusFg};padding:2px 8px;border-radius:20px;font-size:12px;font-weight:700">${STATUS_LABELS[p.status as RequestStatus] ?? p.status}</span></td>
        <td style="padding:9px 12px;text-transform:capitalize">${p.priority}</td>
        <td style="padding:9px 12px;color:#6B7280">${p.deadline ? p.deadline.split("-").reverse().join("/") : "—"}</td>
      </tr>`;
    }).join("");
    return `<div class="card">
      <div style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;background:${color}14">
        <span style="display:flex;align-items:center;gap:10px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:${color};color:#fff;font-size:13.5px;font-weight:800">${initial}</span>
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
      *{box-sizing:border-box}body{font-family:-apple-system,"SF Pro Display","SF Pro Text",Inter,sans-serif;background:#F3F4F6;margin:0;padding:24px;color:#111827}
      .wrap{max-width:900px;margin:0 auto}
      .header{background:linear-gradient(135deg,#1E293B,#334155);border-radius:16px;padding:28px 32px;margin-bottom:20px;color:#fff}
      .header h1{margin:0 0 4px;font-size:21px;font-weight:800}.header p{margin:0;color:#94A3B8;font-size:13.5px}
      .card{background:#fff;border-radius:14px;margin-bottom:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.07)}
      table{width:100%;border-collapse:collapse;font-size:12.5px}
      th{padding:9px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;border-bottom:1px solid #F1F5F9}
      td{border-bottom:.5px solid #F1F5F9}tr:last-child td{border-bottom:none}
      @media print{body{background:#fff;padding:0}.no-print{display:none}}
    </style></head><body><div class="wrap">
    <div class="header"><h1>Actividades por empleado</h1><p>CERT Comunicación · Generado el ${today}</p></div>
    <div class="no-print" style="text-align:right;margin-bottom:12px">
      <button onclick="window.print()" style="padding:10px 22px;background:#1E293B;color:#fff;border:none;border-radius:10px;font-size:13.5px;font-weight:700;cursor:pointer">Imprimir / Guardar PDF</button>
    </div>
    ${sections}
    </div></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

export default function ProyectosClient({ projects, dependencies, pendingRequests, typeLabel, types, team, hoursByUserMin, adminId }: {
  projects: ProjectRow[]; dependencies: DepRow[]; pendingRequests: PendingRequestRow[]; typeLabel: Record<string, string>;
  types: ActTypeOpt[]; team: Member[]; hoursByUserMin: Record<string, number>; adminId: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [view, setView] = usePersistedView<"Lista" | "Pipeline">("proyectos-view", ["Lista", "Pipeline"], "Lista");
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
    if (error || !data) { toast("No se pudo agregar la dependencia", "danger"); return; }
    setDeps((d) => [...d, data as unknown as DepRow]);
    setPicked("");
    setOpen(null);
    toast("Dependencia agregada");
  };

  const removeDependency = async (depId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("project_dependencies").delete().eq("id", depId);
    if (error) { toast("No se pudo quitar", "danger"); return; }
    setDeps((d) => d.filter((x) => x.id !== depId));
    toast("Dependencia eliminada");
  };

  // Cierra el hueco del pipeline (Fase 3, auditoría): antes ningún botón ni
  // trigger de BD llevaba un proyecto de "en_revision" a "completada" — se
  // quedaba ahí para siempre salvo edición manual en Supabase.
  const markCompleted = async (projectId: string, title: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("projects")
      .update({ status: "completada", completed_at: new Date().toISOString() })
      .eq("id", projectId);
    if (error) { toast("No se pudo marcar como completada", "danger"); return; }
    if (adminId) logAdminAction(supabase, adminId, "Marcó actividad como completada", title);
    toast("Actividad completada");

    // Auditoría de notificaciones: quien hizo el trabajo (los asignados de
    // project_assignments) nunca se enteraba de que su actividad ya quedó
    // aprobada — mismo hueco que markReview() en comunicacion/tasks.tsx,
    // del otro lado del flujo. Se consulta aparte (no viene en el ProjectRow
    // que ya tiene la fila en pantalla) para no tener que hacer pasar la
    // lista de asignados por props hasta este punto.
    const { data: assigned } = await supabase
      .from("project_assignments").select("user_id").eq("project_id", projectId);
    for (const a of assigned ?? []) {
      notifyUser(supabase, a.user_id, "Tu actividad fue aprobada", title, "request", `/comunicacion?task=${projectId}`);
    }

    router.refresh();
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
    if (e1 || !req) { setCreating(false); toast("No se pudo registrar la actividad", "danger"); return; }

    const { data: prj, error: e2 } = await supabase.from("projects").insert({
      request_id: req.id, lead_user_id: lead, status: "aprobada",
      priority: form.priority, deadline: form.deadline || null,
    }).select("id").single();
    if (e2 || !prj) { setCreating(false); toast("No se pudo crear el proyecto", "danger"); return; }

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

    // Auditoría de notificaciones: cuando la actividad nace de una Solicitud
    // aprobada SÍ se avisa a los asignados (admin/solicitudes/client.tsx),
    // pero esta ruta paralela (creación directa por admin) los dejaba sin
    // enterarse de que tenían trabajo nuevo — mismo criterio, mismo mensaje.
    for (const uid of assignees) {
      notifyUser(supabase, uid, "Te asignaron una actividad", form.title.trim(), "request", `/comunicacion?task=${prj.id}`);
    }

    setCreating(false);
    setAddOpen(false);
    toast("Actividad creada");
    router.refresh();
  };

  return (
    <>
      {/* Encabezado con mejor jerarquía */}
      <header className="pt-4 pb-6 md:pt-8 md:pb-8">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-[28px] md:text-[40px] font-bold tracking-tight text-text-1 leading-none">Actividades</h1>
            <p className="text-[15px] md:text-[16px] mt-2" style={{ color: "var(--text-2)" }}>
              Gestiona las actividades y proyectos del equipo
            </p>
          </div>

          {/* Botones: uno principal, otros ghost */}
          <div className="flex items-center gap-2">
            {/* Móvil */}
            <div className="flex md:hidden items-center gap-2">
              <Menu
                align="right"
                trigger={({ onClick }) => (
                  <button className="h-9 w-9 rounded-lg grid place-items-center hover:bg-hover transition-colors" onClick={onClick}>
                    <Icon name="more" size={18} />
                  </button>
                )}
              >
                <MenuItem icon={<IconDownload className="w-3.5 h-3.5" />} href={activitiesCsvHref} download="actividades.csv"
                  onClick={() => { if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", "actividades.csv"); }}>
                  Exportar CSV
                </MenuItem>
                <MenuItem icon={<IconDownload className="w-3.5 h-3.5" />}
                  onClick={() => {
                    if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", "actividades-por-empleado.html");
                    printByEmployeeReport(team, projects, hoursByUserMin, typeLabel);
                  }}>
                  Por empleado
                </MenuItem>
                <MenuItem icon={<IconDownload className="w-3.5 h-3.5" />} onClick={() => window.print()}>
                  Guardar como PDF
                </MenuItem>
              </Menu>
            </div>

            {/* Escritorio */}
            <div className="hidden md:flex items-center gap-2">
              <button className="h-9 px-3 rounded-lg text-[13.5px] font-medium text-text-2 hover:bg-hover transition-colors flex items-center gap-1.5"
                onClick={() => {
                  if (adminId) logAdminAction(createClient(), adminId, "Exportó reporte", "actividades.csv");
                  const link = document.createElement('a');
                  link.href = activitiesCsvHref;
                  link.download = 'actividades.csv';
                  link.click();
                }}>
                <IconDownload className="w-3.5 h-3.5" /> Exportar
              </button>
            </div>

            {/* Botón principal */}
            <button 
              className="h-10 px-5 rounded-xl bg-accent hover:bg-accent/90 text-white font-semibold text-[14px] shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-200 hover:-translate-y-0.5 flex items-center gap-2"
              onClick={openAdd}
            >
              <Icon name="plus" size={16} />
              <span className="hidden sm:inline">Añadir proyecto</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          </div>
        </div>

        {/* Contadores y selector de vista */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <span className="text-[14px] font-semibold" style={{ color: "var(--text-2)" }}>
              {active.length} <span style={{ color: "var(--text-3)" }}>activos</span>
            </span>
            <span className="w-px h-4" style={{ background: "var(--border)" }} />
            <span className="text-[14px] font-semibold" style={{ color: "var(--text-2)" }}>
              {done.length} <span style={{ color: "var(--text-3)" }}>cerrados</span>
            </span>
          </div>

          {/* Selector Lista/Pipeline estilo Apple */}
          <div className="relative inline-flex rounded-xl p-1" style={{ background: "var(--surface-2)" }}>
            <div 
              className="absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-out"
              style={{ 
                background: "var(--surface)",
                width: "calc(50% - 4px)",
                left: view === "Lista" ? "4px" : "calc(50% + 0px)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
              }}
            />
            <button
              className="relative z-10 h-8 px-4 rounded-lg text-[13.5px] font-semibold transition-colors"
              style={{ color: view === "Lista" ? "var(--text-1)" : "var(--text-3)" }}
              onClick={() => setView("Lista")}
            >
              Lista
            </button>
            <button
              className="relative z-10 h-8 px-4 rounded-lg text-[13.5px] font-semibold transition-colors"
              style={{ color: view === "Pipeline" ? "var(--text-1)" : "var(--text-3)" }}
              onClick={() => setView("Pipeline")}
            >
              Pipeline
            </button>
          </div>
        </div>
      </header>

      {view === "Lista" ? (
        <>
          {/* Vista Lista tipo Notion - filas compactas */}
          {active.length === 0 ? (
            <div className="mb-6">
              <EmptyState
                icon={<Icon name="layers" size={22} />}
                title="Sin actividades activas"
                hint="Aprueba una solicitud o añade una directamente."
                action={<button className="btn-primary text-[13.5px] px-4 py-2" onClick={openAdd}>+ Añadir proyecto</button>}
              />
            </div>
          ) : (
            <div className="mb-8">
              {/* Header de tabla */}
              <div className="hidden md:grid grid-cols-[1fr_120px_140px_100px_80px_40px] gap-4 px-4 py-2 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
                <span>Actividad</span>
                <span>Estado</span>
                <span>Responsable</span>
                <span>Entrega</span>
                <span>Prioridad</span>
                <span></span>
              </div>

              {/* Filas de actividades */}
              <div className="flex flex-col">
                {active.map((p) => (
                  <ProjectRow key={p.id} p={p} deps={depsOf.get(p.id) ?? []} typeLabel={typeLabel} onMarkCompleted={markCompleted} />
                ))}
              </div>
            </div>
          )}

          {done.length > 0 && (
            <>
              <h2 className="text-[19px] font-bold mb-3" style={{ color: "var(--text-2)" }}>Cerrados</h2>
              <div className="flex flex-col opacity-60">
                {done.map((p) => (
                  <ProjectRow key={p.id} p={p} deps={depsOf.get(p.id) ?? []} typeLabel={typeLabel} onMarkCompleted={markCompleted} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <PipelineBoard
          projects={projects} pendingRequests={pendingRequests} typeLabel={typeLabel}
          onMarkCompleted={markCompleted} onGoToList={() => setView("Lista")}
        />
      )}

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Añadir proyecto" subtitle="Crea una actividad directamente, sin pasar por Solicitudes">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: "var(--text-2)" }}>Nombre de la actividad</label>
            <input className="field-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ej. Actualización del sitio web" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select
                value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))}
                title="Tipo" searchable={false}
                options={types.map((t) => ({ value: t.key, label: t.label }))}
              />
            </Field>
            <Field label="Prioridad">
              <Select
                value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}
                title="Prioridad" searchable={false}
                options={PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
              />
            </Field>
          </div>

          <div>
            <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: "var(--text-2)" }}>Fecha de entrega (opcional)</label>
            <DatePicker value={form.deadline} onChange={(v) => setForm((f) => ({ ...f, deadline: v }))} />
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
                  <span className="text-[13.5px] font-medium flex-1">{m.display_name}</span>
                  {assignees.includes(m.id) && (
                    assignees.length > 1 ? (
                      <button className="text-[12px] font-semibold shrink-0"
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

/* ═══════════════════════════════════════════════════════════════
   ProjectRow — Fila tipo Notion para la vista Lista
   ═══════════════════════════════════════════════════════════════ */
function ProjectRow({ p, deps, typeLabel, onMarkCompleted }: { 
  p: ProjectRow; deps: DepRow[]; typeLabel: Record<string, string>;
  onMarkCompleted: (id: string, title: string) => void;
}) {
  const asgs = p.project_assignments ?? [];
  const lead = asgs.find((a) => a.is_lead)?.users ?? asgs[0]?.users ?? null;
  const pending = deps.filter((d) => d.projects && d.projects.status !== "completada");
  const title = p.requests?.title ?? "Actividad";

  // Colores por estado
  const statusColors: Record<string, { bg: string; fg: string }> = {
    solicitada: { bg: "#F1F5F9", fg: "#475569" },
    aprobada: { bg: "#DBEAFE", fg: "#1D4ED8" },
    en_progreso: { bg: "#E9D5FF", fg: "#6B21A8" },
    en_revision: { bg: "#FEF3C7", fg: "#92400E" },
    completada: { bg: "#D1FAE5", fg: "#065F46" },
    cancelada: { bg: "#FEE2E2", fg: "#991B1B" },
    pausada: { bg: "#F1F5F9", fg: "#475569" },
  };

  const statusColor = statusColors[p.status] || { bg: "#F1F5F9", fg: "#475569" };
  const statusLabel = STATUS_LABELS[p.status as RequestStatus] ?? p.status;

  const priorityColors: Record<string, string> = {
    baja: "var(--text-3)",
    normal: "var(--text-2)",
    alta: "var(--warn)",
    urgente: "var(--danger)",
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00Z");
    const day = date.getUTCDate();
    const month = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][date.getUTCMonth()];
    return `${day} ${month}`;
  };

  return (
    <div className="group grid grid-cols-1 md:grid-cols-[1fr_120px_140px_100px_80px_40px] gap-2 md:gap-4 px-4 py-3 rounded-xl hover:bg-hover transition-all duration-200 cursor-pointer border border-transparent hover:border-border">
      {/* Título + badges */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold text-text-1 truncate group-hover:text-accent transition-colors">{title}</h3>
            {pending.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                <Icon name="lock" size={10} /> Bloqueada
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[12px] text-text-3">{p.requests ? (typeLabel[p.requests.type] ?? p.requests.type) : "—"}</span>
            {asgs.length > 1 && (
              <span className="text-[12px] text-text-3">+{asgs.length - 1}</span>
            )}
          </div>
        </div>
      </div>

      {/* Estado */}
      <div className="flex items-center">
        <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: statusColor.bg, color: statusColor.fg }}>
          {statusLabel}
        </span>
      </div>

      {/* Responsable */}
      <div className="flex items-center gap-2">
        {lead ? (
          <>
            <Avatar name={lead.display_name} color={lead.nexus_color} avatarUrl={lead.avatar_url} size={24} birthday={isBirthdayToday(lead.birth_date, todayISO())} />
            <span className="text-[13.5px] font-medium text-text-2 truncate hidden lg:block">{lead.display_name}</span>
          </>
        ) : (
          <span className="text-[13.5px] text-text-3">Sin asignar</span>
        )}
      </div>

      {/* Entrega */}
      <div className="flex items-center gap-1.5">
        {p.deadline ? (
          <>
            <Icon name="calendar" size={13} className="text-text-3" />
            <span className="text-[13.5px] font-medium text-text-2">{formatDate(p.deadline)}</span>
          </>
        ) : (
          <span className="text-[13.5px] text-text-3">—</span>
        )}
      </div>

      {/* Prioridad */}
      <div className="flex items-center">
        {(p.priority as Priority) !== "normal" && (
          <span className="text-[12px] font-semibold capitalize" style={{ color: priorityColors[p.priority] || "var(--text-2)" }}>
            {p.priority}
          </span>
        )}
      </div>

      {/* Acciones en hover */}
      <div className="hidden md:flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="h-7 w-7 rounded-lg grid place-items-center hover:bg-surface-2 transition-colors">
          <Icon name="more" size={14} className="text-text-3" />
        </button>
      </div>

      {/* Acciones rápidas para "En revisión" */}
      {p.status === "en_revision" && (
        <div className="md:col-span-6 flex justify-end">
          <button 
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-200 hover:scale-105"
            style={{ background: "var(--ok-tint)", color: "var(--ok)" }}
            onClick={(e) => { e.stopPropagation(); onMarkCompleted(p.id, title); }}
          >
            <Icon name="check" size={12} /> Marcar completada
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PipelineBoard — Inspirado en Plane, con colores por estado
   ═══════════════════════════════════════════════════════════════ */
const COMPLETADA_VISIBLE = 8;

function PipelineBoard({ projects, pendingRequests, typeLabel, onMarkCompleted, onGoToList }: {
  projects: ProjectRow[]; pendingRequests: PendingRequestRow[]; typeLabel: Record<string, string>;
  onMarkCompleted: (id: string, title: string) => void; onGoToList: () => void;
}) {
  const byStage = useMemo(() => {
    const m = new Map<string, ProjectRow[]>();
    for (const p of projects) (m.get(p.status) ?? m.set(p.status, []).get(p.status)!).push(p);
    return m;
  }, [projects]);
  const completadas = (byStage.get("completada") ?? [])
    .slice()
    .sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at));

  // Colores por columna
  const columnColors: Record<string, string> = {
    solicitada: "var(--text-3)",
    aprobada: "var(--accent)",
    en_progreso: "var(--purple)",
    en_revision: "var(--warn)",
    completada: "var(--ok)",
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00Z");
    const day = date.getUTCDate();
    const month = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][date.getUTCMonth()];
    return `${day} ${month}`;
  };

  const PriorityPill = ({ priority }: { priority: string }) => {
    const colors: Record<string, string> = {
      baja: "var(--text-3)",
      normal: "var(--text-2)",
      alta: "var(--warn)",
      urgente: "var(--danger)",
    };
    return (priority as Priority) !== "normal" ? (
      <span className="text-[12px] font-semibold capitalize" style={{ color: colors[priority] || "var(--text-2)" }}>
        {priority}
      </span>
    ) : null;
  };

  const RequestCard = ({ r }: { r: PendingRequestRow }) => (
    <Link href="/admin/solicitudes" className="group block p-4 rounded-2xl bg-surface hover:bg-surface-2 border border-border hover:border-border-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
          {typeLabel[r.type] ?? r.type}
        </span>
        <PriorityPill priority={r.priority} />
      </div>
      <p className="text-[14px] font-semibold text-text-1 leading-snug truncate group-hover:text-accent transition-colors">{r.title}</p>
      <p className="text-[12px] text-text-3 truncate mt-1">{r.requester_name ?? "—"}</p>
      <span className="text-[12px] font-semibold mt-2 inline-block" style={{ color: "var(--accent)" }}>Revisar en Solicitudes →</span>
    </Link>
  );

  const ProjectCard = ({ p }: { p: ProjectRow }) => {
    const asgs = p.project_assignments ?? [];
    const lead = asgs.find((a) => a.is_lead)?.users ?? asgs[0]?.users ?? null;
    return (
      <div className="group p-4 rounded-2xl bg-surface hover:bg-surface-2 border border-border hover:border-border-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
            {p.requests ? (typeLabel[p.requests.type] ?? p.requests.type) : "—"}
          </span>
          <PriorityPill priority={p.priority} />
        </div>
        <p className="text-[15px] font-semibold text-text-1 leading-snug truncate group-hover:text-accent transition-colors">{p.requests?.title ?? "Actividad"}</p>
        
        <div className="flex items-center justify-between mt-3">
          {lead ? (
            <span className="inline-flex items-center gap-2 min-w-0">
              <Avatar name={lead.display_name} color={lead.nexus_color} avatarUrl={lead.avatar_url} size={24} birthday={isBirthdayToday(lead.birth_date, todayISO())} />
              <span className="text-[12px] font-medium text-text-2 truncate">{lead.display_name}</span>
            </span>
          ) : <span className="text-[12px] text-text-3">Sin asignar</span>}
          {p.deadline && (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-text-3">
              <Icon name="calendar" size={11} /> {formatDate(p.deadline)}
            </span>
          )}
        </div>

        {p.status === "en_revision" && (
          <button 
            className="w-full mt-3 text-[12px] font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200 hover:scale-[1.02]"
            style={{ background: "var(--ok-tint)", color: "var(--ok)" }}
            onClick={() => onMarkCompleted(p.id, p.requests?.title ?? "Actividad")}
          >
            <Icon name="check" size={12} /> Marcar completada
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <style jsx>{`div::-webkit-scrollbar { display: none; }`}</style>
      {PIPELINE_STAGES.map((stage) => {
        const items = stage.key === "solicitada" ? pendingRequests
          : stage.key === "completada" ? completadas.slice(0, COMPLETADA_VISIBLE)
          : byStage.get(stage.key) ?? [];
        const total = stage.key === "solicitada" ? pendingRequests.length
          : stage.key === "completada" ? completadas.length
          : (byStage.get(stage.key) ?? []).length;
        
        const color = columnColors[stage.key] || "var(--text-3)";

        return (
          <div key={stage.key} className="flex flex-col shrink-0 w-[280px] md:w-[300px]">
            {/* Header de columna */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[13.5px] font-semibold text-text-1">{stage.label}</span>
              </div>
              <span className="text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
                {total}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 min-h-[100px]">
              {items.length === 0 ? (
                <div className="text-[12px] text-center py-8 text-text-3">
                  Sin actividades
                </div>
              ) : stage.key === "solicitada" ? (
                (items as PendingRequestRow[]).map((r) => <RequestCard key={r.id} r={r} />)
              ) : (
                (items as ProjectRow[]).map((p) => <ProjectCard key={p.id} p={p} />)
              )}
              {stage.key === "completada" && total > COMPLETADA_VISIBLE && (
                <button className="text-[12px] font-semibold text-center py-2 hover:text-accent transition-colors" style={{ color: "var(--accent)" }} onClick={onGoToList}>
                  Ver las {total} en Lista →
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
