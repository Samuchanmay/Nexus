// EMET · Edge Function: gcal-webhook
// Recibe notificaciones push de Google Calendar cuando hay cambios
// Endpoint: POST /gcal-webhook
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

async function logSync(
  admin: ReturnType<typeof createClient>,
  eventId: string | null,
  action: string,
  direction: string,
  status: string,
  details?: string,
) {
  await admin.from("google_sync_logs").insert({
    event_id: eventId,
    action,
    direction,
    status,
    details: details ?? null,
  });
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  
  // Google envía notificaciones POST con headers específicos
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  try {
    // Verificar que es una notificación de Google
    const channelId = req.headers.get("X-Goog-Channel-ID");
    const resourceId = req.headers.get("X-Goog-Resource-ID");
    const resourceState = req.headers.get("X-Goog-Resource-State");

    if (!channelId || !resourceId) {
      console.log("gcal-webhook: Missing Google headers");
      return new Response("Missing headers", { status: 400, headers: cors });
    }

    console.log(`gcal-webhook: Received ${resourceState} notification for channel ${channelId}`);

    // "exists" = evento creado/actualizado, "not_exists" = evento eliminado
    if (resourceState !== "exists" && resourceState !== "not_exists") {
      return new Response("ok", { headers: cors });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar el webhook en la base de datos
    const { data: webhook } = await admin
      .from("google_calendar_webhooks")
      .select("*")
      .eq("channel_id", channelId)
      .eq("resource_id", resourceId)
      .maybeSingle();

    if (!webhook) {
      console.log(`gcal-webhook: Unknown channel ${channelId}`);
      return new Response("ok", { headers: cors });
    }

    // Verificar que el webhook no haya expirado
    if (new Date(webhook.expiration).getTime() < Date.now()) {
      console.log(`gcal-webhook: Expired webhook for channel ${channelId}`);
      await admin.from("google_calendar_webhooks").delete().eq("id", webhook.id);
      return new Response("ok", { headers: cors });
    }

    // Obtener token de acceso del admin que registró el webhook
    const tokenResult = await getFreshAccessToken(admin, webhook.admin_id);
    if ("error" in tokenResult) {
      console.log(`gcal-webhook: Token error for admin ${webhook.admin_id}: ${tokenResult.error}`);
      return new Response("ok", { headers: cors });
    }

    // Obtener los cambios recientes del calendario (últimos 5 minutos)
    const timeMin = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const calendarId = encodeURIComponent(webhook.calendar_id);
    
    const listRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${timeMin}&singleEvents=true&orderBy=updated`,
      {
        headers: { Authorization: `Bearer ${tokenResult.token}` },
      },
    );

    if (!listRes.ok) {
      console.log(`gcal-webhook: Failed to list events: ${listRes.status}`);
      return new Response("ok", { headers: cors });
    }

    const listData = await listRes.json();
    const events = listData.items || [];

    console.log(`gcal-webhook: Found ${events.length} recent events`);

    // Procesar cada evento
    for (const gEvent of events) {
      // Buscar si ya tenemos un mapeo para este evento de Google
      const { data: mapping } = await admin
        .from("event_google_mapping")
        .select("*")
        .eq("google_event_id", gEvent.id)
        .eq("google_calendar_id", webhook.calendar_id)
        .maybeSingle();

      if (resourceState === "not_exists") {
        // Evento eliminado en Google
        if (mapping) {
          // Marcar el evento en Emet como cancelado o eliminar el mapeo
          await admin.from("event_google_mapping").delete().eq("id", mapping.id);
          await logSync(admin, mapping.event_id, "webhook_delete", "google_to_emet", "success", `Google event ${gEvent.id} deleted`);
          console.log(`gcal-webhook: Removed mapping for deleted Google event ${gEvent.id}`);
        }
      } else {
        // Evento creado/actualizado en Google
        if (mapping) {
          // Actualizar el evento en Emet con los datos de Google
          const startDate = gEvent.start?.date || gEvent.start?.dateTime?.split("T")[0];
          const endDate = gEvent.end?.date || gEvent.end?.dateTime?.split("T")[0];
          const startTime = gEvent.start?.dateTime?.split("T")[1]?.split(".")[0] || null;
          const endTime = gEvent.end?.dateTime?.split("T")[1]?.split(".")[0] || null;

          await admin.from("institutional_events").update({
            title: gEvent.summary || "Evento de Google",
            description: gEvent.description || null,
            start_date: startDate,
            end_date: endDate,
            start_time: startTime,
            end_time: endTime,
            location_name: gEvent.location || null,
          }).eq("id", mapping.event_id);

          await admin.from("event_google_mapping").update({
            synced_at: new Date().toISOString(),
            last_sync_status: "success",
          }).eq("id", mapping.id);

          await logSync(admin, mapping.event_id, "webhook_update", "google_to_emet", "success", `Google event ${gEvent.id} updated`);
          console.log(`gcal-webhook: Updated Emet event ${mapping.event_id} from Google event ${gEvent.id}`);
        } else {
          // Nuevo evento en Google que no tenemos mapeado
          // Por ahora solo registramos, no creamos automáticamente en Emet
          // (el admin debe decidir si quiere sincronizarlo)
          await logSync(admin, null, "webhook_new", "google_to_emet", "success", `New Google event ${gEvent.id} not mapped`);
          console.log(`gcal-webhook: New Google event ${gEvent.id} not mapped to Emet`);
        }
      }
    }

    return new Response("ok", { headers: cors });
  } catch (e) {
    console.error("gcal-webhook error:", e);
    return new Response("ok", { headers: cors }); // Siempre responder ok a Google
  }
});
