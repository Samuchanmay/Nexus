import { createClient } from "@/lib/supabase/server";
import TiposClient from "./client";
import type { ActivityType } from "@/lib/types";

export type ChecklistTemplateRow = {
  id: string;
  type: string;
  checklist_items: { id: string; position: number; label: string }[];
};

/* Configuración → Tipos de Actividad — Plano Maestro §04/§10.
   Antes, los 5 tipos (Cobertura/Diseño/Lona/Video/Difusión) estaban fijos
   en el código. Ahora viven en la tabla activity_types: un admin puede
   agregar uno nuevo (ej. "Podcast") con su propio checklist, sin que se
   toque una sola línea de código ni se vuelva a desplegar la app. */
export default async function TiposActividad() {
  const supabase = await createClient();
  const [{ data: types }, { data: templates }] = await Promise.all([
    supabase.from("activity_types").select("*").order("orden"),
    supabase.from("checklist_templates").select("id, type, checklist_items(id, position, label)"),
  ]);
  return (
    <TiposClient
      types={(types ?? []) as ActivityType[]}
      templates={(templates ?? []) as unknown as ChecklistTemplateRow[]}
    />
  );
}
