import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PUT /api/admin/ai-config
 * Actualiza un valor de configuración de IA (solo admin).
 * Body: { key: string, value: string }
 */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users").select("role").eq("auth_id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.key !== "string" || typeof body.value !== "string") {
    return NextResponse.json({ error: "Faltan campos: key, value" }, { status: 400 });
  }

  if (!body.key.startsWith("ai_")) {
    return NextResponse.json({ error: "Key inválida (debe empezar con 'ai_')" }, { status: 400 });
  }

  const { error } = await supabase.rpc("nx_set_ai_config", {
    p_key: body.key,
    p_value: body.value,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/admin/ai-config
 * Obtiene la configuración de IA (solo admin).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users").select("role").eq("auth_id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const { data: configRows, error } = await supabase.rpc("nx_get_ai_config");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const config: Record<string, string> = {};
  if (configRows) {
    for (const row of configRows) {
      config[row.key] = row.value;
    }
  }

  return NextResponse.json({ config });
}
