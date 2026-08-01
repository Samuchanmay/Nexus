import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayMerida } from "@/lib/tz";
import { resolverContextoJornada, type JornadaStateDef } from "@/lib/jornada-flow";
import { fraseDelDia } from "./quotes";
import FicharClient from "./client";
import type { AttendanceRow } from "@/lib/types";

// Nunca cachear: todo lo que se calcula aquí (estado, acciones válidas,
// preselección) depende de los movimientos de HOY de esta persona.
export const dynamic = "force-dynamic";

// Resuelve TODO el contexto de la pantalla en el servidor — sesión,
// movimientos de hoy, catálogo de estados, zonas GPS y la frase del día —
// antes de renderizar nada. Así el cliente nunca "recalcula en vivo" ni
// parpadea: solo confirma la acción que este cálculo ya determinó.
export default async function FicharPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users").select("id, display_name, area, active, avatar_url, nexus_color").eq("auth_id", user.id).single();
  if (!profile || !profile.active) redirect("/login?error=no-autorizado");

  const hoy = todayMerida();
  const [{ data: attendanceRaw }, { data: statesRaw }, { data: zonesRaw }] = await Promise.all([
    supabase.from("attendance").select("id, user_id, type, reason, date, time, distance_m")
      .eq("user_id", profile.id).eq("date", hoy).order("time", { ascending: true }),
    supabase.from("jornada_states")
      .select("nombre, activo, emoji, motivo_salida, motivo_regreso, label_salida, label_regreso, desc_salida, desc_regreso, limite_salida, prioridad_manana, prioridad_mediodia, prioridad_tarde")
      .eq("activo", true),
    supabase.from("gps_zones").select("lat, lng, radio_m").eq("activo", true),
  ]);

  const attendance = (attendanceRaw ?? []) as AttendanceRow[];
  const states = (statesRaw ?? []) as JornadaStateDef[];
  const contexto = resolverContextoJornada(attendance, states);
  const frase = fraseDelDia(contexto.momento);

  return (
    <FicharClient
      nombre={profile.display_name}
      area={profile.area ?? ""}
      avatarUrl={profile.avatar_url ?? null}
      color={profile.nexus_color ?? "#0066FF"}
      contexto={contexto}
      frase={frase}
      zonas={(zonesRaw ?? []).length ? zonesRaw! : null}
    />
  );
}
