// NEXUS · Edge Function: weekly-attendance-report
// Arma un resumen semanal de asistencia por persona y lo envía a RRHH por
// correo (Resend, mismo patrón que notify-vacation). Se puede invocar a mano
// desde admin/nexus ("Enviar ahora") o vía pg_cron cada lunes.
// Deploy con --no-verify-jwt: la invoca pg_cron sin sesión de usuario; usa el
// service role internamente para todo, así que no necesita un JWT de
// llamador y no expone nada sensible en su respuesta (solo agregados).
import { createClient } from "jsr:@supabase/supabase-js@2";

const TZ = "America/Merida";
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Lunes de la semana ISO que contiene `d` (America/Merida, sin efectos de zona).
function mondayOf(d: Date): string {
  const local = dateFmt.format(d); // YYYY-MM-DD
  const utc = new Date(local + "T12:00:00Z");
  const day = utc.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  return utc.toISOString().slice(0, 10);
}
function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Body vacío (o no-JSON) = invocación de pg_cron; { manual: true } = botón
    // "Enviar ahora" en admin/nexus. El switch de app_settings solo apaga el
    // envío automático — el botón manual siempre funciona.
    const body = await req.json().catch(() => ({}));
    const manual = (body as { manual?: boolean })?.manual === true;

    const { data: settings } = await admin
      .from("app_settings").select("key, value")
      .in("key", ["weekly_report_enabled", "weekly_report_email"]);
    const settingsMap = new Map((settings ?? []).map((s) => [s.key, s.value]));

    if (!manual && settingsMap.get("weekly_report_enabled") === "false") {
      return Response.json({ ok: true, skipped: true, reason: "envio-automatico-desactivado" }, { headers: cors });
    }

    // Semana pasada completa (lunes a domingo). Si se ejecuta un lunes por la
    // mañana, cubre exactamente la semana que acaba de terminar.
    const thisMonday = mondayOf(new Date());
    const lastMonday = addDaysIso(thisMonday, -7);
    const lastSunday = addDaysIso(thisMonday, -1);

    const [{ data: team }, { data: att }, { data: states } , { data: scheds }] = await Promise.all([
      admin.from("users").select("id, display_name, full_name").eq("active", true).in("role", ["admin", "empleado"]),
      admin.from("attendance").select("user_id, date, time, type, reason").gte("date", lastMonday).lte("date", lastSunday).order("time"),
      admin.from("jornada_states").select("nombre, cuenta_tiempo").eq("activo", true),
      admin.from("schedules").select("user_id, target_min").is("valid_until", null),
    ]);

    const cuentaTiempo = new Map((states ?? []).map((s) => [s.nombre, s.cuenta_tiempo as boolean]));
    const SALIDA_REASON_TO_STATE: Record<string, string> = {
      "Salida a comer": "Comida", "Salida a diligencia": "Diligencia",
      "Salida a cita médica": "Consulta médica", "Salida a permiso": "Permiso temporal",
      "Salida a pendientes": "Pendientes",
    };

    type Row = { user_id: string; date: string; time: string; type: string; reason: string };
    const rows = (att ?? []) as Row[];

    const summary = (team ?? []).map((u) => {
      const mine = rows.filter((r) => r.user_id === u.id);
      const dates = [...new Set(mine.map((r) => r.date))];
      let totalMin = 0;
      let daysWorked = 0;
      for (const date of dates) {
        const day = mine.filter((r) => r.date === date).sort((a, b) => a.time.localeCompare(b.time));
        const firstIn = day.find((r) => r.type === "Entrada");
        if (!firstIn) continue;
        let dayMin = 0;
        for (let i = 0; i < day.length; i++) {
          const m = day[i];
          if (m.type === "Salida" && m.reason === "Fin de jornada") break;
          const stateName = m.type === "Entrada" ? "Trabajando" : (SALIDA_REASON_TO_STATE[m.reason] ?? "Trabajando");
          const counts = cuentaTiempo.get(stateName) ?? (m.type === "Entrada");
          const next = day[i + 1];
          const segEnd = next ? toMin(next.time) : toMin(m.time); // sin "Fin de jornada": no se extrapola a "ahora" en un reporte histórico
          const segStart = toMin(m.time);
          if (counts) dayMin += Math.max(0, segEnd - segStart);
        }
        if (dayMin > 0) { totalMin += dayMin; daysWorked++; }
      }
      const sched = (scheds ?? []).find((s) => s.user_id === u.id);
      const targetMin = (sched?.target_min ?? 480) * 5; // objetivo semanal aprox (5 días)
      return { name: u.display_name, totalMin, daysWorked, targetMin };
    }).filter((r) => r.daysWorked > 0 || true); // incluir a todos, aunque no hayan fichado (visibilidad de ausentismo)

    const fmtH = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;

    const rowsHtml = summary
      .sort((a, b) => b.totalMin - a.totalMin)
      .map((r) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB">${r.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:center">${r.daysWorked}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:700">${fmtH(r.totalMin)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right;color:${r.totalMin < r.targetMin ? "#991B1B" : "#065F46"}">
            ${r.totalMin < r.targetMin ? "−" : "+"}${fmtH(Math.abs(r.totalMin - r.targetMin))}
          </td>
        </tr>`).join("");

    const configuredEmail = settingsMap.get("weekly_report_email")?.trim();
    const to = configuredEmail || Deno.env.get("RRHH_EMAIL") || Deno.env.get("NOTIFY_EMAIL") || "samuel.chan@cert.edu.mx";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nexus <nexus@cert.edu.mx>",
        to: [to],
        subject: `📊 Reporte semanal de asistencia — ${lastMonday} a ${lastSunday}`,
        html: `
          <div style="font-family:-apple-system,Arial,sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#5856D6">Asistencia de la semana</h2>
            <p style="color:#6E6E73">${lastMonday} → ${lastSunday}</p>
            <table style="width:100%;border-collapse:collapse;margin-top:16px">
              <thead>
                <tr style="background:#F8FAFC">
                  <th style="padding:8px 12px;text-align:left;color:#6E6E73;font-size:12px">Persona</th>
                  <th style="padding:8px 12px;text-align:center;color:#6E6E73;font-size:12px">Días</th>
                  <th style="padding:8px 12px;text-align:right;color:#6E6E73;font-size:12px">Horas totales</th>
                  <th style="padding:8px 12px;text-align:right;color:#6E6E73;font-size:12px">vs. objetivo</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            <p style="color:#A1A1A6;font-size:12px;margin-top:32px">Generado automáticamente por Nexus.</p>
          </div>`,
      }),
    });

    return Response.json({ ok: res.ok, week: `${lastMonday}/${lastSunday}`, people: summary.length }, { headers: cors });
  } catch {
    return Response.json({ ok: false, error: "error-del-servidor" }, { status: 500, headers: cors });
  }
});
