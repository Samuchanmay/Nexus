"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseMutation, PageHeader, Switch, EmptyState } from "@/components/shared";
import { Icon } from "@/components/os/icons";
import { IconTrash } from "@/components/icons";
import { SectionIntro } from "@/components/config-intro";
import { logAdminAction } from "@/lib/admin-log";

export interface DeviceRow {
  id: string; device_id: string; active: boolean;
  first_seen_at: string; last_seen_at: string; name: string;
  user_agent: string | null; last_lat: number | null; last_lng: number | null;
}

/** Parser mínimo de User-Agent — suficiente para mostrar "Chrome · Windows"
    sin agregar una librería nueva. No pretende ser exhaustivo (ej. no
    distingue todas las variantes de navegadores basados en Chromium),
    solo dar contexto legible al admin para identificar el dispositivo. */
function parseUA(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: "Desconocido", os: "Desconocido" };
  let os = "Desconocido";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Desconocido";
  if (/EdgA?\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/CriOS/i.test(ua)) browser = "Chrome";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/FxiOS/i.test(ua)) browser = "Firefox";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Version\//i.test(ua) && /Safari\//i.test(ua)) browser = "Safari";
  return { browser, os };
}

const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 36e5;

export default function DispositivosClient({ devices, adminId, embedded }: { devices: DeviceRow[]; adminId?: string; embedded?: boolean }) {
  const { run, saving } = useSupabaseMutation();
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const toggle = async (d: DeviceRow) => {
    const ok = await run(() => createClient().from("known_devices").update({ active: !d.active }).eq("id", d.id),
      { ok: d.active ? "Dispositivo desactivado" : "Dispositivo reactivado" });
    if (ok && adminId) logAdminAction(createClient(), adminId, d.active ? "Desactivó dispositivo" : "Reactivó dispositivo", d.name);
  };

  const revoke = async (d: DeviceRow) => {
    setRevokeId(null);
    const ok = await run(() => createClient().from("known_devices").delete().eq("id", d.id),
      { ok: "Acceso revocado — deberá volver a vincularse en su próximo fichaje", err: "No se pudo revocar" });
    if (ok && adminId) logAdminAction(createClient(), adminId, "Revocó acceso de dispositivo", d.name);
  };

  const activos = devices.filter((d) => d.active).length;
  const recientes24h = devices.filter((d) => hoursSince(d.last_seen_at) <= 24).length;
  const masReciente = devices[0];

  return (
    <>
      {!embedded && (
        <PageHeader
          title="Dispositivos"
          subtitle="Cada teléfono/navegador queda vinculado a la primera persona que fichó desde ahí. Desactívalo si se pierde o cambia de dueño."
        />
      )}

      <SectionIntro
        stats={[
          { label: "Vinculados", value: devices.length },
          { label: "Activos", value: activos, tone: "ok" },
          { label: "Últimas 24h", value: recientes24h, tone: recientes24h > 0 ? "accent" : "default" },
        ]}
        recent={masReciente ? `${masReciente.name} — ${new Date(masReciente.last_seen_at).toLocaleString("es-MX")}` : undefined}
        tip="Desactivar solo bloquea el dispositivo temporalmente — si alguien lo perdió para siempre, mejor revócalo: la próxima persona que use ese teléfono deberá vincularlo desde cero."
      />

      {devices.length === 0 ? (
        <EmptyState icon={<Icon name="clock" size={22} />} title="Sin dispositivos registrados" hint="Aparecerán aquí en cuanto alguien use /fichar por primera vez." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {devices.map((d) => {
            const { browser, os } = parseUA(d.user_agent);
            const hasLocation = d.last_lat != null && d.last_lng != null;
            return (
              <div key={d.id} className="card px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold">{d.name}</p>
                  <p className="text-[12px] font-mono" style={{ color: "var(--text-3)" }}>{d.device_id}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <span className="text-[12px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                      {browser} · {os}
                    </span>
                    {hasLocation && (
                      <a
                        href={`https://www.google.com/maps?q=${d.last_lat},${d.last_lng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-[12px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                      >
                        <Icon name="pin" size={10} /> Ver ubicación
                      </a>
                    )}
                  </div>
                  <p className="text-[12px] mt-1" style={{ color: "var(--text-3)" }}>
                    Visto por última vez: {new Date(d.last_seen_at).toLocaleString("es-MX")}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <Switch tone="status" checked={d.active} onChange={() => toggle(d)} disabled={saving}
                    label={d.active ? "Activo" : "Desactivado"} />
                  {revokeId === d.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>¿Revocar?</span>
                      <button disabled={saving} onClick={() => revoke(d)}
                        className="text-[12px] font-semibold px-2 py-1 rounded-full"
                        style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                        Sí, revocar
                      </button>
                      <button onClick={() => setRevokeId(null)}
                        className="text-[12px] font-semibold px-2 py-1 rounded-full"
                        style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                        No
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setRevokeId(d.id)} aria-label="Revocar acceso (borra el vínculo permanentemente)"
                      title="Revocar acceso — borra el vínculo permanentemente"
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: "var(--danger-tint)", color: "var(--danger)" }}>
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
