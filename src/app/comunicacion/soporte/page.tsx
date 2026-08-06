import { createClient } from "@/lib/supabase/server";
import type { SupportTicket } from "@/lib/types";
import SoporteClient from "./client";

/**
 * FASE W8 — Soporte interno, lado empleado. Ruta plana (no es pestaña de
 * ningún hub existente) — mismo criterio que /chat o /admin/proyectos:
 * un dominio propio, un solo click desde el sidebar.
 */
export default async function Soporte() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("users").select("id").eq("auth_id", user!.id).single();
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, user_id, category, title, description, status, admin_id, admin_response, created_at, updated_at, resolved_at")
    .eq("user_id", me!.id)
    .order("created_at", { ascending: false });

  return <SoporteClient userId={me!.id} initialTickets={(tickets ?? []) as SupportTicket[]} />;
}
