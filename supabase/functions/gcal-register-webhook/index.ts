// EMET · Edge Function: gcal-register-webhook
// Registra un webhook con Google Calendar para recibir notificaciones de cambios
import { createClient } from "jsr:@supabase/supabase-js@2";

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

async function getFreshAccessToken(
  admin: ReturnType<typeof createClient>,
  userRowId: string,
): Promise<{ token: string } | { error: string }> {
  const { data: row } = await admin
    .from("google_oauth_tokens")
    .select("refresh_token, access_token, access_token_expires_at")
    .eq("user_id", userRowId)
    .single();

  if (!row?.refresh_token) return { error: "sin-permiso-google" };

  const stillValid =
    row.access_token &&
    row.access_token_expires_at &&
    new Date(row.access_token_expires_at).getTime() - Date.now() > 60_000;
  if (stillValid) return { token: row.access_token as string };

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return { error: "faltan-credenciales-google" };

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) return { error: "no-se-pudo-renovar-permiso" };

  await admin.from("google_oauth_tokens").update({
    access_token: json.access_token,
    access_token_expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
  }).eq("user_id", userRowId);

  return { token: json.access_token as string };
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return Response.json({ ok: false, error: "no-autenticado" }, { status: 401, headers: cors });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: profile } = await admin.from("users").select("id").eq("auth_id", user.id).single();
    if (!profile) return Response.json({ ok: false, error: "sin-perfil" }, { status: 403, headers: cors });

    const tokenResult = await getFreshAccessToken(admin, profile.id);
    if ("error" in tokenResult) {
      return Response.json({ ok: false, error: tokenResult.error }, { status: 409, headers: cors });
    }

    const { calendarId } = await req.json();
    if (!calendarId) {
      return Response.json({ ok: false, error: "falta-calendarId" }, { status: 400, headers: cors });
    }

    // Generar IDs únicos para el canal
    const channelId = crypto.randomUUID();
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gcal-webhook`;

    // Registrar el webhook con Google
    const targetCalendar = encodeURIComponent(calendarId);
    const watchRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${targetCalendar}/events/watch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenResult.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: webhookUrl,
          // Expiración: 7 días (máximo permitido por Google)
          expiration: (Date.now() + 7 * 24 * 60 * 60 * 1000).toString(),
        }),
      },
    );

    if (!watchRes.ok) {
      const errJson = await watchRes.json();
      return Response.json({ ok: false, error: "google-rechazo-el-webhook", detail: errJson }, { status: 502, headers: cors });
    }

    const watchData = await watchRes.json();

    // Guardar el webhook en la base de datos
    await admin.from("google_calendar_webhooks").upsert({
      calendar_id: calendarId,
      channel_id: channelId,
      resource_id: watchData.resourceId,
      expiration: new Date(parseInt(watchData.expiration)).toISOString(),
      admin_id: profile.id,
    }, {
      onConflict: "calendar_id,admin_id",
    });

    return Response.json({
      ok: true,
      channelId,
      expiration: watchData.expiration,
      message: "Webhook registrado correctamente",
    }, { headers: cors });
  } catch (e) {
    console.error("gcal-register-webhook error:", e);
    return Response.json({ ok: false, error: "error-del-servidor" }, { status: 500, headers: cors });
  }
});
