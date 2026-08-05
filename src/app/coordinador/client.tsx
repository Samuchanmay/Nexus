"use client";
// Portal del Coordinador/Departamento
// · El onboarding (título, coordinación/departamento) vive en /onboarding
// · Wizard de 3 pasos: tipo → detalle (con validación de anticipación
//   72h general, 168h para Lona y Video) → resumen y envío
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast, Pill, DatePicker, TimePicker } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import { STATUS_LABELS } from "@/lib/types";
import type { CommRequest, RequestType, UserProfile, RequestStatus, ActivityType } from "@/lib/types";
import { notifyAdmins } from "@/lib/notify";
import { dmy } from "@/lib/tz";
import { fmtTime } from "@/lib/hours";
import { ContextHeader } from "@/components/context-header";
import type { ContextHeaderInput } from "@/lib/context-header";
import { IconCamera, IconPen, IconVideo, IconMegaphone, IconClipboard, IconFolder, IconChevronLeft, IconCheck, IconPlus, IconAlert, IconCalendar, IconTrash } from "@/components/icons";

// Descripciones e iconos de los 5 tipos originales; los tipos nuevos que un
// admin agregue desde Configuración usan un icono/descripción genéricos.
const TYPE_DESC: Record<string, string> = {
  cobertura: "Foto y/o video de un evento",
  diseno: "Flyer, post, invitación, reconocimiento",
  lona: "Lona impresa — requiere 1 semana",
  video: "Video editado — requiere 1 semana",
  difusion: "Publicación en redes del CERT",
};
const TYPE_ICON: Record<string, typeof IconCamera> = {
  camera: IconCamera, pen: IconPen, clipboard: IconClipboard, video: IconVideo, megaphone: IconMegaphone,
};

import { STATUS_TONE } from "@/lib/ui-maps";
import { requestCalendarUrl } from "@/lib/gcal";

// La solicitud aprobada se congela en status "aprobada" en su propia fila —
// el avance real (en progreso, en revisión, completada) vive en el proyecto
// que se creó a partir de ella. Aquí lo mostramos para que el coordinador
// vea el estado verdadero, no solo "Aprobada" para siempre.
type ReqWithProject = CommRequest & { projects?: { status: string }[] | { status: string } | null };

function effectiveStatus(r: ReqWithProject): RequestStatus {
  if (r.status !== "aprobada") return r.status;
  const proj = Array.isArray(r.projects) ? r.projects[0] : r.projects;
  return (proj?.status as RequestStatus | undefined) ?? "aprobada";
}

// Fondos/textos semánticos para los tonos de STATUS_TONE (patrón 10.8 —
// badges semánticos: el color comunica el estado de un vistazo).
const TONE_BG: Record<string, string> = {
  warn: "var(--warn-tint)", accent: "var(--accent-tint)", ok: "var(--ok-tint)",
  danger: "var(--danger-tint)", muted: "var(--surface-2)",
};
const TONE_FG: Record<string, string> = {
  warn: "var(--warn)", accent: "var(--accent)", ok: "var(--ok)",
  danger: "var(--danger)", muted: "var(--text-2)",
};

export default function CoordinadorClient({ profile, requests, activityTypes, contextInput }: {
  profile: UserProfile; requests: ReqWithProject[]; activityTypes: ActivityType[]; contextInput: ContextHeaderInput;
}) {
  const toast = useToast();
  const router = useRouter();
  const typeLabel = useMemo(() => Object.fromEntries(activityTypes.map((t) => [t.key, t.label])), [activityTypes]);
  const typeMeta = useMemo(
    () => activityTypes.map((t) => ({
      type: t.key as RequestType,
      icon: TYPE_ICON[t.icon] ?? IconFolder,
      desc: TYPE_DESC[t.key] ?? "",
      subtypes: t.subtypes,
      label: t.label,
      minHours: t.min_hours,
    })),
    [activityTypes],
  );
  // El área real viene del catálogo (coordinaciones/departamentos); el texto
  // libre "area" se conserva solo como respaldo para perfiles antiguos.
  const areaLabel = profile.departments?.nombre ?? profile.area ?? "";

  /* ── Wizard ── */
  const [step, setStep] = useState(0); // 0 = lista, 1 = tipo, 2 = detalle, 3 = resumen
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [type, setType] = useState<RequestType | null>(null);
  const [subtypes, setSubtypes] = useState<string[]>([]);
  const [form, setForm] = useState({ title: "", date: "", time: "", location: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const meta = typeMeta.find((m) => m.type === type);
  const minHours = meta?.minHours ?? 72;

  const hoursUntilEvent = useMemo(() => {
    if (!form.date) return null;
    const dt = new Date(form.date + "T" + (form.time || "09:00"));
    return (dt.getTime() - Date.now()) / 36e5;
  }, [form.date, form.time]);

  const tooSoon = hoursUntilEvent !== null && hoursUntilEvent < minHours;

  const toggleSubtype = (s: string) =>
    setSubtypes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const resetWizard = () => {
    setStep(0); setType(null); setSubtypes([]);
    setForm({ title: "", date: "", time: "", location: "", notes: "" });
  };

  const submit = async () => {
    if (!type) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("requests").insert({
      requester_id: profile.id,
      requester_type: profile.requester_kind ?? (profile.role === "departamento" ? "departamento" : "coordinador"),
      requester_name: profile.full_name,
      requester_area: areaLabel,
      type, subtype: subtypes,
      title: form.title.trim(),
      event_date: form.date || null,
      event_time: form.time || null,
      event_location: form.location || null,
      notes: form.notes || null,
      min_hours_required: minHours,
    });
    setSaving(false);
    if (error) { toast("No se pudo enviar — intenta de nuevo", "danger"); return; }
    notifyAdmins(supabase, `${profile.full_name} envió una solicitud`, form.title.trim(), "request", "/admin/solicitudes");
    toast("Solicitud enviada al equipo de Comunicación");
    resetWizard();
    router.refresh();
  };

  // Solo se puede eliminar mientras siga "solicitada" — en cuanto Comunicación
  // la aprueba se crea el proyecto y ya no tiene sentido borrarla desde aquí.
  const removeRequest = async (id: string) => {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("requests").delete().eq("id", id);
    setDeleting(false);
    setConfirmId(null);
    if (error) { toast("No se pudo eliminar — intenta de nuevo", "danger"); return; }
    toast("Solicitud eliminada");
    router.refresh();
  };

  /* ══ Render ══ */
  if (step === 0) {
    return (
      <>
        <header className="pt-2 pb-1">
          <ContextHeader input={contextInput} />
          <p className="text-[13.5px] text-text-3">
            {areaLabel} · Solicita apoyo del equipo de Comunicación
          </p>
        </header>

        <button onClick={() => setStep(1)}
          className="w-full h-12 rounded-xl bg-accent text-white font-semibold text-[15px] flex items-center justify-center gap-2 my-6
            shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5 transition-all duration-200 active:scale-[.99]">
          <IconPlus className="w-[18px] h-[18px]" />
          Nueva solicitud
        </button>

        <div className="flex items-center gap-2 mb-3">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
            Mis solicitudes
          </p>
          <span className="text-[12px] font-bold px-2 py-0.5 rounded-full tabular-nums"
            style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
            {requests.length}
          </span>
        </div>

        {requests.length === 0 ? (
          <div className="flex flex-col items-center text-center py-14 px-6 rounded-2xl border border-dashed"
            style={{ borderColor: "var(--border-2)" }}>
            <div className="w-16 h-16 rounded-2xl grid place-items-center mb-4"
              style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
              <IconClipboard className="w-7 h-7" />
            </div>
            <p className="text-[15px] font-bold">Aún no tienes solicitudes</p>
            <p className="mt-1 text-[13.5px] max-w-[320px]" style={{ color: "var(--text-3)" }}>
              Crea la primera con el botón de arriba y el equipo de Comunicación la revisará.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((r) => (
              <div key={r.id} className="group p-5 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-[12px] font-semibold px-3 py-1 rounded-full"
                        style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                        {typeLabel[r.type] ?? r.type}
                      </span>
                      <span className="text-[12px] font-semibold px-3 py-1 rounded-full"
                        style={{ background: TONE_BG[STATUS_TONE[effectiveStatus(r)]], color: TONE_FG[STATUS_TONE[effectiveStatus(r)]] }}>
                        {STATUS_LABELS[effectiveStatus(r)]}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-semibold leading-snug group-hover:text-accent transition-colors">
                      {r.title}
                    </h3>
                    {r.event_date && (
                      <p className="text-[12.5px] mt-1 flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
                        <IconCalendar className="w-3.5 h-3.5 shrink-0" />
                        {dmy(r.event_date)}{r.event_time ? " · " + fmtTime(r.event_time) : ""}
                      </p>
                    )}
                    {r.status === "cancelada" && r.rejection_reason && (
                      <p className="text-[12.5px] mt-1.5" style={{ color: "var(--danger)" }}>
                        Motivo: {r.rejection_reason}
                      </p>
                    )}
                  </div>
                  {r.status === "solicitada" && (
                    confirmId === r.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>¿Eliminar?</span>
                        <button disabled={deleting} onClick={() => removeRequest(r.id)}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors hover:opacity-85"
                          style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                          Sí, eliminar
                        </button>
                        <button onClick={() => setConfirmId(null)}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors hover:opacity-80"
                          style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmId(r.id)} aria-label="Eliminar" title="Eliminar solicitud"
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-danger-tint hover:text-danger"
                        style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  /* Wizard pasos 1–3 */
  return (
    <>
      <header className="pt-6 pb-5">
        <button onClick={() => step === 1 ? resetWizard() : setStep(step - 1)}
          className="flex items-center gap-1 text-[13.5px] font-semibold mb-5 transition-opacity hover:opacity-80"
          style={{ color: "var(--accent)" }}>
          <IconChevronLeft className="w-4 h-4" /> {step === 1 ? "Cancelar" : "Atrás"}
        </button>
        <div className="flex gap-1.5 mb-5">
          {[1, 2, 3].map((s) => (
            <div key={s} className="h-[5px] flex-1 rounded-full transition-colors duration-300"
              style={{ background: s <= step ? "var(--accent)" : "var(--surface-3)" }} />
          ))}
        </div>
        <h1 className="text-[28px] font-bold tracking-tight">
          {step === 1 ? "¿Qué necesitas?" : step === 2 ? "Cuéntanos el detalle" : "Confirma tu solicitud"}
        </h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-3)" }}>
          {step === 1 ? "Elige el tipo de apoyo que requieres del equipo" :
           step === 2 ? "Cuanto más contexto des, más rápido lo aprueban" :
           "Revisa que todo esté correcto antes de enviar"}
        </p>
      </header>

      {step === 1 && (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {typeMeta.map((m) => {
            const Icon = m.icon;
            return (
              <button key={m.type} onClick={() => { setType(m.type); setSubtypes([]); setStep(2); }}
                className="group p-5 rounded-2xl border flex items-center gap-4 text-left w-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold group-hover:text-accent transition-colors">{m.label}</p>
                  <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text-2)" }}>{m.desc}</p>
                </div>
                <span className="text-[12px] font-semibold px-3 py-1.5 rounded-full shrink-0"
                  style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
                  mín. {m.minHours / 24} días
                </span>
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && meta && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <label className="text-[12px] font-semibold block mb-2" style={{ color: "var(--text-2)" }}>
              Tipo de {meta.label.toLowerCase()}
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {meta.subtypes.map((s) => (
                <button key={s} onClick={() => toggleSubtype(s)}
                  className="px-4 py-2 rounded-full text-[12.5px] font-semibold transition-all duration-150 active:scale-[.97]"
                  style={subtypes.includes(s)
                    ? { background: "var(--accent-tint)", color: "var(--accent)", border: "1px solid var(--accent)", boxShadow: "0 1px 6px rgba(0,102,255,.12)" }
                    : { border: "1px solid var(--border-2)", color: "var(--text-2)" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
              Título de la solicitud *
            </label>
            <input className="field-input" placeholder="Ej. Cobertura del Festival de Primavera"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
                Fecha del evento / entrega *
              </label>
              <DatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </div>
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Hora</label>
              <TimePicker value={form.time}
                onChange={(v) => setForm({ ...form, time: v })} />
            </div>
          </div>
          {tooSoon && (
            <div className="rounded-xl px-4 py-3 text-[12.5px] font-semibold flex items-start gap-2.5"
              style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
              <IconAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {meta.label} requiere al menos {minHours / 24} días de anticipación.
                Elige una fecha posterior o contacta directamente a Comunicación si es una urgencia real.
              </span>
            </div>
          )}
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
              Lugar <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(si aplica)</span>
            </label>
            <input className="field-input" placeholder="Ej. Auditorio principal"
              value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
              Detalles <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(texto, medidas, referencias…)</span>
            </label>
            <textarea className="field-input resize-none" rows={3} placeholder="Todo lo que Comunicación deba saber"
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button className="h-12 rounded-xl bg-accent text-white font-semibold text-[14px]
            shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-200 hover:-translate-y-0.5
            disabled:opacity-45 disabled:pointer-events-none"
            disabled={!form.title.trim() || !form.date || tooSoon}
            onClick={() => setStep(3)}>
            Revisar solicitud
          </button>
        </div>
      )}

      {step === 3 && meta && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-5 rounded-2xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Pill tone="muted">{meta.label}</Pill>
              {subtypes.map((s) => <Pill key={s} tone="muted">{s}</Pill>)}
            </div>
            <p className="text-[16px] font-bold mb-3">{form.title}</p>
            <div className="flex flex-col gap-1.5 text-[13.5px]">
              <p><span style={{ color: "var(--text-3)" }}>Fecha:</span> {form.date ? dmy(form.date) : "—"}{form.time && ` · ${fmtTime(form.time)}`}</p>
              {form.location && <p><span style={{ color: "var(--text-3)" }}>Lugar:</span> {form.location}</p>}
              {form.notes && <p><span style={{ color: "var(--text-3)" }}>Detalles:</span> {form.notes}</p>}
              <p><span style={{ color: "var(--text-3)" }}>Solicita:</span> {(profile.honorific ? profile.honorific + " " : "") + profile.full_name} · {areaLabel}</p>
            </div>
          </div>
          <div className="rounded-xl px-4 py-3 text-[12.5px] flex items-center gap-2"
            style={{ background: "var(--ok-tint)", color: "var(--ok)" }}>
            <IconCheck className="w-4 h-4 shrink-0" />
            Anticipación correcta — el equipo la revisará y te avisará cuando esté aprobada.
          </div>
          <button className="h-12 rounded-xl bg-accent text-white font-semibold text-[15px]
            shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-200 hover:-translate-y-0.5
            disabled:opacity-45 disabled:pointer-events-none flex items-center justify-center gap-2"
            disabled={saving} onClick={submit}>
            {saving ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      )}
    </>
  );
}
