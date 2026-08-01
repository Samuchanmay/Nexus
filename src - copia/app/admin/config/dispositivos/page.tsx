import { createClient } from "@/lib/supabase/server";
import DispositivosClient from "./client";

export default async function Dispositivos() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data }, { data: meRow }] = await Promise.all([
    supabase
      .from("known_devices")
      .select("id, device_id, active, first_seen_at, last_seen_at, user_agent, last_lat, last_lng, users(display_name)")
      .order("last_seen_at", { ascending: false }),
    user ? supabase.from("users").select("id").eq("auth_id", user.id).single() : Promise.resolve({ data: null }),
  ]);

  const rows = (data ?? []).map((d) => ({
    id: d.id as string,
    device_id: d.device_id as string,
    active: d.active as boolean,
    first_seen_at: d.first_seen_at as string,
    last_seen_at: d.last_seen_at as string,
    user_agent: (d.user_agent as string | null) ?? null,
    last_lat: (d.last_lat as number | null) ?? null,
    last_lng: (d.last_lng as number | null) ?? null,
    name: (d.users as unknown as { display_name: string } | null)?.display_name ?? "—",
  }));

  return <DispositivosClient devices={rows} adminId={meRow?.id ?? ""} />;
}
