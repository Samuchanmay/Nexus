import { createClient } from "@/lib/supabase/server";
import EmpleadosClient from "./client";
import type { UserProfile, Department } from "@/lib/types";

export default async function Empleados() {
  const supabase = await createClient();
  const [{ data }, { data: areas }, { data: rhColorRow }] = await Promise.all([
    supabase.from("users").select("*").order("created_at"),
    supabase.from("departments").select("*").eq("activo", true).order("tipo").order("nombre"),
    supabase.from("app_settings").select("value").eq("key", "rh_color").maybeSingle(),
  ]);
  return (
    <EmpleadosClient
      users={(data ?? []) as UserProfile[]}
      areas={(areas ?? []) as Department[]}
      rhColor={rhColorRow?.value ?? null}
    />
  );
}
