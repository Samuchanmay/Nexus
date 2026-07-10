import { createClient } from "@/lib/supabase/server";
import type { Vacation } from "@/lib/types";
import VacacionesClient from "./client";

export default async function Vacaciones() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("id, display_name, vacation_balance, hire_date").eq("auth_id", user!.id).single();

  const [{ data: vacs }, { data: hols }] = await Promise.all([
    supabase.from("vacations").select("*").eq("user_id", profile!.id).order("created_at", { ascending: false }),
    supabase.from("holidays").select("date"),
  ]);

  return (
    <VacacionesClient
      userId={profile!.id}
      balance={profile!.vacation_balance}
      hireDate={profile!.hire_date}
      vacations={(vacs ?? []) as Vacation[]}
      holidays={(hols ?? []).map((h) => h.date as string)}
    />
  );
}
