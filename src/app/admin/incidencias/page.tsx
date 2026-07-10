import { createClient } from "@/lib/supabase/server";
import type { Incident } from "@/lib/types";
import IncAdminClient from "./client";

export default async function IncidenciasAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data }, meRes] = await Promise.all([
    supabase.from("incidents")
      .select("*, users(full_name, display_name)")
      .order("created_at", { ascending: false }),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  return <IncAdminClient incidents={(data ?? []) as unknown as Incident[]} adminId={meRes?.data?.id ?? ""} />;
}
