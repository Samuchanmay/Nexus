import { createClient } from "@/lib/supabase/server";
import DispositivosClient from "./client";

export default async function Dispositivos() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("known_devices")
    .select("id, device_id, active, first_seen_at, last_seen_at, users(display_name)")
    .order("last_seen_at", { ascending: false });

  const rows = (data ?? []).map((d) => ({
    id: d.id as string,
    device_id: d.device_id as string,
    active: d.active as boolean,
    first_seen_at: d.first_seen_at as string,
    last_seen_at: d.last_seen_at as string,
    name: (d.users as unknown as { display_name: string } | null)?.display_name ?? "—",
  }));

  return <DispositivosClient devices={rows} />;
}
