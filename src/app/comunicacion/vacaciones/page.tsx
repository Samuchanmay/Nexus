import { createClient } from "@/lib/supabase/server";
import type { Vacation } from "@/lib/types";
import VacacionesClient from "./client";
import { DomainTabs } from "@/components/os/domain-tabs";

export default async function Vacaciones() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("id, display_name, vacation_balance, hire_date, role").eq("auth_id", user!.id).single();
  // Esta ruta la sirven tanto empleado como admin (ComunicacionLayout es
  // superset) — DomainTabs necesita el rol real, igual que en jornada/page.tsx.
  const role = profile!.role === "admin" ? "admin" : "empleado";

  const [{ data: vacs }, { data: hols }] = await Promise.all([
    supabase.from("vacations").select("*").eq("user_id", profile!.id).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("holidays").select("date"),
  ]);

  return (
    <>
      <DomainTabs domain="tiempo" role={role} />
      <VacacionesClient
        userId={profile!.id}
        displayName={profile!.display_name}
        balance={profile!.vacation_balance}
        hireDate={profile!.hire_date}
        vacations={(vacs ?? []) as Vacation[]}
        holidays={(hols ?? []).map((h) => h.date as string)}
      />
    </>
  );
}
