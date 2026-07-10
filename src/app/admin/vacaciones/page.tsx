import { createClient } from "@/lib/supabase/server";
import type { Vacation } from "@/lib/types";
import VacAdminClient from "./client";

export default async function VacacionesAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: vacs }, { data: team }, meRes] = await Promise.all([
    supabase.from("vacations")
      .select("*, users(full_name, display_name, nexus_color)")
      .order("created_at", { ascending: false }),
    supabase.from("users").select("id, display_name, vacation_balance, vacation_days_per_year, hire_date, nexus_color")
      .eq("active", true).in("role", ["admin", "empleado"]),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  return (
    <VacAdminClient
      vacations={(vacs ?? []) as unknown as Vacation[]}
      team={(team ?? []) as { id: string; display_name: string; vacation_balance: number; vacation_days_per_year: number; hire_date: string | null; nexus_color: string | null }[]}
      adminId={meRes?.data?.id ?? ""}
    />
  );
}
