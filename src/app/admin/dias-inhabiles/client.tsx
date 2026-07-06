"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast, Pill } from "@/components/ui";
import { useSupabaseMutation } from "@/components/shared";
import { IconPlus, IconX } from "@/components/icons";

const KIND_TONE: Record<string, "accent" | "warn" | "ok" | "muted"> = {
  nacional: "accent", estatal: "warn", empresa: "ok", puente: "muted",
};

export default function DiasClient({ holidays }: { holidays: { id: string; date: string; name: string; kind: string }[] }) {
  const toast = useToast();
  const { run, saving } = useSupabaseMutation();
  const [form, setForm] = useState({ date: "", name: "", kind: "empresa" });

  const add = async () => {
    if (!form.date || !form.name.trim()) { toast("Fecha y nombre son obligatorios"); return; }
    const ok = await run(async () => {
      const { error } = await createClient().from("holidays").insert(form);
      if (error) return { error: { message: error.code === "23505" ? "Esa fecha ya está registrada" : "No se pudo guardar" } };
      return { error: null };
    }, { ok: "Día inhábil agregado" });
    if (ok) setForm({ date: "", name: "", kind: "empresa" });
  };

  const remove = (id: string) =>
    run(() => createClient().from("holidays").delete().eq("id", id),
      { ok: "Día eliminado", err: "No se pudo eliminar" });

  return (
    <>
      <header className="pt-8 pb-6">
        <h1 className="text-[28px] font-bold tracking-tight">Días inhábiles</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--text-2)" }}>
          Estos días nunca generan falta y no cuentan para vacaciones
        </p>
      </header>

      <div className="card p-5 mb-6">
        <div className="grid md:grid-cols-[160px_1fr_150px_auto] gap-2.5">
          <input type="date" className="field-input" value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input className="field-input" placeholder="Nombre del día"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="field-input" value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="nacional">Nacional</option>
            <option value="estatal">Estatal</option>
            <option value="empresa">Empresa</option>
            <option value="puente">Puente</option>
          </select>
          <button className="btn-primary px-5 py-3 text-[13.5px] flex items-center gap-1.5" disabled={saving} onClick={add}>
            <IconPlus className="w-4 h-4" /> Agregar
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {holidays.map((h) => (
          <div key={h.id} className="card px-5 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-[13.5px] font-bold tabular-nums w-[100px]">{h.date}</p>
              <p className="text-[13.5px]">{h.name}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <Pill tone={KIND_TONE[h.kind] ?? "muted"}>{h.kind}</Pill>
              <button onClick={() => remove(h.id)} aria-label="Eliminar"
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                <IconX className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
