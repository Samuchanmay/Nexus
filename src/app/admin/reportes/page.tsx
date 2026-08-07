import { createClient } from "@/lib/supabase/server";
import { ReportesClient } from "./client";

/* ═══════════════════════════════════════════════════════════════
   Reportes — landing de los 4 reportes operativos (rediseño 7 ago
   2026, ver docs/audits/report-system-audit.md). Reemplaza al viejo
   dashboard de agregados (KPIs/tendencia/cuello de botella), que el
   usuario pidió eliminar de este módulo.

   Este server component solo trae los catálogos (equipo, coordinaciones)
   y el adminId; todo el filtrado/descarga vive en client.tsx usando
   el ReportEngine (src/lib/reports/*).
   ═══════════════════════════════════════════════════════════════ */

export default async function Reportes() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: team }, { data: departments }, meRes] = await Promise.all([
    supabase.from("users").select("id, display_name, nexus_color, avatar_url, area, area_id, departments(id, nombre)")
      .eq("active", true).in("role", ["admin", "empleado"]).order("display_name"),
    supabase.from("departments").select("id, nombre, tipo").order("nombre"),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  const adminId = meRes?.data?.id ?? "";

  return (
    <ReportesClient
      team={team ?? []}
      departments={departments ?? []}
      adminId={adminId}
    />
  );
}
