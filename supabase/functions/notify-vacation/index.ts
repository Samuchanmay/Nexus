// NEXUS · Edge Function: notify-vacation
// Al solicitarse una vacación, envía un correo formal de solicitud de
// autorización (redactado a nombre de quien solicita) a: (1) Samuel/NOTIFY_EMAIL
// como siempre, y (2) el correo de autorización configurable en
// app_settings.vacation_authorization_email (para la dirección/empresa), si
// está configurado. Se invoca desde la app tras el INSERT en vacations.
//
// Envía por Gmail (no Resend): usa el permiso de Google ya conectado del
// admin (mismo mecanismo que Calendar/Drive — gmail.send, solo enviar, nunca
// leer la bandeja), así el correo sale desde su cuenta real de Google sin
// necesitar verificar ningún dominio con un tercero.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "27 de julio de 2026" a partir de un ISO date (YYYY-MM-DD). */
function longDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** "27/07/2026" a partir de un ISO date. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function isoWeekday(iso: string): number {
  return new Date(iso + "T12:00:00Z").getUTCDay();
}

function addDay(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
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

/** Codifica un mensaje MIME a base64url, el formato que pide la Gmail API. */
function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeHeaderWord(text: string): string {
  // RFC 2047 — necesario para acentos/ñ en el "From"/"Subject" del correo.
  return `=?UTF-8?B?${toBase64Url(text).replace(/-/g, "+").replace(/_/g, "/")}?=`;
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { vacation_id } = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: vac } = await admin
      .from("vacations")
      .select("id, start_date, end_date, days, users(full_name, display_name, email, area, vacation_balance)")
      .eq("id", vacation_id).single();
    if (!vac) return Response.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404, headers: cors });

    const u = (vac as unknown as {
      users: { full_name: string; display_name: string; email: string; area: string | null; vacation_balance: number };
    }).users;

    // El correo se envía siempre desde la cuenta de Google del administrador
    // principal (el mismo que conecta Calendar/Drive) — así sale de su
    // dirección real sin depender de verificar un dominio con un tercero.
    const { data: sender } = await admin.from("users")
      .select("id, email, display_name").eq("role", "admin").eq("active", true).limit(1).maybeSingle();

    const notifyFallback = (msg: string) =>
      Response.json({ ok: false, error: msg, status: 0, detail: "" }, { headers: cors });

    if (!sender) return notifyFallback("sin-admin-configurado");

    const tokenResult = await getFreshAccessToken(admin, sender.id);

    const { data: holidayRows } = await admin.from("holidays")
      .select("date").gte("date", vac.start_date).lte("date", vac.end_date);
    const holidaySet = new Set((holidayRows ?? []).map((h) => h.date as string));

    const effective: string[] = [];
    const excluded: string[] = [];
    for (let d = vac.start_date; d <= vac.end_date; d = addDay(d)) {
      const dow = isoWeekday(d);
      const isHoliday = holidaySet.has(d);
      if (dow === 0 || dow === 6 || isHoliday) excluded.push(d);
      else effective.push(d);
    }

    const saldoAntes = u.vacation_balance;
    const saldoDespues = Math.max(0, saldoAntes - vac.days);
    const area = u.area?.trim() || "CERT Comunicación";
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);

    const { data: settingRow } = await admin.from("app_settings")
      .select("value").eq("key", "vacation_authorization_email").maybeSingle();
    const authEmail = settingRow?.value?.trim();

    const to = Deno.env.get("NOTIFY_EMAIL") ?? sender.email ?? "";
    const recipients = Array.from(new Set([to, ...(authEmail ? [authEmail] : [])].filter(Boolean)));

    async function notifyFailure(reason: string) {
      const admins = await admin.from("users").select("id").eq("role", "admin").eq("active", true);
      for (const a of admins.data ?? []) {
        await admin.from("notifications").insert({
          user_id: a.id,
          title: "No se pudo enviar el correo de solicitud de vacaciones",
          body: `${u.display_name} · ${reason}. Reconecta tu cuenta de Google (cierra sesión y vuelve a entrar con Google) si el permiso de enviar correo expiró.`,
          kind: "info",
          link: "/admin/vacaciones",
        });
      }
    }

    if ("error" in tokenResult) {
      console.error(`notify-vacation: sin token de Gmail — ${tokenResult.error}`);
      await notifyFailure(tokenResult.error);
      return notifyFallback(tokenResult.error);
    }

    const excludedHtml = excluded.length
      ? excluded.map((d) => `<div>${longDate(d)}</div>`).join("")
      : "<div>Ninguno</div>";
    const effectiveHtml = effective.map((d) => `<div>• ${shortDate(d)}</div>`).join("");

    const html = `
      <div style="font-family:-apple-system,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1C1C1E;line-height:1.6">
        <p>Estimados(as),</p>
        <p>Por medio de la presente solicito atentamente la autorización de mis vacaciones correspondientes al período vigente.</p>

        <p style="margin-bottom:4px"><strong>Período solicitado:</strong></p>
        <div style="padding-left:16px;margin-bottom:14px">
          <div>Inicio: <strong>${longDate(vac.start_date)}</strong></div>
          <div>Fin: <strong>${longDate(vac.end_date)}</strong></div>
        </div>

        <p style="margin-bottom:4px"><strong>Días no laborables excluidos:</strong></p>
        <div style="padding-left:16px;margin-bottom:14px;color:#3A3A3C">${excludedHtml}</div>

        <p style="margin-bottom:4px"><strong>Días efectivos de vacaciones:</strong></p>
        <div style="padding-left:16px;margin-bottom:14px;color:#3A3A3C">${effectiveHtml}</div>

        <p style="margin-bottom:4px"><strong>Resumen:</strong></p>
        <div style="padding-left:16px;margin-bottom:14px">
          <div>Días hábiles solicitados: <strong>${vac.days}</strong></div>
          <div>Saldo antes: <strong>${saldoAntes} días</strong></div>
          <div>Saldo después: <strong>${saldoDespues} días</strong></div>
        </div>

        <p>Entiendo que esta solicitud se encuentra sujeta a validación y autorización por parte de la empresa, por lo que el presente correo no constituye una aprobación automática.</p>
        <p>Agradezco de antemano la atención brindada y quedo atento(a) a cualquier comentario.</p>

        <p style="margin-top:24px">
          Atentamente,<br/>
          ${u.full_name}<br/>
          Área de ${area}<br/>
          CERT Comunicación<br/>
          ${longDate(todayIso)}
        </p>

        <p style="color:#A1A1A6;font-size:12px;margin-top:32px">
          Revísala en <a href="https://nexus-samu09.vercel.app/admin/vacaciones">Nexus → Vacaciones</a> una vez que tengas el VoBo.<br/>
          Hecho con ❤️ por Samu Chan
        </p>
      </div>`;

    const fromHeader = sender.email
      ? `${encodeHeaderWord(sender.display_name ?? "Nexus")} <${sender.email}>`
      : undefined;
    const subject = `Solicitud de vacaciones --- ${u.display_name}`;
    const mime = [
      fromHeader ? `From: ${fromHeader}` : null,
      `To: ${recipients.join(", ")}`,
      `Subject: ${encodeHeaderWord(subject)}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "",
      html,
    ].filter((l) => l !== null).join("\r\n");

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: toBase64Url(mime) }),
    });

    if (res.ok) {
      await admin.from("vacations").update({ notification_sent: true }).eq("id", vacation_id);
      return Response.json({ ok: true }, { headers: cors });
    }

    const errBody = await res.text();
    console.error(`notify-vacation: Gmail respondió ${res.status} — ${errBody}`);
    await notifyFailure(`Gmail respondió ${res.status}`);
    return Response.json({ ok: false, error: "gmail-error", status: res.status, detail: errBody }, { headers: cors });
  } catch (e) {
    console.error(`notify-vacation: excepción — ${e instanceof Error ? e.message : String(e)}`);
    return Response.json({ ok: false, error: "Error del servidor" }, { status: 500, headers: cors });
  }
});
