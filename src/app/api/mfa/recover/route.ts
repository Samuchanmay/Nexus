import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Consume un código de respaldo y, si es válido, borra el/los factor(es)
 * TOTP de la persona vía Admin API (service role — mismo patrón que
 * auth/callback/route.ts). El estado AAL de la sesión lo controla
 * Supabase Auth por dentro; ninguna tabla propia puede "forzarlo" a aal2,
 * así que la única forma real de recuperar el acceso es dejar a la
 * persona sin factor (vuelve a aal1/aal1) para que el middleware la
 * mande directo a /mfa/setup a dar de alta un autenticador nuevo.
 */
export async function POST(request: Request) {
  const { code } = (await request.json().catch(() => ({}))) as { code?: string };
  if (!code || code.trim().length < 4) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { data: valid, error: rpcErr } = await supabase.rpc("nx_mfa_consume_recovery_code", { p_code: code });
  if (rpcErr || !valid) {
    return NextResponse.json({ error: "Código incorrecto o ya usado." }, { status: 400 });
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceUrl && serviceKey && factors) {
    const admin = createServiceClient(serviceUrl, serviceKey);
    for (const f of factors.totp) {
      await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
    }
  }

  return NextResponse.json({ ok: true });
}
