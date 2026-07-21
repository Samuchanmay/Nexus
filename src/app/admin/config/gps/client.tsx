"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseMutation, PageHeader, Switch } from "@/components/shared";
import { IconPlus, IconX } from "@/components/icons";
import { Icon } from "@/components/os/icons";
import type { GpsZone } from "@/lib/types";

export default function GpsClient({ zones }: { zones: GpsZone[] }) {
  const { run, saving } = useSupabaseMutation();
  const [form, setForm] = useState({ nombre: "", lat: "", lng: "", radio_m: "50" });

  const toggleActivo = (z: GpsZone) =>
    run(() => createClient().from("gps_zones").update({ activo: !z.activo }).eq("id", z.id),
      { ok: z.activo ? "Zona desactivada" : "Zona activada", err: "No se pudo actualizar" });

  const updateField = (z: GpsZone, patch: Partial<GpsZone>) =>
    run(() => createClient().from("gps_zones").update(patch).eq("id", z.id),
      { err: "No se pudo actualizar" });

  const remove = (z: GpsZone) =>
    run(() => createClient().from("gps_zones").delete().eq("id", z.id),
      { ok: "Zona eliminada", err: "No se pudo eliminar" });

  const add = async () => {
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    const radio_m = parseInt(form.radio_m, 10);
    if (!form.nombre.trim() || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radio_m)) return;
    const ok = await run(async () => {
      const { error } = await createClient().from("gps_zones").insert({
        nombre: form.nombre.trim(), lat, lng, radio_m, activo: true,
      });
      return { error: error ? { message: "No se pudo guardar la zona" } : null };
    }, { ok: "Zona creada" });
    if (ok) setForm({ nombre: "", lat: "", lng: "", radio_m: "50" });
  };

  return (
    <>
      <PageHeader title="Zona GPS" subtitle="Coordenadas y radio permitido para fichar en /fichar — se aplica sin tocar código ni redesplegar" />

      <div className="card p-4 mb-5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
        Alguien puede fichar si está dentro del radio de <strong>cualquiera</strong> de las zonas activas.
        Agrega una zona por cada sede o punto de trabajo válido (ej. una temporal para una comisión).
      </div>

      <div className="flex flex-col gap-2.5 mb-6">
        {zones.length === 0 && (
          <div className="card p-4 text-[13px]" style={{ color: "var(--text-3)" }}>
            No hay zonas configuradas todavía — mientras tanto se usa una zona de respaldo fija en el código.
          </div>
        )}
        {zones.map((z) => (
          <div key={z.id} className="card p-4" style={{ opacity: z.activo ? 1 : 0.5 }}>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-8 h-8 rounded-full grid place-items-center shrink-0"
                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
                  <Icon name="pin" size={15} />
                </span>
                <input className="field-input font-bold min-w-0" defaultValue={z.nombre}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value !== z.nombre) updateField(z, { nombre: e.target.value.trim() }); }} />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch tone="status" checked={z.activo} onChange={() => toggleActivo(z)} disabled={saving}
                  label={z.activo ? "Activa" : "Inactiva"} />
                <button onClick={() => remove(z)} aria-label="Eliminar"
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                  <IconX className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2.5">
              <label className="block">
                <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>Latitud</span>
                <input className="field-input" type="number" step="0.000001" defaultValue={z.lat}
                  onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v !== z.lat) updateField(z, { lat: v }); }} />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>Longitud</span>
                <input className="field-input" type="number" step="0.000001" defaultValue={z.lng}
                  onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v !== z.lng) updateField(z, { lng: v }); }} />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-3)" }}>Radio (metros)</span>
                <input className="field-input" type="number" step="1" defaultValue={z.radio_m}
                  onBlur={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v) && v !== z.radio_m) updateField(z, { radio_m: v }); }} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <p className="text-[13px] font-bold mb-3">Agregar zona nueva</p>
        <div className="grid md:grid-cols-[1.3fr_1fr_1fr_90px_auto] gap-2.5">
          <input className="field-input" placeholder="Nombre (ej. Oficina Caucel)"
            value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <input className="field-input" placeholder="Latitud" type="number" step="0.000001"
            value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
          <input className="field-input" placeholder="Longitud" type="number" step="0.000001"
            value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
          <input className="field-input" placeholder="Radio m" type="number" step="1"
            value={form.radio_m} onChange={(e) => setForm({ ...form, radio_m: e.target.value })} />
          <button className="btn-primary px-5 py-3 text-[13.5px] flex items-center gap-1.5 justify-center" disabled={saving} onClick={add}>
            <IconPlus className="w-4 h-4" /> Agregar
          </button>
        </div>
        <p className="text-[11px] mt-2.5" style={{ color: "var(--text-3)" }}>
          Tip: en Google Maps, clic derecho sobre el punto exacto y copia las coordenadas (latitud, longitud).
        </p>
      </div>
    </>
  );
}
