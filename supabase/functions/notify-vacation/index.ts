// NEXUS · Edge Function: notify-vacation
// Envía correo a Samuel cuando un empleado solicita vacaciones (vía Resend).
// Se invoca desde la app tras el INSERT en vacations.
import { createClient } from "jsr:@supabase/supabase-js@2";

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
      .select("id, start_date, end_date, days, users(full_name, email)")
      .eq("id", vacation_id).single();
    if (!vac) return Response.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404, headers: cors });

    const u = (vac as { users: { full_name: string; email: string } }).users;
    const to = Deno.env.get("NOTIFY_EMAIL") ?? "samuel.chan@cert.edu.mx";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nexus <nexus@cert.edu.mx>",
        to: [to],
        subject: `🌴 Solicitud de vacaciones — ${u.full_name}`,
        html: `
          <div style="font-family:-apple-system,Arial,sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#5856D6">Nueva solicitud de vacaciones</h2>
            <p><strong>${u.full_name}</strong> solicitó vacaciones:</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px;color:#6E6E73">Desde</td><td style="padding:8px"><strong>${vac.start_date}</strong></td></tr>
              <tr><td style="padding:8px;color:#6E6E73">Hasta</td><td style="padding:8px"><strong>${vac.end_date}</strong></td></tr>
              <tr><td style="padding:8px;color:#6E6E73">Días hábiles</td><td style="padding:8px"><strong>${vac.days}</strong></td></tr>
            </table>
            <p>Revísala y apruébala en <a href="https://nexus.cert.edu.mx/admin/vacaciones">Nexus → Vacaciones</a> una vez que tengas el VoBo.</p>
            <p style="color:#A1A1A6;font-size:12px;margin-top:32px">Hecho con ❤️ por Samu Chan</p>
          </div>`,
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
