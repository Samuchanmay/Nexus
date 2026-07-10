"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseMutation, PageHeader } from "@/components/shared";
import {
  IconPlus, IconX, IconCamera, IconPen, IconClipboard, IconVideo, IconMegaphone, IconFolder,
} from "@/components/icons";
import type { ActivityType } from "@/lib/types";
import type { ChecklistTemplateRow } from "./page";

// Set fijo de iconos disponibles para tipos nuevos. Un tipo agregado aquí
// por un admin no elige un icono personalizado — usa uno de este set
// (por defecto "Genérico"). Ampliar este set si algún día hace falta un
// icono nuevo sí requiere tocar código; el resto del flujo, no.
const ICONS: { key: string; label: string; Icon: typeof IconCamera }[] = [
  { key: "generic", label: "Genérico", Icon: IconFolder },
  { key: "camera", label: "Cámara", Icon: IconCamera },
  { key: "pen", label: "Pluma", Icon: IconPen },
  { key: "clipboard", label: "Portapapeles", Icon: IconClipboard },
  { key: "video", label: "Video", Icon: IconVideo },
  { key: "megaphone", label: "Megáfono", Icon: IconMegaphone },
];
const ICON_MAP = Object.fromEntries(ICONS.map((i) => [i.key, i.Icon])) as Record<string, typeof IconCamera>;

function slugify(label: string) {
  const base = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return base || "tipo";
}

export default function TiposClient({ types, templates }: {
  types: ActivityType[]; templates: ChecklistTemplateRow[];
}) {
  const { run, saving } = useSupabaseMutation();
  const [form, setForm] = useState({ label: "", minDays: 3, icon: "generic", subtypes: "" });
  const [openType, setOpenType] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState<Record<string, string>>({});

  const templateByType = Object.fromEntries(templates.map((t) => [t.type, t]));

  const update = (row: ActivityType, patch: Partial<ActivityType>) =>
    run(() => createClient().from("activity_types").update(patch).eq("key", row.key), {});

  const toggleActivo = (row: ActivityType) =>
    run(() => createClient().from("activity_types").update({ activo: !row.activo }).eq("key", row.key),
      { ok: row.activo ? "Tipo desactivado" : "Tipo activado", err: "No se pudo actualizar" });

  const saveLabel = (row: ActivityType, label: string) => {
    if (!label.trim() || label.trim() === row.label) return;
    update(row, { label: label.trim() });
  };

  const saveMinDays = (row: ActivityType, days: number) => {
    const hours = Math.max(1, Math.round(days)) * 24;
    if (hours === row.min_hours) return;
    update(row, { min_hours: hours });
  };

  const saveSubtypes = (row: ActivityType, raw: string) => {
    const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
    update(row, { subtypes: list });
  };

  const remove = (row: ActivityType) =>
    run(() => createClient().from("activity_types").delete().eq("key", row.key),
      { ok: "Tipo eliminado", err: "No se pudo eliminar — puede que ya tenga solicitudes o actividades asociadas" });

  const add = async () => {
    if (!form.label.trim()) return;
    const key = slugify(form.label);
    const orden = (types.at(-1)?.orden ?? 0) + 1;
    const ok = await run(async () => {
      const { error } = await createClient().from("activity_types").insert({
        key, label: form.label.trim(), min_hours: Math.max(1, form.minDays) * 24, icon: form.icon,
        subtypes: form.subtypes.split(",").map((s) => s.trim()).filter(Boolean),
        orden, activo: true,
      });
      if (error) return { error: { message: error.code === "23505" ? "Ya existe un tipo con ese nombre" : "No se pudo guardar" } };
      return { error: null };
    }, { ok: "Tipo creado" });
    if (ok) setForm({ label: "", minDays: 3, icon: "generic", subtypes: "" });
  };

  /* ── Checklist por tipo ── */
  const addItem = async (typeKey: string) => {
    const label = (newItemLabel[typeKey] ?? "").trim();
    if (!label) return;
    const tpl = templateByType[typeKey];
    const ok = await run(async () => {
      const supabase = createClient();
      let templateId = tpl?.id;
      if (!templateId) {
        const { data, error } = await supabase.from("checklist_templates").insert({ type: typeKey }).select("id").single();
        if (error) return { error: { message: "No se pudo crear la plantilla de checklist" } };
        templateId = data.id;
      }
      const position = (tpl?.checklist_items.length ?? 0) + 1;
      const { error } = await supabase.from("checklist_items").insert({ template_id: templateId, position, label });
      if (error) return { error: { message: "No se pudo agregar el paso" } };
      return { error: null };
    }, { ok: "Paso agregado" });
    if (ok) setNewItemLabel((f) => ({ ...f, [typeKey]: "" }));
  };

  const removeItem = (itemId: string) =>
    run(() => createClient().from("checklist_items").delete().eq("id", itemId),
      { ok: "Paso eliminado", err: "No se pudo eliminar" });

  const moveItem = (tpl: ChecklistTemplateRow, index: number, dir: -1 | 1) => {
    const items = [...tpl.checklist_items].sort((a, b) => a.position - b.position);
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[index], b = items[j];
    return run(async () => {
      const supabase = createClient();
      const { error: e1 } = await supabase.from("checklist_items").update({ position: b.position }).eq("id", a.id);
      const { error: e2 } = await supabase.from("checklist_items").update({ position: a.position }).eq("id", b.id);
      if (e1 || e2) return { error: { message: "No se pudo reordenar" } };
      return { error: null };
    }, {});
  };

  return (
    <>
      <PageHeader title="Tipos de Actividad" subtitle="Agrega tipos nuevos y define su checklist — sin tocar código" />

      <div className="card p-4 mb-5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
        Cada tipo (Cobertura, Diseño, Lona…) controla qué aparece en el asistente de{" "}
        <strong>Nueva solicitud</strong>, cuántos días de anticipación pide y qué checklist recibe la
        actividad al aprobarse. Un tipo nuevo usa un icono genérico de este set fijo — si algún día quieres
        un icono a la medida, eso sí requiere un cambio de código.
      </div>

      <div className="flex flex-col gap-2.5 mb-6">
        {types.map((row) => {
          const Icon = ICON_MAP[row.icon] ?? IconFolder;
          const tpl = templateByType[row.key];
          const items = tpl ? [...tpl.checklist_items].sort((a, b) => a.position - b.position) : [];
          const isOpen = openType === row.key;
          return (
            <div key={row.key} className="card p-4" style={{ opacity: row.activo ? 1 : 0.5 }}>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
                  <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                    style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <input defaultValue={row.label} onBlur={(e) => saveLabel(row, e.target.value)}
                    className="text-[14.5px] font-bold bg-transparent border-0 outline-none flex-1 min-w-0" />
                </div>
                <div className="flex items-center gap-2">
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

              <div className="grid sm:grid-cols-3 gap-2.5 mb-3">
                <label className="block">
                  <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>Icono</span>
                  <select defaultValue={row.icon} onChange={(e) => update(row, { icon: e.target.value })}
                    className="field-input text-[13px] py-2">
                    {ICONS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>
                    Anticipación mínima (días)
                  </span>
                  <input type="number" min={1} defaultValue={row.min_hours / 24}
                    onBlur={(e) => saveMinDays(row, Number(e.target.value) || 1)}
                    className="field-input text-[13px] py-2" />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>
                    Subtipos (separados por coma)
                  </span>
                  <input defaultValue={row.subtypes.join(", ")}
                    onBlur={(e) => saveSubtypes(row, e.target.value)}
                    className="field-input text-[13px] py-2" placeholder="Ej. Fotografía, Video" />
                </label>
              </div>

              <button onClick={() => setOpenType(isOpen ? null : row.key)}
                className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                {isOpen ? "Ocultar checklist" : `Checklist (${items.length} paso${items.length === 1 ? "" : "s"})`}
              </button>

              {isOpen && (
                <div className="mt-3 pt-3 flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--border-2)" }}>
                  {items.length === 0 && (
                    <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
                      Aún no tiene pasos — la actividad se creará sin checklist hasta que agregues uno.
                    </p>
                  )}
                  {items.map((it, idx) => (
                    <div key={it.id} className="flex items-center gap-2 px-2 py-1.5 rounded-s" style={{ background: "var(--surface-2)" }}>
                      <span className="text-[11px] font-bold w-4 text-center shrink-0" style={{ color: "var(--text-3)" }}>
                        {idx + 1}
                      </span>
                      <span className="text-[13px] flex-1">{it.label}</span>
                      <button onClick={() => moveItem(tpl!, idx, -1)} disabled={idx === 0 || saving}
                        className="text-[12px] font-bold px-1.5 disabled:opacity-30" style={{ color: "var(--text-2)" }}>↑</button>
                      <button onClick={() => moveItem(tpl!, idx, 1)} disabled={idx === items.length - 1 || saving}
                        className="text-[12px] font-bold px-1.5 disabled:opacity-30" style={{ color: "var(--text-2)" }}>↓</button>
                      <button onClick={() => removeItem(it.id)} aria-label="Eliminar paso"
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                        <IconX className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-1.5">
                    <input className="field-input text-[13px] py-2 flex-1" placeholder="Nuevo paso…"
                      value={newItemLabel[row.key] ?? ""}
                      onChange={(e) => setNewItemLabel((f) => ({ ...f, [row.key]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") addItem(row.key); }} />
                    <button onClick={() => addItem(row.key)} disabled={saving}
                      className="btn-primary px-4 py-2 text-[12.5px]">
                      Agregar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card p-5">
        <p className="text-[13px] font-bold mb-3">Agregar tipo nuevo</p>
        <div className="grid md:grid-cols-2 gap-2.5 mb-2.5">
          <input className="field-input" placeholder="Nombre (ej. Podcast)"
            value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="field-input">
            {ICONS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
          </select>
        </div>
        <div className="grid md:grid-cols-2 gap-2.5 mb-3">
          <label className="block">
            <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>
              Anticipación mínima (días)
            </span>
            <input type="number" min={1} value={form.minDays}
              onChange={(e) => setForm({ ...form, minDays: Number(e.target.value) || 1 })}
              className="field-input" />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>
              Subtipos (separados por coma, opcional)
            </span>
            <input value={form.subtypes} onChange={(e) => setForm({ ...form, subtypes: e.target.value })}
              className="field-input" placeholder="Ej. Episodio, Clip corto" />
          </label>
        </div>
        <button className="btn-primary px-5 py-3 text-[13.5px] flex items-center gap-1.5 w-full justify-center"
          disabled={saving} onClick={add}>
          <IconPlus className="w-4 h-4" /> Agregar tipo
        </button>
        <p className="text-[11px] mt-2.5" style={{ color: "var(--text-3)" }}>
          El tipo queda disponible de inmediato en Nueva solicitud (coordinador) y en Agregar actividad (Mi Día).
        </p>
      </div>
    </>
  );
}
