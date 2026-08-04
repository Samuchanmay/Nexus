// EMET · Edge Function: gcal-sync-event
// Sincroniza un evento institucional con Google Calendar (crear/actualizar/eliminar)
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

    const { eventId, action } = await req.json();
    if (!eventId || !action) {
      return Response.json({ ok: false, error: "faltan-datos" }, { status: 400, headers: cors });
    }

    // Obtener el evento
    const { data: event, error: eventError } = await admin
      .from("institutional_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return Response.json({ ok: false, error: "evento-no-encontrado" }, { status: 404, headers: cors });
    }

    // Obtener mapeo existente (si hay)
    const { data: mapping } = await admin
      .from("event_google_mapping")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    const calendarId = event.google_calendar_id || "primary";
    const targetCalendar = encodeURIComponent(calendarId);

    // ACCIÓN: DELETE
    if (action === "delete") {
      if (!mapping) {
        await logSync(admin, eventId, "delete", "emet_to_google", "success", "No había mapeo, nada que eliminar");
        return Response.json({ ok: true, message: "No había mapeo" }, { headers: cors });
      }

      const deleteRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${targetCalendar}/events/${mapping.google_event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenResult.token}` },
        },
      );

      if (!deleteRes.ok && deleteRes.status !== 410) {
        const errJson = await deleteRes.json();
        await logSync(admin, eventId, "delete", "emet_to_google", "error", JSON.stringify(errJson));
        await admin.from("event_google_mapping").update({
          last_sync_status: "error",
          last_error: `Google rechazó el borrado: ${deleteRes.status}`,
        }).eq("id", mapping.id);
        return Response.json({ ok: false, error: "google-rechazo-el-borrado", detail: errJson }, { status: 502, headers: cors });
      }

      await admin.from("event_google_mapping").delete().eq("id", mapping.id);
      await logSync(admin, eventId, "delete", "emet_to_google", "success");
      return Response.json({ ok: true, message: "Evento eliminado de Google Calendar" }, { headers: cors });
    }

    // ACCIÓN: CREATE o UPDATE
    const hasTime = event.start_time && event.end_time;
    const startField = hasTime
      ? { dateTime: `${event.start_date}T${event.start_time}:00`, timeZone: "America/Merida" }
      : { date: event.start_date };
    const endField = hasTime
      ? { dateTime: `${event.end_date}T${event.end_time}:00`, timeZone: "America/Merida" }
      : { date: event.end_date };

    const eventBody = {
      summary: event.title,
      description: event.description || event.notes || "",
      location: event.location_type === "externo" && event.location_name
        ? `${event.location_name}${event.location_address ? `, ${event.location_address}` : ""}`
        : "",
      start: startField,
      end: endField,
    };

    let googleEventId: string;
    let googleAction: string;

    if (mapping) {
      // UPDATE
      const updateRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${targetCalendar}/events/${mapping.google_event_id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${tokenResult.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        },
      );

      if (!updateRes.ok) {
        const errJson = await updateRes.json();
        await logSync(admin, eventId, "update", "emet_to_google", "error", JSON.stringify(errJson));
        await admin.from("event_google_mapping").update({
          last_sync_status: "error",
          last_error: `Google rechazó la actualización: ${updateRes.status}`,
        }).eq("id", mapping.id);
        return Response.json({ ok: false, error: "google-rechazo-la-actualizacion", detail: errJson }, { status: 502, headers: cors });
      }

      const updatedEvent = await updateRes.json();
      googleEventId = updatedEvent.id;
      googleAction = "update";

      await admin.from("event_google_mapping").update({
        synced_at: new Date().toISOString(),
        last_sync_status: "success",
        last_error: null,
      }).eq("id", mapping.id);
    } else {
      // CREATE
      const createRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${targetCalendar}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenResult.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        },
      );

      if (!createRes.ok) {
        const errJson = await createRes.json();
        await logSync(admin, eventId, "create", "emet_to_google", "error", JSON.stringify(errJson));
        return Response.json({ ok: false, error: "google-rechazo-la-creacion", detail: errJson }, { status: 502, headers: cors });
      }

      const createdEvent = await createRes.json();
      googleEventId = createdEvent.id;
      googleAction = "create";

      await admin.from("event_google_mapping").insert({
        event_id: eventId,
        google_event_id: googleEventId,
        google_calendar_id: calendarId,
        last_sync_status: "success",
      });
    }

    await logSync(admin, eventId, googleAction, "emet_to_google", "success");
    return Response.json({
      ok: true,
      action: googleAction,
      googleEventId,
      message: googleAction === "create" ? "Evento creado en Google Calendar" : "Evento actualizado en Google Calendar",
    }, { headers: cors });
  } catch (e) {
    console.error("gcal-sync-event error:", e);
    return Response.json({ ok: false, error: "error-del-servidor" }, { status: 500, headers: cors });
  }
});
