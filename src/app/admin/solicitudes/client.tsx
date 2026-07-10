"use client";
// Solicitudes de comunicación · flujo de aprobación del admin
// Al aprobar: crea project + assignments (múltiple, con responsable
// principal) + copia el checklist de la plantilla según el tipo.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast, Sheet, Pill, Avatar, SlidingSegments } from "@/components/ui";
import { STATUS_LABELS } from "@/lib/types";
import type { CommRequest, Priority, RequestStatus } from "@/lib/types";

type Member = { id: string; display_name: string; nexus_color: string | null; specialties: string[] };

import { STATUS_TONE, PRIORITY_TONE } from "@/lib/ui-maps";
import { requestCalendarUrl } from "@/lib/gcal";
import { logAdminAction } from "@/lib/admin-log";

const PRIORITIES: Priority[] = ["baja", "normal", "alta", "urgente"];

/** Prioridad automática sugerida por cercanía del evento (48h→urgente, 96h→alta). */
function suggestedPriority(r: CommRequest): Priority {
  if (!r.event_date) return "normal";
  const hrs = (new Date(r.event_date + "T" + (r.event_time ?? "09:00")).getTime() - Date.now()) / 36e5;
  if (hrs <= 48) return "urgente";
  if (hrs <= 96) return "alta";
  return "normal";
}

export default function SolicitudesClient({ requests, team, typeLabel, minHours, adminId, activityCalendarId }: {
  requests: CommRequest[]; team: Member[]; typeLabel: Record<string, string>; minHours: Record<string, number>;
  adminId: string; activityCalendarId?: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<"Por revisar" | "Aprobadas" | "Rechazadas">("Por revisar");
  const [sel, setSel] = useState<CommRequest | null>(null);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [lead, setLead] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [deadline, setDeadline] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [addToCalendar, setAddToCalendar] = useState(true);


  const shown = useMemo(() => {
    if (tab === "Por revisar") return requests.filter((r) => r.status === "solicitada");
    if (tab === "Rechazadas") return requests.filter((r) => r.status === "cancelada");
    return requests.filter((r) => !["solicitada", "cancelada"].includes(r.status));
  }, [tab, requests]);

  const openApproval = (r: CommRequest) => {
    setSel(r);
    setAssignees([]);
    setLead("");
    setPriority(suggestedPriority(r));
    setDeadline(r.event_date ?? "");
    setRejecting(false);
    setRejectReason("");
  };

  const toggleAssignee = (id: string) => {
    setAssignees((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!next.includes(lead)) setLead(next[0] ?? "");
      if (next.length === 1) setLead(next[0]);
      return next;
    });
  };

  const approve = async () => {
    if (!sel) return;
    if (assignees.length === 0) { toast("Asigna al menos a una persona"); return; }
    if (!lead) { toast("Elige al responsable principal"); return; }
    setSaving(true);
    const supabase = createClient();

    // 1. actualizar solicitud
    const { error: e1 } = await supabase.from("requests")
      .update({ status: "aprobada", priority }).eq("id", sel.id);
    if (e1) { toast("No se pudo aprobar"); setSaving(false); return; }

    // 2. crear proyecto
    const { data: prj, error: e2 } = await supabase.from("projects").insert({
      request_id: sel.id, lead_user_id: lead, status: "aprobada",
      priority, deadline: deadline || null,
    }).select("id").single();
    if (e2 || !prj) { toast("No se pudo crear el proyecto"); setSaving(false); return; }

    // 3. asignaciones (múltiple con responsable)
    const { data: asgs } = await supabase.from("project_assignments")
      .insert(assignees.map((uid) => ({ project_id: prj.id, user_id: uid, is_lead: uid === lead })))
      .select("id, user_id");

    // 4. copiar checklist de la plantilla al responsable principal
    const { data: tpl } = await supabase.from("checklist_templates")
      .select("id, checklist_items(position, label)").eq("type", sel.type).single();
    const leadAsg = (asgs ?? []).find((a) => a.user_id === lead);
    if (tpl && leadAsg) {
      const items = (tpl.checklist_items as { position: number; label: string }[])
        .map((i) => ({ assignment_id: leadAsg.id, position: i.position, label: i.label }));
      if (items.length) await supabase.from("project_checklist").insert(items);
    }

    // Evento en Google Calendar si la solicitud tiene fecha.
    // Primero intentamos crearlo de verdad (Edge Function, requiere que quien
    // aprueba haya dado permiso de Calendar). Si no se puede (por ejemplo,
    // todavía no reconecta su cuenta de Google), usamos el enlace manual de
    // siempre para no bloquear la aprobación.
    if (addToCalendar && sel.event_date) {
      const start = `${sel.event_date}T${(sel.event_time ?? "09:00:00").slice(0, 8)}`;
      const startHour = Number((sel.event_time ?? "09:00:00").slice(0, 2));
      const end = `${sel.event_date}T${String(startHour + 1).padStart(2, "0")}:${(sel.event_time ?? "09:00:00").slice(3, 5)}:00`;
      const { data: gcalData, error: gcalError } = await supabase.functions.invoke("gcal-create-event", {
        body: {
          title: `${typeLabel[sel.type] ?? sel.type} — ${sel.title}`,
          details: `Proyecto Nexus · ${sel.notes ?? ""}`,
          location: sel.event_location ?? "",
          start,
          end,
          calendarId: activityCalendarId ?? undefined,
        },
      });
      const result = gcalData as { ok?: boolean; eventUrl?: string; eventId?: string; calendarId?: string } | null;
      if (gcalError || !result?.eventUrl) {
        window.open(requestCalendarUrl(sel, typeLabel), "_blank");
      } else if (result.eventId && prj?.id) {
        await supabase.from("projects").update({ calendar_event_id: result.eventId, calendar_id: result.calendarId ?? null }).eq("id", prj.id);
      }
    }

    if (adminId) logAdminAction(supabase, adminId, "Aprobó solicitud", sel.title);
    setSaving(false);
    setSel(null);
    toast("Proyecto creado y asignado");
    router.refresh();
  };

  const reject = async () => {
    if (!sel) return;
    if (!rejectReason.trim()) { toast("Escribe el motivo del rechazo"); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("requests")
      .update({ status: "cancelada", rejection_reason: rejectReason }).eq("id", sel.id);
    setSaving(false);
    if (error) { toast("No se pudo rechazar"); return; }
    if (adminId) logAdminAction(supabase, adminId, "Rechazó solicitud", sel.title);
    setSel(null);
    toast("Solicitud rechazada");
    router.refresh();
  };

  return (
    <>
      <header className="pt-8 pb-5 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Solicitudes</h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Aprueba, asigna y prioriza el trabajo de comunicación
          </p>
        </div>
        <SlidingSegments
          options={["Por revisar", "Aprobadas", "Rechazadas"]}
          value={tab}
          onChange={(v) => setTab(v as "Por revisar" | "Aprobadas" | "Rechazadas")}
        />
      </header>

      {shown.length === 0 && (
        <div className="card p-8 text-center">
          <p className="font-semibold text-[14px]">
            {tab === "Por revisar" ? "Sin solicitudes por revisar" : tab === "Aprobadas" ? "Sin solicitudes aprobadas" : "Sin solicitudes rechazadas"}
          </p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--text-2)" }}>
            {tab === "Por revisar" ? "Las nuevas solicitudes de coordinadores aparecerán aquí" : "Aparecerán aquí cuando cambien de estado"}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {shown.map((r) => (
          <div key={r.id} className="card card-hover p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <Pill tone="accent">{typeLabel[r.type] ?? r.type}</Pill>
                  <Pill tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Pill>
                  {r.priority !== "normal" && <Pill tone={PRIORITY_TONE[r.priority]}>{r.priority}</Pill>}
                </div>
                <h3 className="text-[15.5px] font-bold leading-snug">{r.title}</h3>
                <p className="text-[12.5px] mt-1" style={{ color: "var(--text-2)" }}>
                  {(r.users?.title ? r.users.title + " " : "") + (r.users?.full_name ?? r.requester_name ?? "Solicitante")}
                  {r.event_date && ` · evento ${r.event_date}${r.event_time ? " " + r.event_time.slice(0, 5) : ""}`}
                  {r.event_location && ` · ${r.event_location}`}
                </p>
                {r.subtype.length > 0 && (
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-3)" }}>{r.subtype.join(" · ")}</p>
                )}
                {r.notes && <p className="text-[12.5px] mt-1.5" style={{ color: "var(--text-2)" }}>{r.notes}</p>}
              </div>
              {r.status === "solicitada" && (
                <button onClick={() => openApproval(r)} className="btn-primary px-5 py-2.5 text-[13px] shrink-0">
                  Revisar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Sheet de aprobación */}
      <Sheet open={!!sel} onClose={() => setSel(null)} title={rejecting ? "Rechazar solicitud" : "Aprobar y asignar"}>
        {sel && !rejecting && (
          <div className="flex flex-col gap-4">
            <div className="rounded-sm px-4 py-3" style={{ background: "var(--surface-2)" }}>
              <p className="text-[13.5px] font-bold">{sel.title}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                {typeLabel[sel.type] ?? sel.type} · anticipación mínima {minHours[sel.type] ?? 72}h
              </p>
            </div>

            <div>
              <label className="text-[12px] font-semibold block mb-2" style={{ color: "var(--text-2)" }}>
                Asignar a <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(toca para incluir; estrella = responsable)</span>
              </label>
              <div className="flex flex-col gap-2">
                {team.map((m) => {
                  const included = assignees.includes(m.id);
                  const isLead = lead === m.id;
                  return (
                    <div key={m.id} className="flex items-center gap-2.5 rounded-sm px-3 py-2.5 cursor-pointer transition-colors"
                      style={{
                        border: included ? "1.5px solid var(--accent)" : "1px solid var(--border-2)",
                        background: included ? "var(--accent-tint)" : "var(--surface)",
                      }}
                      onClick={() => toggleAssignee(m.id)}>
                      <Avatar name={m.display_name} color={m.nexus_color} size={30} />
                      <div className="flex-1">
                        <p className="text-[13.5px] font-semibold">{m.display_name}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-3)" }}>{m.specialties.join(" · ") || "—"}</p>
                      </div>
                      {included && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setLead(m.id); }}
                          aria-label="Responsable principal"
                          className="text-[18px]"
                          style={{ opacity: isLead ? 1 : 0.25 }}>
                          ⭐
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Prioridad</label>
                <select className="field-input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Fecha de entrega</label>
                <input type="date" className="field-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
            </div>
            {sel.event_date && (
              <label className="flex items-center gap-2.5 text-[13px] font-semibold cursor-pointer">
                <input type="checkbox" checked={addToCalendar} onChange={(e) => setAddToCalendar(e.target.checked)}
                  className="w-[18px] h-[18px] accent-[var(--accent)]" />
                Crear evento en Google Calendar
              </label>
            )}
            <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
              Al aprobar se crea el proyecto con el checklist de {typeLabel[sel.type] ?? sel.type} para el responsable.
            </p>
            <div className="flex gap-2.5">
              <button className="btn-secondary flex-1 py-3 text-[13.5px]" onClick={() => setRejecting(true)}>Rechazar…</button>
              <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={saving} onClick={approve}>
                {saving ? "Creando proyecto…" : "Aprobar y asignar"}
              </button>
            </div>
          </div>
        )}
        {sel && rejecting && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px]" style={{ color: "var(--text-2)" }}>
              El solicitante verá este motivo en su portal.
            </p>
            <textarea className="field-input resize-none" rows={3} placeholder="Motivo del rechazo…"
              value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="flex gap-2.5">
              <button className="btn-secondary flex-1 py-3 text-[13.5px]" onClick={() => setRejecting(false)}>Volver</button>
              <button className="flex-[2] py-3 text-[14px] rounded-sm font-semibold text-white"
                style={{ background: "linear-gradient(155deg,#FF6B60,#FF3B30)" }}
                disabled={saving} onClick={reject}>
                {saving ? "Rechazando…" : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
