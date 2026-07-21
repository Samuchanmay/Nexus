// NEXUS · Edge Function: drive-upload
// Sube un archivo real a Google Drive (solo a archivos creados por la app,
// scope drive.file) y lo deja visible por enlace, para usarlo como evidencia.
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
      return Response.json({ ok: false, error: tokenResult.error }, { status: 409, headers: cors });
    }

    const { fileName, mimeType, base64 } = await req.json();
    if (!fileName || !mimeType || !base64) {
      return Response.json({ ok: false, error: "faltan-datos" }, { status: 400, headers: cors });
    }

    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 8 * 1024 * 1024) {
      return Response.json({ ok: false, error: "archivo-muy-grande" }, { status: 413, headers: cors });
    }

    const boundary = "nexus-" + crypto.randomUUID();
    const metadata = JSON.stringify({ name: fileName });
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      bytes,
      `\r\n--${boundary}--`,
    ]);

    const upRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenResult.token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    const upJson = await upRes.json();
    if (!upRes.ok) {
      return Response.json({ ok: false, error: "google-rechazo-el-archivo", detail: upJson }, { status: 502, headers: cors });
    }

    // Permite que cualquiera con el enlace pueda verlo (para compartir la evidencia).
    await fetch(`https://www.googleapis.com/drive/v3/files/${upJson.id}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });

    return Response.json({ ok: true, url: upJson.webViewLink }, { headers: cors });
  } catch {
    return Response.json({ ok: false, error: "error-del-servidor" }, { status: 500, headers: cors });
  }
});
