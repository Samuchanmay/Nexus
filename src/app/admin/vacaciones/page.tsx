import { createClient } from "@/lib/supabase/server";
import type { Vacation } from "@/lib/types";
import VacAdminClient from "./client";

export default async function VacacionesAdmin() {
  const supabase = await createClient();
  const [{ data: vacs }, { data: team }] = await Promise.all([
    supabase.from("vacations")
      .select("*, users(full_name, display_name, nexus_color)")
      .order("created_at", { ascending: false }),
    supabase.from("users").select("id, display_name, vacation_balance, nexus_color")
      .eq("active", true).in("role", ["admin", "empleado"]),
  ]);
  return (
    <VacAdminClient
      vacations={(vacs ?? []) as unknown as Vacation[]}
      team={(team ?? []) as { id: string; display_name: string; vacation_balance: number; nexus_color: string | null }[]}
    />
  );
}
