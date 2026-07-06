import { createClient } from "@/lib/supabase/server";
import DiasClient from "./client";

export default async function DiasInhabiles() {
  const supabase = await createClient();
  const { data } = await supabase.from("holidays").select("*").order("date");
  return <DiasClient holidays={(data ?? []) as { id: string; date: string; name: string; kind: string }[]} />;
}
