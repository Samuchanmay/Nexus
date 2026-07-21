import { createClient } from "@/lib/supabase/server";
import type { Department } from "@/lib/types";
import ColoresClient from "./client";

/* Configuración → Colores de equipo — cada coordinación/departamento
   tiene un color fijo (departments.color); RH tiene un color propio
   (app_settings.rh_color) porque no pertenece a una coordinación. Un
   color usado por un grupo activo queda bloqueado para los demás — el
   siguiente grupo que se agregue recibe automáticamente el próximo
   color libre de la paleta (lib/colors.ts::nextAvailableColor). Las
   personas heredan el color de su grupo (ver admin/empleados/client.tsx
   ::resolvedColor) — solo Empleado elige color manualmente. */
export default async function Colores() {
  const supabase = await createClient();
  const [{ data: areas }, { data: rhColorRow }] = await Promise.all([
    supabase.from("departments").select("*").order("tipo").order("nombre"),
    supabase.from("app_settings").select("value").eq("key", "rh_color").maybeSingle(),
  ]);
  return <ColoresClient areas={(areas ?? []) as Department[]} rhColor={rhColorRow?.value ?? null} />;
}
