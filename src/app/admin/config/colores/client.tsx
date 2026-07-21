"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseMutation, PageHeader } from "@/components/shared";
import { IconPlus } from "@/components/icons";
import { PALETTE, nextAvailableColor } from "@/lib/colors";
import type { Department } from "@/lib/types";

function Swatches({ value, taken, onPick }: { value: string; taken: string[]; onPick: (c: string) => void }) {
  const lockedByOthers = new Set(taken.map((c) => c.toUpperCase()));
  return (
    <div className="flex flex-wrap gap-1.5 max-w-[280px]">
      {PALETTE.map((c) => {
        const isValue = c.toUpperCase() === value.toUpperCase();
        const disabled = lockedByOthers.has(c.toUpperCase()) && !isValue;
        return (
          <button key={c} type="button" disabled={disabled} title={disabled ? "Ya en uso por otro grupo" : c}
            onClick={() => onPick(c)}
            className="w-6 h-6 rounded-full shrink-0 disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ background: c, boxShadow: isValue ? "0 0 0 2px var(--surface-1), 0 0 0 4px var(--text-1)" : "none" }}
          />
        );
      })}
    </div>
  );
}

export default function ColoresClient({ areas, rhColor }: { areas: Department[]; rhColor: string | null }) {
  const { run, saving } = useSupabaseMutation();
  const [addForm, setAddForm] = useState({ nombre: "", tipo: "coordinacion" as "coordinacion" | "departamento" });

  const activeAreas = areas.filter((a) => a.activo);
  const lockedColors = [...activeAreas.map((a) => a.color), rhColor].filter((c): c is string => !!c);
  const nextColor = nextAvailableColor(lockedColors);

  const setAreaColor = (area: Department, color: string) =>
    run(() => createClient().from("departments").update({ color }).eq("id", area.id),
      { ok: "Color actualizado", err: "No se pudo actualizar" });

  const setRhColor = (color: string) =>
    run(() => createClient().from("app_settings").upsert({ key: "rh_color", value: color }),
      { ok: "Color de RH actualizado", err: "No se pudo actualizar" });

  const addArea = async () => {
    if (!addForm.nombre.trim()) return;
    const color = nextAvailableColor(lockedColors);
    const ok = await run(async () => {
      const { error } = await createClient().from("departments").insert({
        nombre: addForm.nombre.trim(), tipo: addForm.tipo, color, activo: true,
      });
      if (error) return { error: { message: error.code === "23505" ? "Ya existe un grupo con ese nombre" : "No se pudo guardar" } };
      return { error: null };
    }, { ok: "Grupo creado con su color asignado" });
    if (ok) setAddForm({ nombre: "", tipo: addForm.tipo });
  };

  return (
    <>
      <PageHeader title="Colores de equipo" subtitle="Cada coordinación y departamento tiene un color fijo — ningún otro grupo puede usarlo" />

      <div className="card p-4 mb-5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
        Las personas heredan el color de su coordinación/departamento automáticamente, o el de RH si su rol es RH.
        Solo el rol <strong>Empleado</strong> (sin grupo) elige color manualmente en Equipo. Un color usado por un
        grupo activo queda bloqueado para los demás — el siguiente grupo que agregues recibe automáticamente el
        próximo color libre de la paleta.
      </div>

      <div className="card p-5 mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full shrink-0" style={{ background: rhColor ?? "#8E8E93" }} />
          <div>
            <p className="text-[14px] font-bold">Recursos Humanos (RH)</p>
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>RH no pertenece a una coordinación/departamento — su color aplica a todo el rol</p>
          </div>
        </div>
        <Swatches value={rhColor ?? ""} taken={activeAreas.map((a) => a.color).filter((c): c is string => !!c)} onPick={setRhColor} />
      </div>

      {(["coordinacion", "departamento"] as const).map((tipo) => (
        <div key={tipo} className="mb-6">
          <h3 className="text-[11.5px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-3)" }}>
            {tipo === "coordinacion" ? "Coordinaciones" : "Departamentos"}
          </h3>
          <div className="flex flex-col gap-2">
            {activeAreas.filter((a) => a.tipo === tipo).map((area) => (
              <div key={area.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-full shrink-0" style={{ background: area.color ?? "#8E8E93" }} />
                  <p className="text-[14px] font-semibold truncate">{area.nombre}</p>
                </div>
                <Swatches
                  value={area.color ?? ""}
                  taken={[...activeAreas.filter((a) => a.id !== area.id).map((a) => a.color), rhColor].filter((c): c is string => !!c)}
                  onPick={(c) => setAreaColor(area, c)}
                />
              </div>
            ))}
            {activeAreas.filter((a) => a.tipo === tipo).length === 0 && (
              <p className="text-[12.5px]" style={{ color: "var(--text-3)" }}>Sin grupos todavía.</p>
            )}
          </div>
        </div>
      ))}

      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-8 h-8 rounded-full shrink-0" style={{ background: nextColor }} />
          <div>
            <p className="text-[13px] font-bold">Próximo color disponible</p>
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Se asigna automáticamente al siguiente grupo que agregues</p>
          </div>
        </div>
        <p className="text-[13px] font-bold mb-3">Agregar coordinación o departamento</p>
        <div className="grid md:grid-cols-[1fr_180px_auto] gap-2.5">
          <input className="field-input" placeholder="Nombre"
            value={addForm.nombre} onChange={(e) => setAddForm({ ...addForm, nombre: e.target.value })} />
          <select className="field-input" value={addForm.tipo}
            onChange={(e) => setAddForm({ ...addForm, tipo: e.target.value as "coordinacion" | "departamento" })}>
            <option value="coordinacion">Coordinación</option>
            <option value="departamento">Departamento</option>
          </select>
          <button className="btn-primary px-5 py-3 text-[13.5px] flex items-center gap-1.5 justify-center" disabled={saving} onClick={addArea}>
            <IconPlus className="w-4 h-4" /> Agregar
          </button>
        </div>
        <p className="text-[11px] mt-2.5" style={{ color: "var(--text-3)" }}>
          Su color se asigna solo — no hace falta elegirlo.
        </p>
      </div>
    </>
  );
}
