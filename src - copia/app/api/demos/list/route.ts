import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Lista las demos (recorridos) publicadas que un miembro debe ver en su
 * onboarding. Delegada en la RPC get_onboarding_demos (security definer),
 * que filtra por status = 'publicado' y por el target_role del usuario.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { data: demos, error } = await supabase.rpc("get_onboarding_demos");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ demos });
}
