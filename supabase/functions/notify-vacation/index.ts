// NEXUS · Edge Function: notify-vacation
// Al solicitarse una vacación, envía un correo formal de solicitud de
// autorización (redactado a nombre de quien solicita) a: (1) Samuel/NOTIFY_EMAIL
// como siempre, y (2) el correo de autorización configurable en
// app_settings.vacation_authorization_email (para la dirección/empresa), si
// está configurado. Se invoca desde la app tras el INSERT en vacations.
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

    const to = Deno.env.get("NOTIFY_EMAIL") ?? "samuel.chan@cert.edu.mx";
    const recipients = Array.from(new Set([to, ...(authEmail ? [authEmail] : [])]));

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

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nexus <nexus@cert.edu.mx>",
        to: recipients,
        subject: `Solicitud de vacaciones --- ${u.display_name}`,
        html,
      }),
    });

    if (res.ok) {
      await admin.from("vacations").update({ notification_sent: true }).eq("id", vacation_id);
    }
    return Response.json({ ok: res.ok }, { headers: cors });
  } catch {
    return Response.json({ ok: false, error: "Error del servidor" }, { status: 500, headers: cors });
  }
});
