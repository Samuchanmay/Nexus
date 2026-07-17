import { createClient } from "@/lib/supabase/server";
import { typeLabels } from "@/lib/types";
import type { ActivityType } from "@/lib/types";
import BibliotecaClient, { type Item } from "@/app/admin/biblioteca/client";

/* ═══════════════════════════════════════════════════════════════
   Biblioteca institucional para el equipo — misma vista de solo
   lectura que admin/biblioteca (el componente ya era 100% lectura,
   "nadie edita aquí"), solo que accesible fuera de /admin.
   Antes "Biblioteca" aparecía en el nav de todos los roles (NAV en
   src/lib/nav.ts la marca roles: "all") pero nunca tuvo una ruta
   para empleado/coordinador/rh — el enlace apuntaba a /admin/biblioteca,
   que el layout de /admin bloquea para cualquiera que no sea admin
   (redirect a "/"). Con esta página, el resto del equipo por fin
   puede consultar el archivo de actividades terminadas.
   ═══════════════════════════════════════════════════════════════ */

export default async function BibliotecaEquipo() {
  const supabase = await createClient();
  const [{ data }, { data: types }] = await Promise.all([
    supabase
      .from("projects")
      .select(`
        id, deadline, priority,
        requests(title, type, subtype, requester_name, requester_area, event_date),
        project_assignments(is_lead, users(display_name, nexus_color)),
        evidences(id, drive_url, publish_url, created_at),
        comments(id)
      `)
      .eq("status", "completada")
      .order("deadline", { ascending: false }),
    supabase.from("activity_types").select("*").order("orden"),
  ]);
  const activityTypes = (types ?? []) as ActivityType[];

  return (
    <BibliotecaClient
      items={(data ?? []) as unknown as Item[]}
      typeLabel={typeLabels(activityTypes)}
      types={activityTypes.map((t) => ({ key: t.key, label: t.label }))}
    />
  );
}
