"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Incident } from "@/lib/types";
import { useToast, Sheet, Pill } from "@/components/ui";
import { IconPlus, IconAlert } from "@/components/icons";

import { KIND_LABELS, INCIDENT_TONE as STATUS_TONE } from "@/lib/ui-maps";
import { dmy } from "@/lib/tz";

export default function IncidenciasClient({ userId, incidents }: { userId: string; incidents: Incident[] }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "permiso", start: "", end: "", note: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.start) { toast("Selecciona la fecha"); return; }
    const end = form.end || form.start;
    if (end < form.start) { toast("La fecha final debe ser posterior"); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("incidents").insert({
      user_id: userId, kind: form.kind, start_date: form.start, end_date: end, note: form.note || null,
    });
    setSaving(false);
    if (error) { toast("No se pudo enviar — intenta de nuevo"); return; }
    setOpen(false);
    setForm({ kind: "permiso", start: "", end: "", note: "" });
    toast("Incidencia enviada al administrador");
    router.refresh();
  };

  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Incidencias</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          Permisos, incapacidades, home office y más
        </p>
      </header>

      <button onClick={() => setOpen(true)}
        className="btn-primary btn-ok w-full py-3.5 text-[14.5px] mb-6 flex items-center justify-center gap-2">
        <IconPlus className="w-4 h-4" /> Nueva incidencia
      </button>

      {incidents.length === 0 && (
        <div className="card p-8 text-center">
          <IconAlert className="w-7 h-7 mx-auto mb-2" />
          <p className="font-semibold text-[14px]">Sin incidencias</p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--text-2)" }}>
            Permisos e incapacidades autorizados nunca generan falta
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {incidents.map((i) => (
          <div key={i.id} className="card px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-bold">{KIND_LABELS[i.kind]}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                {dmy(i.start_date)}{i.end_date !== i.start_date && ` → ${dmy(i.end_date)}`}
                {i.note && ` · ${i.note}`}
              </p>
            </div>
            <Pill tone={STATUS_TONE[i.status]}>{i.status}</Pill>
          </div>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Nueva incidencia">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "var(--text-2)" }}>Tipo</label>
            <select className="field-input" value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}>
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
              Motivo <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span>
            </label>
            <textarea className="field-input resize-none" rows={2} placeholder="Detalle breve…"
              value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="flex gap-2.5 mt-1">
            <button className="btn-secondary flex-1 py-3 text-[14px]" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary btn-ok flex-[2] py-3 text-[14px]" disabled={saving} onClick={submit}>
              {saving ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
