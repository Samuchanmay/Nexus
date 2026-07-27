"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseMutation, PageHeader, Switch } from "@/components/shared";
import { IconPlus, IconX } from "@/components/icons";
import { Icon } from "@/components/os/icons";
import { SectionIntro } from "@/components/config-intro";
import type { GpsZone } from "@/lib/types";

export type DeviceGeoRow = { id: string; last_lat: number | null; last_lng: number | null; name: string };

/** Distancia entre dos coordenadas en metros (fórmula de Haversine) —
    misma lógica que valida el geofence en la Edge Function `fichar`,
    reimplementada acá solo para mostrar el contador dentro/fuera; no
    reemplaza la validación real del check-in. */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** bbox holgado (3x el radio, mínimo 150m) para que el pin no quede pegado al borde del iframe. */
function bboxFor(lat: number, lng: number, radioM: number) {
  const latDelta = Math.max(radioM * 3, 150) / 111320;
  const lngDelta = Math.max(radioM * 3, 150) / (111320 * Math.cos((lat * Math.PI) / 180));
  return { latMin: lat - latDelta, latMax: lat + latDelta, lngMin: lng - lngDelta, lngMax: lng + lngDelta };
}

export default function GpsClient({ zones, devices, embedded }: { zones: GpsZone[]; devices: DeviceGeoRow[]; embedded?: boolean }) {
  const { run, saving } = useSupabaseMutation();
  const [form, setForm] = useState({ nombre: "", lat: "", lng: "", radio_m: "50" });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState<string | null>(null);

  const locatedDevices = devices.filter((d) => d.last_lat != null && d.last_lng != null);

  const toggleActivo = (z: GpsZone) =>
    run(() => createClient().from("gps_zones").update({ activo: !z.activo }).eq("id", z.id),
      { ok: z.activo ? "Zona desactivada" : "Zona activada", err: "No se pudo actualizar" });

  const updateField = (z: GpsZone, patch: Partial<GpsZone>) =>
    run(() => createClient().from("gps_zones").update(patch).eq("id", z.id),
      { err: "No se pudo actualizar" });

  const remove = (z: GpsZone) => {
    setConfirmId(null);
    run(() => createClient().from("gps_zones").delete().eq("id", z.id),
      { ok: "Zona eliminada", err: "No se pudo eliminar" });
  };

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

  const zonasActivas = zones.filter((z) => z.activo).length;

  return (
    <>
      {!embedded && (
        <PageHeader title="Zona GPS" subtitle="Coordenadas y radio permitido para fichar en /fichar — se aplica sin tocar código ni redesplegar" />
      )}

      <SectionIntro
        stats={[
          { label: "Zonas", value: zones.length },
          { label: "Activas", value: zonasActivas, tone: "ok" },
          { label: "Con ubicación hoy", value: locatedDevices.length },
        ]}
        tip="El contador dentro/fuera de cada zona usa la última ubicación conocida de cada dispositivo (capturada en su fichaje más reciente) — no es una posición en vivo."
      />

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
                {confirmId === z.id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>¿Eliminar?</span>
                    <button disabled={saving} onClick={() => remove(z)}
                      className="text-[11.5px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                      Sí, eliminar
                    </button>
                    <button onClick={() => setConfirmId(null)}
                      className="text-[11.5px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                      No
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmId(z.id)} aria-label="Eliminar"
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                    <IconX className="w-3 h-3" />
                  </button>
                )}
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

            {(() => {
              const withDistance = locatedDevices.map((d) => ({
                ...d,
                distance: haversineM(z.lat, z.lng, d.last_lat as number, d.last_lng as number),
              }));
              const dentro = withDistance.filter((d) => d.distance <= z.radio_m);
              const fuera = withDistance.filter((d) => d.distance > z.radio_m);
              const isMapOpen = mapOpen === z.id;
              return (
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-2)" }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-4">
                      <span className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: "var(--ok)" }}>
                        <Icon name="check" size={12} /> {dentro.length} dentro
                      </span>
                      <span className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
                        <Icon name="signal" size={12} /> {fuera.length} fuera
                      </span>
                    </div>
                    <button onClick={() => setMapOpen(isMapOpen ? null : z.id)}
                      className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                      {isMapOpen ? "Ocultar mapa" : "Ver mapa"}
                    </button>
                  </div>
                  {isMapOpen && (() => {
                    const { latMin, latMax, lngMin, lngMax } = bboxFor(z.lat, z.lng, z.radio_m);
                    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lngMin}%2C${latMin}%2C${lngMax}%2C${latMax}&layer=mapnik&marker=${z.lat}%2C${z.lng}`;
                    return (
                      <div className="mt-3 rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-2)" }}>
                        <iframe title={`Mapa de ${z.nombre}`} src={src} className="w-full" style={{ height: 220, border: 0 }} loading="lazy" />
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
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
