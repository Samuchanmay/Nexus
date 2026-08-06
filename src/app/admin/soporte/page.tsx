import { createClient } from "@/lib/supabase/server";
import type { SupportTicket } from "@/lib/types";
import SoporteAdminClient from "./client";

export type SupportTicketRow = SupportTicket & {
  requester: { display_name: string; avatar_url: string | null; nexus_color: string | null } | null;
};

export default async function AdminSoporte() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("users").select("id").eq("auth_id", user!.id).single();

  const { data: rows } = await supabase
    .from("support_tickets")
    .select("id, user_id, category, title, description, status, admin_id, admin_response, created_at, updated_at, resolved_at, requester:user_id(display_name, avatar_url, nexus_color)")
    .order("created_at", { ascending: false });

  // Embedded to-one relation — Supabase infiere array sin tipos generados
  // (mismo patrón defensivo que event_history admin:admin_id en
  // admin/calendario/client.tsx).
  const tickets: SupportTicketRow[] = ((rows ?? []) as unknown as (SupportTicket & { requester: unknown })[]).map((r) => ({
    ...r,
    requester: (Array.isArray(r.requester) ? r.requester[0] : r.requester) as SupportTicketRow["requester"],
  }));

  return <SoporteAdminClient adminId={me!.id} initialTickets={tickets} />;
}
