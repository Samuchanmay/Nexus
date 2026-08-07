"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Incident } from "@/lib/types";
import { useToast, Pill, Sheet, DatePicker, Select } from "@/components/ui";
import { useSupabaseMutation, EmptyState, Field } from "@/components/shared";
import { Button, StatCard } from "@/components/os/ui";
import { Icon } from "@/components/os/icons";
import { KIND_LABELS, KIND_ICON, KIND_DESC, INCIDENT_TONE as STATUS_TONE } from "@/lib/ui-maps";
import { logAdminAction } from "@/lib/admin-log";
import { notifyUser } from "@/lib/notify";
import { dmy } from "@/lib/tz";

export default function IncAdminClient({ incidents, team, adminId }: {
  incidents: Incident[]; team: { id: string; display_name: string }[]; adminId: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const { run } = useSupabaseMutation();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ userId: "", kind: "permiso", start: "", end: "", note: "" });

  const submitManual = async () => {
    if (!form.userId) { toast("Elige a la persona"); return; }
    if (!form.start) { toast("Selecciona la fecha"); return; }
    const end = form.end || form.start;
    if (end < form.start) { toast("La fecha final debe ser posterior"); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("incidents").insert({
      user_id: form.userId, kind: form.kind, start_date: form.start, end_date: end,
      note: form.note || null, status: "Autorizado",
    });
    setSaving(false);
    if (error) { toast("No se pudo registrar", "danger"); return; }
    const person = team.find((t) => t.id === form.userId);
    if (adminId) logAdminAction(supabase, adminId, "Registró incidencia manual", `${person?.display_name ?? ""} · ${KIND_LABELS[form.kind as keyof typeof KIND_LABELS]}`);
    notifyUser(supabase, form.userId, "Se registró una incidencia", KIND_LABELS[form.kind as keyof typeof KIND_LABELS], "incident", "/comunicacion/incidencias");
    setOpen(false);
    setForm({ userId: "", kind: "permiso", start: "", end: "", note: "" });
    toast("Incidencia registrada");
    router.refresh();
  };
  const decide = async (id: string, status: "Autorizado" | "Rechazado") => {
    const target = incidents.find((i) => i.id === id);
    const ok = await run(() => createClient().from("incidents").update({ status }).eq("id", id),
      { ok: status === "Autorizado" ? "Incidencia autorizada" : "Incidencia rechazada", err: "No se pudo actualizar" });
    if (ok && adminId) {
      logAdminAction(createClient(), adminId,
        status === "Autorizado" ? "Autorizó incidencia" : "Rechazó incidencia",
        target ? `${target.users?.display_name ?? ""} · ${KIND_LABELS[target.kind]}` : undefined);
    }
    if (ok && target) {
      notifyUser(createClient(), target.user_id,
        status === "Autorizado" ? "Tu incidencia fue autorizada" : "Tu incidencia fue rechazada",
        KIND_LABELS[target.kind], "incident", "/comunicacion/incidencias");
    }
  };

  const pending = incidents.filter((i) => i.status === "Pendiente");
  const rest = incidents.filter((i) => i.status !== "Pendiente");

  return (
    <>
      {/* Header compacto */}
      <header className="pt-6 pb-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-text-1 leading-none">Incidencias</h1>
            <p className="text-[15px] mt-2" style={{ color: "var(--text-2)" }}>
              Las incidencias autorizadas nunca generan falta
            </p>
          </div>
          <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
            <span className="hidden sm:inline">Registrar incidencia</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </div>
      </header>

      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon="clock" tone="warn" value={String(pending.length)} label="Pendientes" />
        <StatCard icon="check" tone="ok" value={String(incidents.filter(i => i.status === "Autorizado").length)} label="Autorizadas" />
        <StatCard icon="x" tone="danger" value={String(incidents.filter(i => i.status === "Rechazado").length)} label="Rechazadas" />
        <StatCard icon="calendar" tone="accent" value={String(incidents.length)} label="Este mes" />
      </div>

      {/* Pendientes */}
      <div className="mb-8">
        <h2 className="text-[19px] font-bold text-text-1 mb-4">
          Pendientes
          {pending.length > 0 && <span className="ml-2 text-[14px] font-semibold" style={{ color: "var(--text-3)" }}>({pending.length})</span>}
        </h2>
        {pending.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl grid place-items-center mb-4 mx-auto" style={{ background: "var(--ok-tint)" }}>
              <Icon name="check" size={32} className="text-ok" />
            </div>
            <h3 className="text-[19px] font-semibold text-text-1 mb-1">Sin incidencias pendientes</h3>
            <p className="text-[14px] text-text-3 max-w-[360px] mx-auto">
              Las incidencias nuevas aparecerán aquí para revisión.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((i) => (
              <div key={i.id} className="group flex items-center justify-between gap-4 p-5 rounded-2xl border border-border hover:border-border-2 hover:shadow-2 hover:-translate-y-[2px] transition-all duration-200" style={{ background: "var(--surface)" }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[16px] font-bold text-text-1">{i.users?.full_name}</p>
                    <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
                      {KIND_LABELS[i.kind]}
                    </span>
                  </div>
                  <p className="text-[13.5px]" style={{ color: "var(--text-2)" }}>
                    {dmy(i.start_date)}{i.end_date !== i.start_date && ` → ${dmy(i.end_date)}`}
                    {i.note && ` · ${i.note}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button 
                    className="h-9 px-4 rounded-lg text-[13.5px] font-semibold transition-all duration-200"
                    style={{ background: "var(--danger-tint)", color: "var(--danger)" }}
                    onClick={() => decide(i.id, "Rechazado")}>
                    Rechazar
                  </button>
                  <button 
                    className="h-9 px-4 rounded-lg text-[13.5px] font-semibold transition-all duration-200"
                    style={{ background: "var(--ok-tint)", color: "var(--ok)" }}
                    onClick={() => decide(i.id, "Autorizado")}>
                    Autorizar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial */}
      {rest.length > 0 && (
        <div>
          <h2 className="text-[19px] font-bold text-text-1 mb-4">
            Historial
            <span className="ml-2 text-[14px] font-semibold" style={{ color: "var(--text-3)" }}>({rest.length})</span>
          </h2>
          <div className="flex flex-col gap-2">
            {rest.map((i) => (
              <div key={i.id} className="group flex items-center justify-between gap-4 p-4 rounded-2xl hover:bg-hover transition-all duration-200">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[14px] font-bold text-text-1">{i.users?.display_name}</p>
                    <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
                      {KIND_LABELS[i.kind]}
                    </span>
                  </div>
                  <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                    {dmy(i.start_date)}{i.end_date !== i.start_date && ` → ${dmy(i.end_date)}`}
                  </p>
                </div>
                <span 
                  className="text-[12px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{ 
                    background: i.status === "Autorizado" ? "var(--ok-tint)" : "var(--danger-tint)",
                    color: i.status === "Autorizado" ? "var(--ok)" : "var(--danger)"
                  }}>
                  {i.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Registrar incidencia">
        <div className="flex flex-col gap-3">
          <Field label="Persona">
            <Select
              value={form.userId} onChange={(v) => setForm({ ...form, userId: v })}
              title="Seleccionar empleado" placeholder="— elige a la persona —"
              options={team.map((t) => ({ value: t.id, label: t.display_name }))}
            />
          </Field>
          <Field label="Tipo">
            <Select
              value={form.kind} onChange={(v) => setForm({ ...form, kind: v })}
              title="Tipo de incidencia" searchable={false}
              options={(Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[]).map((k) => {
                const KindIcon = KIND_ICON[k];
                return { value: k, label: KIND_LABELS[k], sublabel: KIND_DESC[k], icon: <KindIcon className="w-4 h-4" /> };
              })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Desde">
              <DatePicker value={form.start} onChange={(v) => setForm({ ...form, start: v })} />
            </Field>
            <Field label="Hasta (opcional)">
              <DatePicker value={form.end} onChange={(v) => setForm({ ...form, end: v })} />
            </Field>
          </div>
          <Field label="Nota (opcional)">
            <textarea className="field-input resize-none" rows={2} placeholder="Detalle breve…"
              value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
            Al registrarla aquí queda Autorizada de inmediato — es el admin quien la está dando de alta.
          </p>
          <div className="flex gap-2.5 mt-1">
            <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary flex-[2] py-3 text-[14px]" disabled={saving} onClick={submitManual}>
              {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
