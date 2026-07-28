import { createClient } from "@/lib/supabase/server";
import DiasClient from "./client";

export default async function DiasInhabiles() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data }, { data: meRow }] = await Promise.all([
    supabase.from("holidays").select("*").order("date"),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  return (
    <DiasClient
      holidays={(data ?? []) as { id: string; date: string; name: string; kind: string; notes: string | null }[]}
      adminId={meRow?.id ?? ""}
    />
  );
}
