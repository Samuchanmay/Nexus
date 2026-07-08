import { createClient } from "@/lib/supabase/server";
import EmpleadosClient from "./client";
import type { UserProfile, Department } from "@/lib/types";

export default async function Empleados() {
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("*").order("created_at");
  const { data: areas } = await supabase
    .from("departments").select("*").eq("activo", true).order("tipo").order("nombre");
  return (
    <EmpleadosClient
      users={(data ?? []) as UserProfile[]}
      areas={(areas ?? []) as Department[]}
    />
  );
}
