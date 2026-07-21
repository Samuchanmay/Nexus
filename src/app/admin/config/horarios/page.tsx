import { createClient } from "@/lib/supabase/server";
import type { Schedule } from "@/lib/types";
import HorariosClient from "./client";

/* Configuración → Horarios — permite ajustar la hora de entrada y las
   horas objetivo por persona, y crear horarios TEMPORALES con rango de
   fechas (ej. cobertura durante vacaciones: "Citlaly entra a las 4pm y
   trabaja 5h del 21 al 28 de julio"). Se apoya en las columnas
   valid_from/valid_until que ya existían en `schedules` pero nunca se
   usaban desde la UI — ver lib/hours.ts::scheduleFor. */
export default async function Horarios() {
  const supabase = await createClient();
  const [{ data: team }, { data: scheds }] = await Promise.all([
    supabase.from("users").select("id, display_name, full_name, nexus_color, avatar_url, area")
      .eq("active", true).in("role", ["admin", "empleado"]).order("display_name"),
    supabase.from("schedules").select("*").order("valid_from", { ascending: false }),
  ]);

  return (
    <HorariosClient
      team={team ?? []}
      schedules={(scheds ?? []) as Schedule[]}
    />
  );
}
