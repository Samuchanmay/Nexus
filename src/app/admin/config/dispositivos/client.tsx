"use client";
import { createClient } from "@/lib/supabase/client";
import { useSupabaseMutation, PageHeader, Switch, EmptyState } from "@/components/shared";
import { Icon } from "@/components/os/icons";

export interface DeviceRow {
  id: string; device_id: string; active: boolean;
  first_seen_at: string; last_seen_at: string; name: string;
}

export default function DispositivosClient({ devices }: { devices: DeviceRow[] }) {
  const { run, saving } = useSupabaseMutation();

  const toggle = (d: DeviceRow) =>
    run(() => createClient().from("known_devices").update({ active: !d.active }).eq("id", d.id),
      { ok: d.active ? "Dispositivo desactivado" : "Dispositivo reactivado" });

  return (
    <>
      <PageHeader
        title="Dispositivos"
        subtitle="Cada teléfono/navegador queda vinculado a la primera persona que fichó desde ahí. Desactívalo si se pierde o cambia de dueño."
      />

      {devices.length === 0 ? (
        <EmptyState icon={<Icon name="clock" size={22} />} title="Sin dispositivos registrados" hint="Aparecerán aquí en cuanto alguien use /fichar por primera vez." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {devices.map((d) => (
            <div key={d.id} className="card px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[13.5px] font-bold">{d.name}</p>
                <p className="text-[11.5px] font-mono" style={{ color: "var(--text-3)" }}>{d.device_id}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
                  Visto por última vez: {new Date(d.last_seen_at).toLocaleString("es-MX")}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Switch tone="status" checked={d.active} onChange={() => toggle(d)} disabled={saving}
                  label={d.active ? "Activo" : "Desactivado"} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
