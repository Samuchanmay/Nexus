// NEXUS · Edge Function: fichar
// Validación GPS SERVER-SIDE + INSERT con confirmación real.
// Deploy: supabase functions deploy fichar
import { createClient } from "jsr:@supabase/supabase-js@2";

const COOLDOWN_MIN = Number(Deno.env.get("COOLDOWN_MIN") ?? "2"); // B6: mismo motivo, mínimo N min entre registros

// B1: fecha/hora SIEMPRE en America/Merida, calculadas aquí (no defaults UTC de Postgres)
const TZ = "America/Merida";
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

// Respaldo SOLO por si la tabla gps_zones llegara a estar vacía (no debería
// pasar en producción — Configuración → Zona GPS siempre debe tener al
// menos una zona activa).
const FALLBACK_ZONE = { lat: 20.405833, lng: -89.529222, radio_m: 50 };

// Mismo mapeo que src/lib/hours.ts (motivos fijos del checador → nombre de
// estado en jornada_states). Si el estado tiene pausa_actividad = true,
// pausamos automáticamente la actividad que la persona tenga abierta.
const SALIDA_REASON_TO_STATE: Record<string, string> = {
  "Salida a comer": "Comida",
  "Salida a diligencia": "Diligencia",
  "Salida a cita médica": "Consulta médica",
  "Salida a permiso": "Permiso temporal",
  "Salida a pendientes": "Pendientes",
};

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { reason, lat, lng, device_id, captured_at } = await req.json();

    // Cliente con el JWT del usuario — RLS aplica
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    // Cliente de servicio — solo para el vínculo dispositivo↔persona (I17),
    // que necesita ver dispositivos de OTRAS personas para detectar fraude.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ ok: false, error: "No autenticado" }, { status: 401, headers: cors });
    }

    // Whitelist: buscar el perfil vinculado
    const { data: profile } = await supabase
      .from("users").select("id, active").eq("auth_id", user.id).single();
    if (!profile || !profile.active) {
      return Response.json({ ok: false, error: "Cuenta no autorizada" }, { status: 403, headers: cors });
    }

    // GPS server-side — el cliente no puede saltarse esta validación.
    // Las zonas viven en la BD (Configuración → Zona GPS, editable sin
    // redeploy) y se soportan varias activas a la vez (ej. dos planteles):
    // basta con estar dentro del radio de CUALQUIERA de ellas.
    if (typeof lat !== "number" || typeof lng !== "number") {
      return Response.json({ ok: false, error: "Ubicación requerida" }, { status: 400, headers: cors });
    }
    const { data: zonesRaw } = await supabase
      .from("gps_zones").select("nombre, lat, lng, radio_m").eq("activo", true);
    const zones = zonesRaw?.length ? zonesRaw : [{ nombre: "Oficina", ...FALLBACK_ZONE }];
    let dist = Infinity;
    let withinZone = false;
    for (const z of zones) {
      const d = Math.round(haversine(lat, lng, z.lat, z.lng));
      if (d < dist) dist = d;
      if (d <= z.radio_m) { withinZone = true; break; }
    }
    if (!withinZone) {
      return Response.json(
        { ok: false, error: `Fuera de rango: estás a ${dist} m de la zona más cercana` },
        { status: 422, headers: cors },
      );
    }

    // I17 · Vínculo dispositivo↔persona: si este device_id ya está ligado a
    // otra persona activa, se rechaza (evita que alguien fiche por otra
    // persona con su mismo teléfono). Primer uso de un device_id ⇒ se
    // vincula automáticamente a quien está fichando.
    const deviceId = typeof device_id === "string" ? device_id.trim().slice(0, 120) : "";
    if (deviceId) {
      const { data: known } = await admin
        .from("known_devices").select("user_id, active").eq("device_id", deviceId).maybeSingle();
      if (known) {
        if (!known.active) {
          return Response.json({ ok: false, error: "Dispositivo desactivado por el administrador" }, { status: 403, headers: cors });
        }
        if (known.user_id !== profile.id) {
          return Response.json({ ok: false, error: "Este dispositivo ya está vinculado a otra persona" }, { status: 403, headers: cors });
        }
        await admin.from("known_devices").update({ last_seen_at: new Date().toISOString() }).eq("device_id", deviceId);
      } else {
        await admin.from("known_devices").insert({ device_id: deviceId, user_id: profile.id });
      }
    }

    const ENTRADAS = ["Entrada a trabajo", "Regreso de comida", "Regreso de diligencia",
      "Regreso de cita médica", "Regreso de permiso", "Regreso de pendientes"];
    const SALIDAS = ["Salida a comer", "Salida a pendientes", "Salida a diligencia",
      "Salida a permiso", "Salida a cita médica", "Fin de jornada"];
    if (![...ENTRADAS, ...SALIDAS].includes(reason)) {
      return Response.json({ ok: false, error: "Motivo inválido" }, { status: 400, headers: cors });
    }
    const type = ENTRADAS.includes(reason) ? "Entrada" : "Salida";

    // I15 · Cola offline: si el registro se capturó sin red, respetar su hora de captura
    // (solo si es pasada y dentro de una ventana razonable de 12 h).
    let now = new Date();
    const captured = typeof captured_at === "string" ? new Date(captured_at) : null;
    if (captured && !isNaN(captured.getTime())) {
      const drift = Date.now() - captured.getTime();
      if (drift > 0 && drift < 12 * 3600 * 1000) now = captured;
    }
    const date = dateFmt.format(now);           // YYYY-MM-DD en Mérida
    const time = timeFmt.format(now);           // HH:MM:SS en Mérida

    // B6: enfriamiento — mismo motivo hoy dentro de COOLDOWN_MIN ⇒ rechazar (doble toque real)
    const { data: recent } = await supabase
      .from("attendance").select("time").eq("user_id", profile.id)
      .eq("date", date).eq("reason", reason)
      .order("time", { ascending: false }).limit(1);
    if (recent?.length) {
      const [h1, m1] = recent[0].time.split(":").map(Number);
      const [h2, m2] = time.split(":").map(Number);
      if (Math.abs(h2 * 60 + m2 - (h1 * 60 + m1)) < COOLDOWN_MIN) {
        return Response.json(
          { ok: false, error: "Este movimiento ya fue registrado hace un momento" },
          { status: 409, headers: cors },
        );
      }
    }

    // INSERT con fecha/hora explícitas — el UNIQUE constraint frena duplicados exactos
    const { data, error } = await supabase
      .from("attendance")
      .insert({ user_id: profile.id, type, reason, date, time, lat, lng, distance_m: dist, device_id })
      .select("id, date, time")
      .single();

    if (error) {
      const msg = error.code === "23505"
        ? "Este movimiento ya fue registrado"
        : "No se pudo registrar, intenta de nuevo";
      return Response.json({ ok: false, error: msg }, { status: 409, headers: cors });
    }

    // Pausar automáticamente la actividad en curso si el estado de esta
    // salida así lo indica (jornada_states.pausa_actividad), o si es fin
    // de jornada (nunca debe quedar un cronómetro corriendo de un día ya
    // cerrado). No afecta el total de horas del día, solo el cronómetro
    // de la actividad/proyecto.
    let pausedActivity = false;
    if (type === "Salida") {
      let shouldPause = reason === "Fin de jornada";
      if (!shouldPause) {
        const stateName = SALIDA_REASON_TO_STATE[reason];
        if (stateName) {
          const { data: st } = await supabase
            .from("jornada_states").select("pausa_actividad").eq("nombre", stateName).eq("activo", true).maybeSingle();
          shouldPause = !!st?.pausa_actividad;
        }
      }
      if (shouldPause) {
        const { data: myAssignments } = await supabase
          .from("project_assignments").select("id").eq("user_id", profile.id);
        const ids = (myAssignments ?? []).map((a) => a.id);
        if (ids.length) {
          const { data: openLogs } = await supabase
            .from("task_time_logs").select("id, started_at")
            .in("assignment_id", ids).is("ended_at", null);
          for (const log of openLogs ?? []) {
            const minutes = Math.max(1, Math.floor((now.getTime() - new Date(log.started_at).getTime()) / 60000));
            await supabase.from("task_time_logs")
              .update({ ended_at: now.toISOString(), minutes }).eq("id", log.id);
            pausedActivity = true;
          }
        }
      }
    }

    // Confirmación REAL: devolvemos el UUID insertado
    return Response.json({ ok: true, id: data.id, date: data.date, time: data.time, distance_m: dist, pausedActivity }, { headers: cors });
  } catch {
    return Response.json({ ok: false, error: "Error del servidor" }, { status: 500, headers: cors });
  }
});
