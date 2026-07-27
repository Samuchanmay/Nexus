"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Incident } from "@/lib/types";
import { useToast, Pill, Sheet, DatePicker, Select } from "@/components/ui";
import { useSupabaseMutation, EmptyState } from "@/components/shared";
import { IconPlus } from "@/components/icons";
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
      <header className="pt-8 pb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Incidencias</h1>
          <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Las incidencias autorizadas nunca generan falta
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary px-5 py-2.5 text-[13.5px] flex items-center gap-2">
          <IconPlus className="w-4 h-4" /> Registrar incidencia
        </button>
      </header>

      <h2 className="text-[15px] font-bold mb-3">Pendientes {pending.length > 0 && `(${pending.length})`}</h2>
      {pending.length === 0 && (
        <div className="mb-7">
          <EmptyState icon={<IconPlus className="w-[22px] h-[22px]" />} title="Sin incidencias pendientes" hint="Las incidencias nuevas aparecerán aquí." />
        </div>
      )}
      <div className="flex flex-col gap-2.5 mb-7">
        {pending.map((i) => (
          <div key={i.id} className="card px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[14px] font-bold">{i.users?.full_name} · {KIND_LABELS[i.kind]}</p>
              <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
                {dmy(i.start_date)}{i.end_date !== i.start_date && ` → ${dmy(i.end_date)}`}
                {i.note && ` · ${i.note}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-full text-[12.5px] font-semibold"
                style={{ background: "var(--danger-tint)", color: "var(--danger)" }}
                onClick={() => decide(i.id, "Rechazado")}>
                Rechazar
              </button>
              <button className="px-4 py-2 rounded-full text-[12.5px] font-semibold"
                style={{ background: "var(--ok-tint)", color: "var(--ok)" }}
                onClick={() => decide(i.id, "Autorizado")}>
                Autorizar
              </button>
            </div>
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <>
          <h2 className="text-[15px] font-bold mb-3">Historial</h2>
          <div className="flex flex-col gap-2.5">
            {rest.map((i) => (
              <div key={i.id} className="card px-5 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13.5px] font-bold">{i.users?.display_name} · {KIND_LABELS[i.kind]}</p>
                  <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                    {dmy(i.start_date)}{i.end_date !== i.start_date && ` → ${dmy(i.end_date)}`}
                  </p>
                </div>
                <Pill tone={STATUS_TONE[i.status]}>{i.status}</Pill>
              </div>
            ))}
          </div>
        </>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Registrar incidencia">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Persona</label>
            <Select
              value={form.userId} onChange={(v) => setForm({ ...form, userId: v })}
              title="Seleccionar empleado" placeholder="— elige a la persona —"
              options={team.map((t) => ({ value: t.id, label: t.display_name }))}
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Tipo</label>
            <Select
              value={form.kind} onChange={(v) => setForm({ ...form, kind: v })}
              title="Tipo de incidencia" searchable={false}
              options={(Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[]).map((k) => {
                const KindIcon = KIND_ICON[k];
                return { value: k, label: KIND_LABELS[k], sublabel: KIND_DESC[k], icon: <KindIcon className="w-4 h-4" /> };
              })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Desde</label>
              <DatePicker value={form.start} onChange={(v) => setForm({ ...form, start: v })} />
            </div>
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
                Hasta <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span>
              </label>
              <DatePicker value={form.end} onChange={(v) => setForm({ ...form, end: v })} />
            </div>
          </div>
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
              Nota <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span>
            </label>
            <textarea className="field-input resize-none" rows={2} placeholder="Detalle breve…"
              value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <p className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
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
