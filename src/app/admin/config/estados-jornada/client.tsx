"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseMutation, PageHeader, Switch } from "@/components/shared";
import { IconPlus, IconX } from "@/components/icons";
import { Icon } from "@/components/os/icons";

type EstadoRow = {
  id: string; nombre: string; cuenta_tiempo: boolean; pausa_actividad: boolean;
  requiere_motivo: boolean; color: string; orden: number; activo: boolean;
};

const FLAGS: { key: "cuenta_tiempo" | "pausa_actividad" | "requiere_motivo"; label: string; hint: string }[] = [
  { key: "cuenta_tiempo", label: "Cuenta como tiempo trabajado", hint: "Este tiempo suma a las horas laboradas del día" },
  { key: "pausa_actividad", label: "Pausa la actividad en curso", hint: "Si tiene una tarea con cronómetro abierto, se pausa sola" },
  { key: "requiere_motivo", label: "Requiere motivo", hint: "Uso informativo — el check-in ya siempre pide un motivo" },
];

export default function EstadosClient({ states }: { states: EstadoRow[] }) {
  const { run, saving } = useSupabaseMutation();
  const [form, setForm] = useState({ nombre: "", color: "#8E8E93", orden: (states.at(-1)?.orden ?? 0) + 1 });

  const toggle = (row: EstadoRow, key: (typeof FLAGS)[number]["key"]) =>
    run(() => createClient().from("jornada_states").update({ [key]: !row[key] }).eq("id", row.id),
      { ok: "Actualizado", err: "No se pudo actualizar" });

  const toggleActivo = (row: EstadoRow) =>
    run(() => createClient().from("jornada_states").update({ activo: !row.activo }).eq("id", row.id),
      { ok: row.activo ? "Estado desactivado" : "Estado activado", err: "No se pudo actualizar" });

  const setColor = (row: EstadoRow, color: string) =>
    run(() => createClient().from("jornada_states").update({ color }).eq("id", row.id), {});

  const add = async () => {
    if (!form.nombre.trim()) return;
    const ok = await run(async () => {
      const { error } = await createClient().from("jornada_states").insert({
        nombre: form.nombre.trim(), color: form.color, orden: form.orden,
        cuenta_tiempo: true, pausa_actividad: true, requiere_motivo: false, activo: true,
      });
      if (error) return { error: { message: error.code === "23505" ? "Ya existe un estado con ese nombre" : "No se pudo guardar" } };
      return { error: null };
    }, { ok: "Estado creado" });
    if (ok) setForm({ nombre: "", color: "#8E8E93", orden: form.orden + 1 });
  };

  const remove = (row: EstadoRow) =>
    run(() => createClient().from("jornada_states").delete().eq("id", row.id),
      { ok: "Estado eliminado", err: "No se pudo eliminar — puede que ya tenga fichajes asociados" });

  return (
    <>
      <PageHeader title="Estados de Jornada" subtitle="Define qué pasa cuando alguien ficha cada motivo — sin tocar código" />

      <div className="card p-4 mb-5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
        Los <strong>motivos del check-in</strong> (Comida, Diligencia, Cita médica, Permiso, Pendientes…) están
        fijos en <code>/fichar</code> — son los oficiales del checador. Lo que sí controlas aquí es su{" "}
        <strong>efecto</strong>: si ese tiempo cuenta como laborado y si pausa la actividad que la persona tenga abierta.
      </div>

      <div className="flex flex-col gap-2.5 mb-6">
        {states.map((row) => (
          <div key={row.id} className="card p-0 overflow-hidden flex" style={{ opacity: row.activo ? 1 : 0.5 }}>
            {/* Línea lateral de color — acento, no protagonista */}
            <div className="w-1 shrink-0" style={{ background: row.color }} />
            <div className="flex-1 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-full grid place-items-center shrink-0"
                    style={{ background: `color-mix(in srgb, ${row.color} 16%, transparent)`, color: row.color }}>
                    <Icon name="clock" size={15} />
                  </span>
                  <p className="text-[14.5px] font-bold truncate">{row.nombre}</p>
                  <label className="relative w-5 h-5 rounded-sm border shrink-0 cursor-pointer overflow-hidden"
                    style={{ borderColor: "var(--border)" }} title="Cambiar color">
                    <span className="absolute inset-0" style={{ background: row.color }} />
                    <input type="color" value={row.color} onChange={(e) => setColor(row, e.target.value)}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
                  </label>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActivo(row)} disabled={saving}
                    className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      background: row.activo ? "var(--ok-tint)" : "var(--surface-2)",
                      color: row.activo ? "var(--ok)" : "var(--text-3)",
                    }}>
                    {row.activo ? "Activo" : "Inactivo"}
                  </button>
                  <button onClick={() => remove(row)} aria-label="Eliminar"
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                    <IconX className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {FLAGS.map((f) => (
                  <div key={f.key} className="flex items-start gap-2">
                    <Switch checked={row[f.key]} onChange={() => toggle(row, f.key)} disabled={saving} />
                    <span>
                      <span className="block text-[12.5px] font-semibold leading-tight">{f.label}</span>
                      <span className="block text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{f.hint}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <p className="text-[13px] font-bold mb-3">Agregar estado nuevo</p>
        <div className="grid md:grid-cols-[1fr_80px_auto] gap-2.5">
          <input className="field-input" placeholder="Nombre del estado"
            value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <label className="relative w-full h-[42px] rounded-sm border cursor-pointer overflow-hidden"
            style={{ borderColor: "var(--border)" }} title="Elegir color">
            <span className="absolute inset-0" style={{ background: form.color }} />
            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
          </label>
          <button className="btn-primary px-5 py-3 text-[13.5px] flex items-center gap-1.5" disabled={saving} onClick={add}>
            <IconPlus className="w-4 h-4" /> Agregar
          </button>
        </div>
        <p className="text-[11px] mt-2.5" style={{ color: "var(--text-3)" }}>
          Un estado nuevo aquí no crea un motivo de check-in nuevo en /fichar — solo queda listo para cuando se conecte.
        </p>
      </div>
    </>
  );
}
