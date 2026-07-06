import { createClient } from "@/lib/supabase/server";
import type { CommRequest, UserProfile } from "@/lib/types";
import CoordinadorClient from "./client";

export default async function Coordinador() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users").select("*").eq("auth_id", user!.id).single();
  const [{ data: reqs }, { data: catalogs }] = await Promise.all([
    supabase.from("requests").select("*").eq("requester_id", profile!.id)
      .order("created_at", { ascending: false }),
    supabase.from("catalog_items").select("catalog, label").eq("active", true),
  ]);
  return (
    <CoordinadorClient
      profile={profile as UserProfile}
      requests={(reqs ?? []) as CommRequest[]}
      niveles={(catalogs ?? []).filter((c) => c.catalog === "niveles").map((c) => c.label as string)}
    />
  );
}
