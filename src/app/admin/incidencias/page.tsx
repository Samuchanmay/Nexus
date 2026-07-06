import { createClient } from "@/lib/supabase/server";
import type { Incident } from "@/lib/types";
import IncAdminClient from "./client";

export default async function IncidenciasAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incidents")
    .select("*, users(full_name, display_name)")
    .order("created_at", { ascending: false });
  return <IncAdminClient incidents={(data ?? []) as unknown as Incident[]} />;
}
