import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Registra un evento de visualización de un demo (analytics de onboarding).
 * Eventos: 'abierta' | 'completada'. Cualquier miembro autenticado.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("users").select("id").eq("auth_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Perfil no encontrado." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { demo_id?: string; event?: string } | null;
  if (!body?.demo_id || !body.event) {
    return NextResponse.json({ error: "Faltan campos: demo_id, event." }, { status: 400 });
  }
  if (!["abierta", "completada"].includes(body.event)) {
    return NextResponse.json({ error: "event inválido." }, { status: 400 });
  }

  const { error } = await supabase
    .from("demo_views")
    .insert({ demo_id: body.demo_id, user_id: profile.id, event: body.event });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
