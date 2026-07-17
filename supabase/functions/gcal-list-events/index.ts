// NEXUS · Edge Function: gcal-list-events
// Lee eventos de un Google Calendar privado (ej. "Eventos CERT") dentro de
// un rango de fechas, usando el permiso guardado de quien esté viendo el
// Calendario en Nexus. A diferencia de Efemérides (que es un calendario
// público leído por ICS sin login), este calendario es privado y sólo se
// puede leer con OAuth — por eso necesita esta función en vez de un fetch
// directo al ICS público.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

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
      // No bloquea: el calendario del equipo en Nexus sigue funcionando con
      // sus propios datos, solo no se agregan los eventos externos.
      return Response.json({ ok: false, error: tokenResult.error, events: [] }, { status: 200, headers: cors });
    }

    const { calendarId, timeMin, timeMax } = await req.json();
    if (!calendarId || !timeMin || !timeMax) {
      return Response.json({ ok: false, error: "faltan-datos", events: [] }, { status: 400, headers: cors });
    }

    const params = new URLSearchParams({
      timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250",
    });
    const evRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${tokenResult.token}` } },
    );
    const evJson = await evRes.json();
    if (!evRes.ok) {
      return Response.json({ ok: false, error: "google-rechazo-la-lectura", detail: evJson, events: [] }, { status: 200, headers: cors });
    }

    type GEvent = { id: string; summary?: string; start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string }; htmlLink?: string };
    const events = ((evJson.items ?? []) as GEvent[])
      .filter((e) => e.summary)
      .map((e) => ({
        id: e.id,
        title: e.summary ?? "Evento",
        start: e.start?.date ?? (e.start?.dateTime ?? "").slice(0, 10),
        end: e.end?.date ?? (e.end?.dateTime ?? "").slice(0, 10),
        allDay: !!e.start?.date,
        htmlLink: e.htmlLink ?? null,
      }))
      .filter((e) => e.start);

    return Response.json({ ok: true, events }, { headers: cors });
  } catch {
    return Response.json({ ok: false, error: "error-del-servidor", events: [] }, { status: 200, headers: cors });
  }
});
