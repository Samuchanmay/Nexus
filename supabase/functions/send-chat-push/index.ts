// EMET · Edge Function: send-chat-push
// Envía la notificación push (Web Push vía service worker) a los
// participantes de una conversación del chat que tienen una suscripción
// guardada — EXCEPTO el remitente y quien silenció la conversación. Se
// invoca desde el cliente justo después de un INSERT exitoso en messages
// (mismo patrón best-effort que notify-vacation): para el chat el emisor
// siempre tiene la app abierta al enviar, así que basta con que su
// cliente dispare esta llamada; el push cubre al RECEPTOR con la app
// cerrada, que es el caso real que el Realtime no puede alcanzar.
//
// Configuración (secrets de la Edge Function, ver dashboard Supabase):
//   VAPID_PUBLIC_KEY  — clave pública VAPID; DEBE coincidir con la
//                       constante del cliente en use-push-notifications.ts
//                       (si no se define, se usa la misma por defecto).
//   VAPID_PRIVATE_KEY — clave privada VAPID — nunca en el frontend.
//   VAPID_SUBJECT     — contacto, p. ej. "mailto:admin@emet.uno".
// Sin VAPID_PRIVATE_KEY la función responde 500 con un mensaje claro —
// el envío del mensaje NO depende de esto (es best-effort).
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Misma clave pública que src/lib/use-push-notifications.ts — si algún día
// se regenera el par VAPID, cambiar ambas (la del cliente va en env
// NEXT_PUBLIC si se prefiere; aquí el fallback mantiene el contrato viejo).
// Par generado el 4 ago 2026 — ver nota en use-push-notifications.ts.
const VAPID_PUBLIC_KEY_FALLBACK = "BCBYW7jMiV4B0oCdSDyiC2wUuXMlXA4ecKt4jNpjEs8zohScS3glxfmYxr3UkS1SyEBOSmk-OIbonYBcP1RLWIA";

const ALLOWED_ORIGINS = [
  "https://nexus-cert01.vercel.app",
  "https://nexus-samu09.vercel.app",
  "https://emet.uno",
  ...(Deno.env.get("ALLOWED_ORIGINS")?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
];
function corsFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Vary": "Origin",
  };
}

/** Cuerpo de la notificación — mismo criterio que messageNotificationBody
    del cliente (truncado + texto por tipo de adjunto). */
function bodyFor(m: { type: string; content: string | null }): string {
  if (m.content) return m.content.length > 90 ? `${m.content.slice(0, 90)}…` : m.content;
  if (m.type === "image") return "📷 Adjuntó una imagen";
  if (m.type === "file") return "📎 Adjuntó un archivo";
  if (m.type === "system") return "Mensaje del sistema";
  return "Nuevo mensaje";
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? VAPID_PUBLIC_KEY_FALLBACK;
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!privateKey || !subject) {
    return Response.json(
      { ok: false, error: "VAPID no configurado — define VAPID_PRIVATE_KEY y VAPID_SUBJECT en los secrets de la función" },
      { status: 500, headers: cors },
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  try {
    const { message_id } = await req.json();
    if (!message_id) {
      return Response.json({ ok: false, error: "Falta message_id" }, { status: 400, headers: cors });
    }

    // Solo un usuario autenticado puede llamar, y solo para sus propios
    // mensajes (mismo criterio de validación que notify-vacation).
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user: caller } } = await anon.auth.getUser();
    if (!caller) {
      return Response.json({ ok: false, error: "No autenticado" }, { status: 401, headers: cors });
    }
    const { data: callerProfile } = await anon
      .from("users").select("id, role").eq("auth_id", caller.id).single();
    if (!callerProfile) {
      return Response.json({ ok: false, error: "Cuenta no autorizada" }, { status: 403, headers: cors });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: msg } = await admin
      .from("messages")
      .select("id, conversation_id, sender_id, type, content")
      .eq("id", message_id)
      .maybeSingle();
    if (!msg) return Response.json({ ok: false, error: "Mensaje no encontrado" }, { status: 404, headers: cors });
    // Solo el remitente real puede disparar el push de su mensaje — impide
    // que un usuario autenticado haga spam de notificaciones con IDs ajenos.
    if (msg.sender_id !== callerProfile.id) {
      return Response.json({ ok: false, error: "No autorizado" }, { status: 403, headers: cors });
    }

    const { data: conv } = await admin
      .from("conversations")
      .select("type, name")
      .eq("id", msg.conversation_id)
      .maybeSingle();
    if (!conv) return Response.json({ ok: false, error: "Conversación no encontrada" }, { status: 404, headers: cors });

    const { data: participants } = await admin
      .from("conversation_participants")
      .select("user_id, muted, muted_until")
      .eq("conversation_id", msg.conversation_id);
    const targets = (participants ?? [])
      .filter((p) => {
        if (p.user_id === msg.sender_id || p.muted) return false;
        // Silencio por duración: vencido = vuelve a notificar.
        if (p.muted_until && new Date(p.muted_until).getTime() <= Date.now()) return true;
        return !p.muted_until;
      })
      .map((p) => p.user_id);
    if (targets.length === 0) {
      return Response.json({ ok: true, delivered: 0, failed: 0, note: "sin-destinatarios" }, { headers: cors });
    }

    const { data: senderRow } = await admin
      .from("users_directory")
      .select("display_name")
      .eq("id", msg.sender_id)
      .maybeSingle();
    const senderName = senderRow?.display_name ?? null;

    // Directa → el título es el remitente y el cuerpo el mensaje. Grupo →
    // el título es la conversación y el cuerpo "Remitente: mensaje".
    const title = conv.type === "direct"
      ? (senderName ?? "Nuevo mensaje")
      : (conv.name ?? "Chat");
    const body = conv.type === "direct"
      ? bodyFor(msg)
      : (senderName ? `${senderName}: ${bodyFor(msg)}` : bodyFor(msg));

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, user_id, subscription")
      .in("user_id", targets);

    const payload = JSON.stringify({
      title,
      body,
      tag: `emet-chat-${msg.conversation_id}`,
      conversationId: msg.conversation_id,
      url: `/chat/${msg.conversation_id}`,
    });

    let delivered = 0;
    let failed = 0;
    for (const sub of subs ?? []) {
      let parsed: { endpoint: string; keys?: { p256dh: string; auth: string }; expirationTime?: number | null } | null = null;
      try { parsed = JSON.parse(sub.subscription as string); } catch { /* fila corrupta — se limpia */ }
      if (!parsed?.endpoint || !parsed.keys?.p256dh || !parsed.keys.auth) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
        continue;
      }
      try {
        await webpush.sendNotification({
          endpoint: parsed.endpoint,
          keys: { p256dh: parsed.keys.p256dh, auth: parsed.keys.auth },
          expirationTime: parsed.expirationTime ?? null,
        }, payload);
        delivered++;
      } catch (err) {
        // 404/410 = la suscripción ya no es válida (el navegador la
        // revocó o caducó) — se borra para no reintentarla cada mensaje.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
        failed++;
      }
    }

    return Response.json({ ok: true, delivered, failed }, { headers: cors });
  } catch (e) {
    console.error(`send-chat-push: excepción — ${e instanceof Error ? e.message : String(e)}`);
    return Response.json({ ok: false, error: "Error del servidor" }, { status: 500, headers: cors });
  }
});
