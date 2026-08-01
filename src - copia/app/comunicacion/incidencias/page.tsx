import { createClient } from "@/lib/supabase/server";
import type { Incident } from "@/lib/types";
import IncidenciasClient from "./client";
import { DomainTabs } from "@/components/os/domain-tabs";

export default async function Incidencias() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("id, role").eq("auth_id", user!.id).single();
  // Esta ruta la sirven tanto empleado como admin (ComunicacionLayout es
  // superset) — DomainTabs necesita el rol real, igual que en jornada/page.tsx.
  const role = profile!.role === "admin" ? "admin" : "empleado";
  const { data: incs } = await supabase
    .from("incidents").select("*").eq("user_id", profile!.id).order("created_at", { ascending: false });
  return (
    <>
      <DomainTabs domain="tiempo" role={role} />
      <IncidenciasClient userId={profile!.id} incidents={(incs ?? []) as Incident[]} />
    </>
  );
}
