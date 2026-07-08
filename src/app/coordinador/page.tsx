import { createClient } from "@/lib/supabase/server";
import type { CommRequest, UserProfile } from "@/lib/types";
import CoordinadorClient from "./client";

export default async function Coordinador() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("*, departments(id, nombre, tipo)").eq("auth_id", user!.id).single();
  const { data: reqs } = await supabase
    .from("requests").select("*").eq("requester_id", profile!.id)
    .order("created_at", { ascending: false });
  return (
    <CoordinadorClient
      profile={profile as UserProfile}
      requests={(reqs ?? []) as CommRequest[]}
    />
  );
}
