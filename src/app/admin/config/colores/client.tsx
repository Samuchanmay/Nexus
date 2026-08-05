"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseMutation, PageHeader } from "@/components/shared";
import { Select } from "@/components/ui";
import { IconPlus, IconCheck } from "@/components/icons";
import { SectionIntro } from "@/components/config-intro";
import { PALETTE, nextAvailableColor } from "@/lib/colors";
import type { Department } from "@/lib/types";

/** Vista previa de tarjeta (§319) — así se ve el color aplicado a una
    persona real: mismo estilo de iniciales-en-círculo que usa Avatar en
    Equipo/Asistencia/Carga del equipo, para que el admin vea el efecto
    práctico antes de confirmar un color, no solo el swatch aislado. */
function ColorPreviewCard({ name, color }: { name: string; color: string }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full shrink-0" style={{ background: "var(--surface-2)" }}>
      <span className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white shrink-0"
        style={{ background: color, fontSize: 10 }}>
        {initials}
      </span>
      <span className="text-[12px] font-semibold truncate max-w-[110px]">{name}</span>
    </div>
  );
}

function Swatches({ value, used, onPick }: {
  value: string; used: { color: string; label: string }[]; onPick: (c: string) => void;
}) {
  const usedMap = new Map(used.map((u) => [u.color.toUpperCase(), u.label]));
  const available = PALETTE.filter((c) => !usedMap.has(c.toUpperCase()) || c.toUpperCase() === value.toUpperCase());
  const taken = PALETTE.filter((c) => usedMap.has(c.toUpperCase()) && c.toUpperCase() !== value.toUpperCase());

  const Swatch = ({ c, disabled, title }: { c: string; disabled?: boolean; title: string }) => {
    const selected = c.toUpperCase() === value.toUpperCase();
    return (
      <button key={c} type="button" disabled={disabled} title={title} onClick={() => onPick(c)}
        className="w-6 h-6 rounded-full grid place-items-center shrink-0 transition-transform hover:scale-110 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:scale-100"
        style={{
          background: c,
          boxShadow: selected
            ? "0 0 0 2px var(--surface-1), 0 0 0 4px var(--accent)"
            : "inset 0 0 0 1px rgba(0,0,0,0.08)",
        }}>
        {selected && (
          <span style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.65))" }}>
            <IconCheck className="w-3 h-3 text-white" />
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2 max-w-[300px]">
      <div>
        <p className="text-[12px] font-bold mb-1" style={{ color: "var(--text-3)" }}>DISPONIBLES</p>
        <div className="flex flex-wrap gap-1.5">
          {available.map((c) => <Swatch key={c} c={c} title={c} />)}
        </div>
      </div>
      {taken.length > 0 && (
        <div>
          <p className="text-[12px] font-bold mb-1" style={{ color: "var(--text-3)" }}>EN USO</p>
          <div className="flex flex-wrap gap-1.5">
            {taken.map((c) => <Swatch key={c} c={c} disabled title={`En uso por ${usedMap.get(c.toUpperCase())}`} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ColoresClient({ areas, rhColor, embedded }: { areas: Department[]; rhColor: string | null; embedded?: boolean }) {
  const { run, saving } = useSupabaseMutation();
  const [addForm, setAddForm] = useState({ nombre: "", tipo: "coordinacion" as "coordinacion" | "departamento" });

  const activeAreas = areas.filter((a) => a.activo);
  const lockedColors = [...activeAreas.map((a) => a.color), rhColor].filter((c): c is string => !!c);
  const nextColor = nextAvailableColor(lockedColors);
  const usedList = [
    ...activeAreas.filter((a) => a.color).map((a) => ({ color: a.color as string, label: a.nombre })),
    ...(rhColor ? [{ color: rhColor, label: "Recursos Humanos" }] : []),
  ];

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
      {!embedded && (
        <PageHeader title="Colores de equipo" subtitle="Cada coordinación y departamento tiene un color fijo — ningún otro grupo puede usarlo" />
      )}

      <SectionIntro
        stats={[
          { label: "Grupos", value: activeAreas.length },
          { label: "Colores usados", value: usedList.length },
          { label: "Disponibles", value: PALETTE.length - usedList.length, tone: "ok" },
        ]}
        tip="Un color liberado (grupo desactivado) no vuelve a la lista de disponibles automáticamente — reasígnalo a mano si quieres reutilizarlo."
      />

      <div className="card p-4 mb-5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
        Las personas heredan el color de su coordinación/departamento automáticamente, o el de RH si su rol es RH.
        Solo el rol <strong>Empleado</strong> (sin grupo) elige color manualmente en Equipo. Un color usado por un
        grupo activo queda bloqueado para los demás — el siguiente grupo que agregues recibe automáticamente el
        próximo color libre de la paleta.
      </div>

      <div className="card p-5 mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ColorPreviewCard name="Recursos Humanos" color={rhColor ?? "#8E8E93"} />
          <p className="text-[12px] max-w-[220px]" style={{ color: "var(--text-3)" }}>RH no pertenece a una coordinación/departamento — su color aplica a todo el rol</p>
        </div>
        <Swatches
          value={rhColor ?? ""}
          used={activeAreas.filter((a) => a.color).map((a) => ({ color: a.color as string, label: a.nombre }))}
          onPick={setRhColor}
        />
      </div>

      {(["coordinacion", "departamento"] as const).map((tipo) => (
        <div key={tipo} className="mb-6">
          <h3 className="text-[12px] font-bold mb-2.5" style={{ color: "var(--text-3)" }}>
            {tipo === "coordinacion" ? "Coordinaciones" : "Departamentos"}
          </h3>
          <div className="flex flex-col gap-2">
            {activeAreas.filter((a) => a.tipo === tipo).map((area) => (
              <div key={area.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
                <ColorPreviewCard name={area.nombre} color={area.color ?? "#8E8E93"} />
                <Swatches
                  value={area.color ?? ""}
                  used={[
                    ...activeAreas.filter((a) => a.id !== area.id && a.color).map((a) => ({ color: a.color as string, label: a.nombre })),
                    ...(rhColor ? [{ color: rhColor, label: "Recursos Humanos" }] : []),
                  ]}
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
          <ColorPreviewCard name={addForm.nombre.trim() || "Nuevo grupo"} color={nextColor} />
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Se asigna automáticamente al siguiente grupo que agregues</p>
        </div>
        <p className="text-[13px] font-bold mb-3">Agregar coordinación o departamento</p>
        <div className="grid md:grid-cols-[1fr_180px_auto] gap-2.5">
          <input className="field-input" placeholder="Nombre"
            value={addForm.nombre} onChange={(e) => setAddForm({ ...addForm, nombre: e.target.value })} />
          <Select
            value={addForm.tipo}
            onChange={(v) => setAddForm({ ...addForm, tipo: v as "coordinacion" | "departamento" })}
            title="Tipo de grupo" searchable={false}
            options={[
              { value: "coordinacion", label: "Coordinación" },
              { value: "departamento", label: "Departamento" },
            ]}
          />
          <button className="btn-primary px-5 py-3 text-[13.5px] flex items-center gap-1.5 justify-center" disabled={saving} onClick={addArea}>
            <IconPlus className="w-4 h-4" /> Agregar
          </button>
        </div>
        <p className="text-[12px] mt-2.5" style={{ color: "var(--text-3)" }}>
          Su color se asigna solo — no hace falta elegirlo.
        </p>
      </div>
    </>
  );
}
