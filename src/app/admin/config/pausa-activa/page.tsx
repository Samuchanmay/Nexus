import { createClient } from "@/lib/supabase/server";
import PausaActivaClient from "./client";

export type PausaFraseRow = { id: string; texto: string; orden: number; activo: boolean };

/* Configuración → Pausa activa — controla las frases que rota el
   Asistente Contextual (Plano Maestro §11, regla 0b) y el ritmo con el
   que aparecen: cada cuántos minutos de trabajo continuo, y cuántos
   minutos permanece visible cada aviso. Antes esto vivía hardcodeado en
   src/lib/assistant.ts; ahora es editable sin tocar código. */
export default async function PausaActiva() {
  const supabase = await createClient();
  const [{ data: frases }, { data: settings }] = await Promise.all([
    supabase.from("pausa_activa_frases").select("*").order("orden"),
    supabase.from("app_settings").select("key, value")
      .in("key", ["pausa_activa_interval_min", "pausa_activa_window_min"]),
  ]);
  const settingsMap = Object.fromEntries((settings ?? []).map((s) => [s.key, s.value]));
  return (
    <PausaActivaClient
      frases={(frases ?? []) as PausaFraseRow[]}
      intervalMin={Number(settingsMap.pausa_activa_interval_min) || 120}
      windowMin={Number(settingsMap.pausa_activa_window_min) || 12}
    />
  );
}
