"use client";
// Portal del Coordinador/Departamento
// · El onboarding (título, coordinación/departamento) vive en /onboarding
// · Wizard de 3 pasos: tipo → detalle (con validación de anticipación
//   72h general, 168h para Lona y Video) → resumen y envío
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast, Pill } from "@/components/ui";
import { STATUS_LABELS } from "@/lib/types";
import type { CommRequest, RequestType, UserProfile, RequestStatus, ActivityType } from "@/lib/types";
import { IconCamera, IconPen, IconVideo, IconMegaphone, IconClipboard, IconFolder, IconChevronLeft, IconCheck } from "@/components/icons";

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

export default function CoordinadorClient({ profile, requests, activityTypes }: {
  profile: UserProfile; requests: CommRequest[]; activityTypes: ActivityType[];
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
    if (error) { toast("No se pudo enviar — intenta de nuevo"); return; }
    toast("Solicitud enviada al equipo de Comunicación");
    resetWizard();
    router.refresh();
  };

  /* ══ Render ══ */
  if (step === 0) {
    return (
      <>
        <header className="pt-8 pb-6">
          <h1 className="text-[27px] font-bold tracking-tight">
            {(profile.title ? profile.title + " " : "") + profile.display_name} 👋
          </h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            {areaLabel} · Solicita apoyo del equipo de Comunicación
          </p>
        </header>

        <button onClick={() => setStep(1)} className="btn-primary w-full py-4 text-[15px] mb-7">
          + Nueva solicitud
        </button>

        <h2 className="text-[16px] font-bold mb-3">Mis solicitudes</h2>
        {requests.length === 0 && (
          <div className="card p-8 text-center">
            <p className="font-semibold text-[14px]">Aún no tienes solicitudes</p>
            <p className="text-[12.5px] mt-1" style={{ color: "var(--text-2)" }}>
              Crea la primera con el botón de arriba
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {requests.map((r) => (
            <div key={r.id} className="card px-5 py-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Pill tone="accent">{typeLabel[r.type] ?? r.type}</Pill>
                    <Pill tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Pill>
                  </div>
                  <p className="text-[14.5px] font-bold">{r.title}</p>
                  {r.event_date && (
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                      Evento: {r.event_date}{r.event_time ? " · " + r.event_time.slice(0, 5) : ""}
                    </p>
                  )}
                  {r.status === "cancelada" && r.rejection_reason && (
                    <p className="text-[12px] mt-1" style={{ color: "var(--danger)" }}>
                      Motivo: {r.rejection_reason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  /* Wizard pasos 1–3 */
  return (
    <>
      <header className="pt-8 pb-5">
        <button onClick={() => step === 1 ? resetWizard() : setStep(step - 1)}
          className="flex items-center gap-1 text-[13px] font-semibold mb-4" style={{ color: "var(--accent)" }}>
          <IconChevronLeft className="w-4 h-4" /> {step === 1 ? "Cancelar" : "Atrás"}
        </button>
        <div className="flex gap-1.5 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="h-[4px] flex-1 rounded-full transition-colors"
              style={{ background: s <= step ? "var(--accent)" : "var(--surface-3)" }} />
          ))}
        </div>
        <h1 className="text-[24px] font-bold tracking-tight">
          {step === 1 ? "¿Qué necesitas?" : step === 2 ? "Cuéntanos el detalle" : "Confirma tu solicitud"}
        </h1>
      </header>

      {step === 1 && (
        <div className="flex flex-col gap-2.5">
          {typeMeta.map((m) => {
            const Icon = m.icon;
            return (
              <button key={m.type} onClick={() => { setType(m.type); setSubtypes([]); setStep(2); }}
                className="card card-hover p-5 flex items-center gap-4 text-left w-full">
                <div className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0"
                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-bold">{m.label}</p>
                  <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{m.desc}</p>
                </div>
                <span className="text-[11px] font-semibold shrink-0" style={{ color: "var(--text-3)" }}>
                  mín. {m.minHours / 24} días
                </span>
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && meta && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[12px] font-semibold block mb-2" style={{ color: "var(--text-2)" }}>
              Tipo de {meta.label.toLowerCase()}
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {meta.subtypes.map((s) => (
                <button key={s} onClick={() => toggleSubtype(s)}
                  className="px-4 py-2 rounded-full text-[12.5px] font-semibold"
                  style={subtypes.includes(s)
                    ? { background: "var(--accent-tint)", color: "var(--accent)", border: "1px solid var(--accent)" }
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
              <input type="date" className="field-input" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Hora</label>
              <input type="time" className="field-input" value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
          </div>
          {tooSoon && (
            <div className="rounded-s px-4 py-3 text-[12.5px] font-semibold"
              style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
              {meta.label} requiere al menos {minHours / 24} días de anticipación.
              Elige una fecha posterior o contacta directamente a Comunicación si es una urgencia real.
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
          <button className="btn-primary py-3.5 text-[14.5px]"
            disabled={!form.title.trim() || !form.date || tooSoon}
            onClick={() => setStep(3)}>
            Revisar solicitud
          </button>
        </div>
      )}

      {step === 3 && meta && (
        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Pill tone="accent">{meta.label}</Pill>
              {subtypes.map((s) => <Pill key={s} tone="muted">{s}</Pill>)}
            </div>
            <p className="text-[16px] font-bold mb-3">{form.title}</p>
            <div className="flex flex-col gap-1.5 text-[13px]">
              <p><span style={{ color: "var(--text-3)" }}>Fecha:</span> {form.date}{form.time && ` · ${form.time}`}</p>
              {form.location && <p><span style={{ color: "var(--text-3)" }}>Lugar:</span> {form.location}</p>}
              {form.notes && <p><span style={{ color: "var(--text-3)" }}>Detalles:</span> {form.notes}</p>}
              <p><span style={{ color: "var(--text-3)" }}>Solicita:</span> {(profile.title ? profile.title + " " : "") + profile.full_name} · {areaLabel}</p>
            </div>
          </div>
          <div className="rounded-s px-4 py-3 text-[12.5px] flex items-center gap-2"
            style={{ background: "var(--ok-tint)", color: "var(--ok)" }}>
            <IconCheck className="w-4 h-4 shrink-0" />
            Anticipación correcta — el equipo la revisará y te avisará cuando esté aprobada.
          </div>
          <button className="btn-primary py-4 text-[15px]" disabled={saving} onClick={submit}>
            {saving ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      )}
    </>
  );
}
