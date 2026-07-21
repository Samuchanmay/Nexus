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
  const { data } = await supabase.from("gps_zones").select("*").order("nombre");
  return <GpsClient zones={(data ?? []) as GpsZone[]} />;
}
