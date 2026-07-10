import { createClient } from "@/lib/supabase/server";
import EstadosClient from "./client";
import type { JornadaState } from "@/lib/hours";

/* Configuración → Estados de Jornada — Plano Maestro §10.
   El comportamiento de cada estado (si cuenta como tiempo trabajado, si
   pausa la actividad en curso, si pide motivo) es editable aquí, sin
   tocar código. Los MOTIVOS del check-in en /fichar siguen fijos (son
   los oficiales del checador); estos estados solo definen su efecto. */
export default async function EstadosJornada() {
  const supabase = await createClient();
  const { data } = await supabase.from("jornada_states").select("*").order("orden");
  return <EstadosClient states={(data ?? []) as (JornadaState & { id: string })[]} />;
}
