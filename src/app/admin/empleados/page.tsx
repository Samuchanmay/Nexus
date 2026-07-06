import { createClient } from "@/lib/supabase/server";
import EmpleadosClient from "./client";
import type { UserProfile } from "@/lib/types";

export default async function Empleados() {
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("*").order("created_at");
  return <EmpleadosClient users={(data ?? []) as UserProfile[]} />;
}
