import { createClient } from "@/lib/supabase/server";
import type { Incident } from "@/lib/types";
import IncAdminClient from "./client";

export default async function IncidenciasAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data }, { data: team }, meRes] = await Promise.all([
    supabase.from("incidents")
      .select("*, users(full_name, display_name)")
      .order("created_at", { ascending: false }),
    supabase.from("users").select("id, display_name").eq("active", true).in("role", ["admin", "empleado"]).order("display_name"),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  return (
    <IncAdminClient
      incidents={(data ?? []) as unknown as Incident[]}
      team={(team ?? []) as { id: string; display_name: string }[]}
      adminId={meRes?.data?.id ?? ""}
    />
  );
}
