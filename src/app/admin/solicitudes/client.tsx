"use client";
// Solicitudes de comunicación · flujo de aprobación del admin
// Al aprobar: crea project + assignments (múltiple, con responsable
// principal) + copia el checklist de la plantilla según el tipo.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast, Sheet, Pill, Avatar, SlidingSegments, DatePicker, Select } from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { Icon } from "@/components/os/icons";
import { STATUS_LABELS } from "@/lib/types";
import type { CommRequest, Priority, RequestStatus } from "@/lib/types";

type Member = { id: string; display_name: string; nexus_color: string | null; specialties: string[]; avatar_url?: string | null; birth_date?: string | null };

const SPECIALTY_LABELS: Record<string, string> = {
  video: "Video", fotografia: "Fotografía", diseno: "Diseño", difusion: "Difusión", redaccion: "Redacción",
};

import { STATUS_TONE, PRIORITY_TONE } from "@/lib/ui-maps";
import { requestCalendarUrl } from "@/lib/gcal";
import { logAdminAction } from "@/lib/admin-log";
import { notifyUser } from "@/lib/notify";
import { dmy } from "@/lib/tz";
import { isBirthdayToday, todayISO } from "@/lib/birthday";
import { fmtTime } from "@/lib/hours";

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
    if (assignees.length === 0) { toast("Asigna al menos a una persona", "warn"); return; }
    if (!lead) { toast("Elige al responsable principal", "warn"); return; }
    setSaving(true);
    const supabase = createClient();

    // 1. actualizar solicitud
    const { error: e1 } = await supabase.from("requests")
      .update({ status: "aprobada", priority }).eq("id", sel.id);
    if (e1) { toast("No se pudo aprobar", "danger"); setSaving(false); return; }

    // 2. crear proyecto
    const { data: prj, error: e2 } = await supabase.from("projects").insert({
      request_id: sel.id, lead_user_id: lead, status: "aprobada",
      priority, deadline: deadline || null,
    }).select("id").single();
    if (e2 || !prj) { toast("No se pudo crear el proyecto", "danger"); setSaving(false); return; }

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
          details: `Proyecto Emet · ${sel.notes ?? ""}`,
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
    if (sel.requester_id) notifyUser(supabase, sel.requester_id, "Tu solicitud fue aprobada", sel.title, "request", "/coordinador");
    for (const uid of assignees) notifyUser(supabase, uid, "Te asignaron un proyecto", sel.title, "request", `/comunicacion?task=${prj.id}`);
    setSaving(false);
    setSel(null);
    toast("Proyecto creado y asignado");
    router.refresh();
  };

  const reject = async () => {
    if (!sel) return;
    if (!rejectReason.trim()) { toast("Escribe el motivo del rechazo", "warn"); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("requests")
      .update({ status: "cancelada", rejection_reason: rejectReason }).eq("id", sel.id);
    setSaving(false);
    if (error) { toast("No se pudo rechazar", "danger"); return; }
    if (adminId) logAdminAction(supabase, adminId, "Rechazó solicitud", sel.title);
    if (sel.requester_id) notifyUser(supabase, sel.requester_id, "Tu solicitud fue rechazada", `${sel.title} — ${rejectReason}`, "request", "/coordinador");
    setSel(null);
    toast("Solicitud rechazada");
    router.refresh();
  };

  const counts = useMemo(() => ({
    review: requests.filter((r) => r.status === "solicitada").length,
    approved: requests.filter((r) => !["solicitada", "cancelada"].includes(r.status)).length,
    rejected: requests.filter((r) => r.status === "cancelada").length,
  }), [requests]);

  return (
    <>
      {/* Header compacto */}
      <header className="pt-6 pb-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-[40px] font-bold tracking-tight text-text-1 leading-none">Solicitudes</h1>
            <p className="text-[16px] font-medium mt-2" style={{ color: "var(--text-2)" }}>
              Aprueba, asigna y prioriza el trabajo
            </p>
          </div>
        </div>

        {/* Tabs — SlidingSegments oficial con contadores (Sprint UI/UX #7) */}
        <SlidingSegments
          options={["Por revisar", "Aprobadas", "Rechazadas"]}
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          badge={(t) => t === "Por revisar" ? counts.review : t === "Aprobadas" ? counts.approved : counts.rejected}
        />
      </header>

      {/* Contenido */}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          {/* Icono grande */}
          <div 
            className="w-16 h-16 rounded-2xl grid place-items-center mb-4"
            style={{ background: "var(--surface-2)" }}
          >
            <Icon name="inbox" size={32} className="text-text-3" />
          </div>
          
          {/* Mensaje */}
          <h2 className="text-[18px] font-semibold text-text-1 mb-1">
            {tab === "Por revisar" ? "Todo está al día" : tab === "Aprobadas" ? "Sin solicitudes aprobadas" : "Sin solicitudes rechazadas"}
          </h2>
          <p className="text-[14px] text-text-3 text-center max-w-[360px] mb-8">
            {tab === "Por revisar" 
              ? "Las nuevas solicitudes aparecerán aquí cuando los coordinadores las envíen."
              : "Las solicitudes aparecerán aquí cuando cambien de estado."}
          </p>

          {/* Tarjetas informativas */}
          {tab === "Por revisar" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-[600px]">
              <div 
                className="p-6 rounded-3xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                style={{ 
                  background: "var(--surface)",
                  borderColor: "var(--border)"
                }}
              >
                <div 
                  className="w-10 h-10 rounded-xl grid place-items-center mb-3"
                  style={{ background: "var(--accent-tint)" }}
                >
                  <Icon name="clock" size={20} className="text-accent" />
                </div>
                <h3 className="text-[15px] font-semibold text-text-1 mb-1">Responde rápido</h3>
                <p className="text-[13px] text-text-3">
                  Mantén el flujo del equipo revisando las solicitudes a tiempo.
                </p>
              </div>

              <div 
                className="p-6 rounded-3xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                style={{ 
                  background: "var(--surface)",
                  borderColor: "var(--border)"
                }}
              >
                <div 
                  className="w-10 h-10 rounded-xl grid place-items-center mb-3"
                  style={{ background: "var(--purple-tint)" }}
                >
                  <Icon name="users" size={20} className="text-purple" />
                </div>
                <h3 className="text-[15px] font-semibold text-text-1 mb-1">Trabajo colaborativo</h3>
                <p className="text-[13px] text-text-3">
                  Asigna solicitudes según la disponibilidad y especialidad del equipo.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {shown.map((r) => (
            <div 
              key={r.id} 
              className="group p-8 rounded-3xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
              style={{ 
                background: "var(--surface)",
                borderColor: "var(--border)"
              }}
              onClick={() => r.status === "solicitada" && openApproval(r)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span 
                      className="text-[12px] font-semibold px-3 py-1 rounded-full"
                      style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
                    >
                      {typeLabel[r.type] ?? r.type}
                    </span>
                    <span 
                      className="text-[12px] font-semibold px-3 py-1 rounded-full"
                      style={{ 
                        background: r.status === "solicitada" ? "var(--warn-tint)" : 
                                   r.status === "cancelada" ? "var(--surface-2)" : "var(--ok-tint)",
                        color: r.status === "solicitada" ? "var(--warn)" : 
                               r.status === "cancelada" ? "var(--text-3)" : "var(--ok)"
                      }}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                    {r.priority !== "normal" && (
                      <span 
                        className="text-[12px] font-semibold px-3 py-1 rounded-full capitalize"
                        style={{ 
                          background: r.priority === "urgente" ? "var(--danger-tint)" : 
                                     r.priority === "alta" ? "var(--warn-tint)" : "var(--surface-2)",
                          color: r.priority === "urgente" ? "var(--danger)" : 
                                 r.priority === "alta" ? "var(--warn)" : "var(--text-2)"
                        }}
                      >
                        {r.priority}
                      </span>
                    )}
                  </div>

                  {/* Título */}
                  <h3 className="text-[18px] font-semibold text-text-1 leading-snug mb-2 group-hover:text-accent transition-colors">
                    {r.title}
                  </h3>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 flex-wrap text-[13px] text-text-3">
                    <span className="font-medium">
                      {(r.users?.honorific ? r.users.honorific + " " : "") + (r.users?.full_name ?? r.requester_name ?? "Solicitante")}
                    </span>
                    {r.event_date && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Icon name="calendar" size={12} />
                          {dmy(r.event_date)}{r.event_time ? " " + fmtTime(r.event_time) : ""}
                        </span>
                      </>
                    )}
                    {r.event_location && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Icon name="map" size={12} />
                          {r.event_location}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Notas */}
                  {r.notes && (
                    <p className="text-[13px] text-text-2 mt-3 line-clamp-2">{r.notes}</p>
                  )}
                </div>

                {/* Acción */}
                {r.status === "solicitada" && (
                  <button 
                    className="h-10 px-6 rounded-xl bg-accent hover:bg-accent/90 text-white font-semibold text-[14px] shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-200 hover:-translate-y-0.5 shrink-0"
                    onClick={(e) => { e.stopPropagation(); openApproval(r); }}
                  >
                    Revisar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
                      <Avatar name={m.display_name} color={m.nexus_color} size={30} avatarUrl={m.avatar_url} birthday={isBirthdayToday(m.birth_date, todayISO())} />
                      <div className="flex-1">
                        <p className="text-[13.5px] font-semibold">{m.display_name}</p>
                        <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
                          {m.specialties.map((s) => SPECIALTY_LABELS[s] ?? s).join(" · ") || "—"}
                        </p>
                      </div>
                      {included && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setLead(m.id); }}
                          aria-label="Responsable principal"
                          className="flex items-center"
                          style={{ opacity: isLead ? 1 : 0.25, color: "var(--warn)" }}>
                          <Icon name="star" size={16} />
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
                <Select
                  value={priority} onChange={(v) => setPriority(v as Priority)}
                  title="Prioridad" searchable={false}
                  options={PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Fecha de entrega</label>
                <DatePicker value={deadline} onChange={setDeadline} />
              </div>
            </div>
            {sel.event_date && (
              <label className="flex items-center gap-2.5 text-[13px] font-semibold cursor-pointer">
                <input type="checkbox" checked={addToCalendar} onChange={(e) => setAddToCalendar(e.target.checked)}
                  className="w-[18px] h-[18px] accent-[var(--accent)]" />
                Crear evento en Google Calendar
              </label>
            )}
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
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
