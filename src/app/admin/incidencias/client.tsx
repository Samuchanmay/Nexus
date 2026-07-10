"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Incident } from "@/lib/types";
import { useToast, Pill, Sheet } from "@/components/ui";
import { useSupabaseMutation } from "@/components/shared";
import { IconPlus } from "@/components/icons";
import { KIND_LABELS, INCIDENT_TONE as STATUS_TONE } from "@/lib/ui-maps";
import { logAdminAction } from "@/lib/admin-log";

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
    if (error) { toast("No se pudo registrar"); return; }
    const person = team.find((t) => t.id === form.userId);
    if (adminId) logAdminAction(supabase, adminId, "Registró incidencia manual", `${person?.display_name ?? ""} · ${KIND_LABELS[form.kind as keyof typeof KIND_LABELS]}`);
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
        <div className="card p-6 text-center mb-7">
          <p className="text-[13px]" style={{ color: "var(--text-2)" }}>Sin incidencias pendientes</p>
        </div>
      )}
      <div className="flex flex-col gap-2.5 mb-7">
        {pending.map((i) => (
          <div key={i.id} className="card px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[14px] font-bold">{i.users?.full_name} · {KIND_LABELS[i.kind]}</p>
              <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
                {i.start_date}{i.end_date !== i.start_date && ` → ${i.end_date}`}
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
                    {i.start_date}{i.end_date !== i.start_date && ` → ${i.end_date}`}
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
            <select className="field-input" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">— elige a la persona —</option>
              {team.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Tipo</label>
            <select className="field-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Desde</label>
              <input type="date" className="field-input" value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </div>
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>
                Hasta <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span>
              </label>
              <input type="date" className="field-input" value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })} />
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
