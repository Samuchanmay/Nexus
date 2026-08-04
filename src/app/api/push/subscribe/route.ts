import { NextResponse } from "next/server";
import { createClient, getAuthedUser } from "@/lib/supabase/server";

// EMET · POST /api/push/subscribe
//
// Guarda (o actualiza) la suscripción Web Push del navegador que llama,
// para que la Edge Function send-chat-push pueda notificar con la app
// cerrada. Lo dispara registerPushSubscription() en
// src/lib/use-push-notifications.ts justo después de
// reg.pushManager.subscribe().
//
// Bug del borrador anterior de este archivo (nunca llegó a funcionar,
// nunca hubo tabla): comparaba el userId del body contra user.id de
// auth.getUser() — pero ese es el UID de auth.users, mientras que
// push_subscriptions.user_id (y el userId que en realidad manda el
// cliente, ver app-shell.tsx `usePushNotifications(user.id, ...)`) es el
// id INTERNO de public.users. Esa comparación no coincidía nunca → 403
// siempre. Aquí se resuelve el id interno del lado del servidor (mismo
// criterio que el guard de propiedad de event_check_in/out, migración
// 0032) y NUNCA se confía en el userId del body para el insert.
export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  let body: { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ ok: false, error: "Suscripción incompleta" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Cuenta no autorizada" }, { status: 403 });
  }

  // Texto plano, no jsonb — send-chat-push hace JSON.parse(sub.subscription)
  // tal cual (ver comentario de esquema en la migración 0033). El conflicto
  // se resuelve por endpoint (un mismo usuario puede tener varios
  // dispositivos/navegadores suscritos a la vez), no por user_id.
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: profile.id,
        endpoint: sub.endpoint,
        subscription: JSON.stringify(sub),
        user_agent: req.headers.get("user-agent") ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
