import { createClient } from "@/lib/supabase/server";
import type { GpsZone } from "@/lib/types";
import GpsClient from "./client";

/* Configuración → Zona GPS — antes las coordenadas del geofence vivían
   fijas en variables de entorno (NEXT_PUBLIC_OFICINA_LAT/LNG/RADIO_MAX_M
   en Vercel + OFICINA_LAT/LNG en la Edge Function), así que cambiarlas
   requería tocar Vercel/Supabase y redesplegar. Ahora viven en la tabla
   `gps_zones`, editable desde aquí — /fichar (cliente) y la Edge
   Function `fichar` leen esta tabla en cada intento de check-in y
   aceptan si la persona está dentro del radio de CUALQUIER zona activa
   (soporta múltiples sedes/puntos válidos). */
export default async function Gps() {
  const supabase = await createClient();
  const [{ data }, { data: devicesData }] = await Promise.all([
    supabase.from("gps_zones").select("*").order("nombre"),
    supabase.from("known_devices").select("id, active, last_lat, last_lng, users(display_name)").eq("active", true),
  ]);
  const devices = (devicesData ?? []).map((d) => ({
    id: d.id as string,
    last_lat: (d.last_lat as number | null) ?? null,
    last_lng: (d.last_lng as number | null) ?? null,
    name: (d.users as unknown as { display_name: string } | null)?.display_name ?? "—",
  }));
  return <GpsClient zones={(data ?? []) as GpsZone[]} devices={devices} />;
}
