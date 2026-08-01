import { createClient } from "@/lib/supabase/server";
import type { JornadaState } from "@/lib/hours";
import type { ActivityType, Department, GpsZone, Schedule } from "@/lib/types";
import type { DeviceRow } from "./dispositivos/client";
import type { Person } from "./horarios/client";
import type { DeviceGeoRow } from "./gps/client";
import type { ChecklistTemplateRow } from "./tipos-actividad/page";
import type { PausaFraseRow } from "./pausa-activa/page";
import ConfigHub from "./hub-client";

/* ═══════════════════════════════════════════════════════════════
   Centro de Configuración — hub tipo Ajustes de Apple (FASE E §314).

   Antes: cada categoría era un <Link> que navegaba a una ruta propia.
   Ahora: un solo Server Component pesca TODO en paralelo (igual que
   antes lo hacía cada page.tsx por separado) y se lo pasa a ConfigHub,
   que decide qué sección mostrar en el panel derecho por estado de
   cliente — sin navegación real. Las 7 rutas independientes
   (/admin/config/estados-jornada, etc.) se conservan intactas para
   quien llegue por un link directo o el mapa de dev-mode; renderizan
   el mismo *Client con embedded=false (su propio PageHeader). */
export default async function Config() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { count: usersCount },
    { count: coordinacionesCount },
    { data: estadosData },
    { data: devicesData },
    { data: horariosTeam },
    { data: horariosScheds },
    { data: gpsZonesData },
    { data: tiposData },
    { data: templatesData },
    { data: pausaFrasesData },
    { data: pausaSettingsData },
    { data: coloresAreasData },
    { data: rhColorRow },
    { data: meRow },
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("departments").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("jornada_states").select("*").order("orden"),
    supabase.from("known_devices")
      .select("id, device_id, active, first_seen_at, last_seen_at, user_agent, last_lat, last_lng, users(display_name)")
      .order("last_seen_at", { ascending: false }),
    supabase.from("users").select("id, display_name, full_name, nexus_color, avatar_url, birth_date, area")
      .eq("active", true).in("role", ["admin", "empleado"]).order("display_name"),
    supabase.from("schedules").select("*").order("valid_from", { ascending: false }),
    supabase.from("gps_zones").select("*").order("nombre"),
    supabase.from("activity_types").select("*").order("orden"),
    supabase.from("checklist_templates").select("id, type, checklist_items(id, position, label)"),
    supabase.from("pausa_activa_frases").select("*").order("orden"),
    supabase.from("app_settings").select("key, value")
      .in("key", ["pausa_activa_interval_min", "pausa_activa_window_min", "pausa_activa_modo"]),
    supabase.from("departments").select("*").order("tipo").order("nombre"),
    supabase.from("app_settings").select("value").eq("key", "rh_color").maybeSingle(),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
  ]);

  const devices: DeviceRow[] = (devicesData ?? []).map((d) => ({
    id: d.id as string,
    device_id: d.device_id as string,
    active: d.active as boolean,
    first_seen_at: d.first_seen_at as string,
    last_seen_at: d.last_seen_at as string,
    user_agent: (d.user_agent as string | null) ?? null,
    last_lat: (d.last_lat as number | null) ?? null,
    last_lng: (d.last_lng as number | null) ?? null,
    name: (d.users as unknown as { display_name: string } | null)?.display_name ?? "—",
  }));

  const gpsDevices: DeviceGeoRow[] = devices
    .filter((d) => d.active)
    .map((d) => ({ id: d.id, last_lat: d.last_lat, last_lng: d.last_lng, name: d.name }));

  const pausaSettingsMap = Object.fromEntries((pausaSettingsData ?? []).map((s) => [s.key, s.value]));

  // Antes estas dos tarjetas decían "Activo" siempre, sin importar el estado
  // real (texto de relleno, nunca conectado a nada) — ahora reflejan algo
  // verificable de verdad: si las credenciales de Supabase están puestas
  // (mismo gate real que usa middleware.ts para decidir "modo demo" vs
  // producción) y si hay una API key de Resend configurada para correo.
  const isProdMode = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isEmailConfigured = !!process.env.RESEND_API_KEY;

  return (
    <ConfigHub
      topStats={{ users: usersCount ?? 0, coordinaciones: coordinacionesCount ?? 0 }}
      isProdMode={isProdMode}
      isEmailConfigured={isEmailConfigured}
      adminId={meRow?.id ?? ""}
      estados={(estadosData ?? []) as (JornadaState & { id: string })[]}
      devices={devices}
      horariosTeam={(horariosTeam ?? []) as Person[]}
      horariosScheds={(horariosScheds ?? []) as Schedule[]}
      gpsZones={(gpsZonesData ?? []) as GpsZone[]}
      gpsDevices={gpsDevices}
      tipos={(tiposData ?? []) as ActivityType[]}
      templates={(templatesData ?? []) as unknown as ChecklistTemplateRow[]}
      pausaFrases={(pausaFrasesData ?? []) as PausaFraseRow[]}
      pausaIntervalMin={Number(pausaSettingsMap.pausa_activa_interval_min) || 120}
      pausaWindowMin={Number(pausaSettingsMap.pausa_activa_window_min) || 12}
      pausaModo={pausaSettingsMap.pausa_activa_modo === "aleatorio" ? "aleatorio" : "secuencial"}
      coloresAreas={(coloresAreasData ?? []) as Department[]}
      rhColor={rhColorRow?.value ?? null}
    />
  );
}
