"use client";
// ═══════════════════════════════════════════════════════════════
//  NEXUS · /fichar — Check-in Oficina
//  Diseño: réplica fiel del checador.html del cliente (U1).
//  Lógica Nexus: empleado desde la sesión · GPS server-side ·
//  éxito SOLO con UUID devuelto · cola offline (I15) ·
//  fix B8: el quote del resultado nunca puede duplicarse (re-render).
// ═══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { QUOTES_ENTRADA, QUOTES_SALIDA } from "./quotes";

const OFICINA = {
  lat: Number(process.env.NEXT_PUBLIC_OFICINA_LAT ?? "20.405833"),
  lng: Number(process.env.NEXT_PUBLIC_OFICINA_LNG ?? "-89.529222"),
  radio: Number(process.env.NEXT_PUBLIC_RADIO_MAX_M ?? "50"),
};

// Motivos EXACTOS del checador del cliente (etiqueta → valor en BD)
const MOTIVOS_ENTRADA = [
  { label: "🏢 A trabajar", value: "Entrada a trabajo" },
  { label: "🍽️ De comer", value: "Regreso de comida" },
  { label: "🚶 De diligencia", value: "Regreso de diligencia" },
  { label: "🏥 De cita médica", value: "Regreso de cita médica" },
  { label: "📋 De permiso", value: "Regreso de permiso" },
  { label: "📦 De pendientes", value: "Regreso de pendientes" },
];
const MOTIVOS_SALIDA = [
  { label: "🍽️ A comer", value: "Salida a comer" },
  { label: "📦 Pendientes", value: "Salida a pendientes" },
  { label: "🚶 Diligencia", value: "Salida a diligencia" },
  { label: "📋 Permiso", value: "Salida a permiso" },
  { label: "🏥 Cita médica", value: "Salida a cita médica" },
  { label: "🏁 Fin de jornada", value: "Fin de jornada" },
];
const ICONOS: Record<string, string> = Object.fromEntries(
  [...MOTIVOS_ENTRADA, ...MOTIVOS_SALIDA].map((m) => [m.value, m.label.split(" ")[0]]),
);

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Cita del día (misma todo el día, cambia a diario) — igual que el checador
const diaDelAnio = () => Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
const quoteEntrada = () => QUOTES_ENTRADA[diaDelAnio() % QUOTES_ENTRADA.length];
const quoteSalida = () => QUOTES_SALIDA[diaDelAnio() % QUOTES_SALIDA.length];

// ── Cola offline (I15, traspaso §5.3) ──
type QueuedReg = { reason: string; tipo: string; lat: number; lng: number; captured_at: string };
const QKEY = "nexus_fichar_queue";
const readQueue = (): QueuedReg[] => {
  try { return JSON.parse(localStorage.getItem(QKEY) ?? "[]"); } catch { return []; }
};
const writeQueue = (q: QueuedReg[]) => localStorage.setItem(QKEY, JSON.stringify(q));

// ID de dispositivo persistente (I17): un valor aleatorio guardado en este
// navegador/teléfono, no el user-agent (que sería igual entre dos personas
// con el mismo modelo). Así la validación antifraude del servidor puede
// distinguir "mismo teléfono" de "mismo modelo de teléfono".
const DEVICE_KEY = "nexus_device_id";
function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "sin-almacenamiento";
  }
}

export default function Fichar() {
  const [nombre, setNombre] = useState<string>("");
  const [fechaHora, setFechaHora] = useState("Cargando...");
  const [tipo, setTipo] = useState<"" | "Entrada" | "Salida">("");
  const [motivo, setMotivo] = useState("");
  const [gps, setGps] = useState<{ ok: boolean; txt: string; lat: number | null; lng: number | null }>(
    { ok: false, txt: "Obteniendo ubicación…", lat: null, lng: null },
  );
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<
    | null
    | { kind: "ok"; motivo: string; hora: string; quote: { texto: string; autor: string }; pausedActivity: boolean }
    | { kind: "queued"; motivo: string }
    | { kind: "error"; msg: string }
  >(null);
  const [pendientes, setPendientes] = useState(0);
  const enviandoRef = useRef(false);

  // Reloj (igual que el checador)
  useEffect(() => {
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const tick = () => {
      const n = new Date();
      const p = (x: number) => String(x).padStart(2, "0");
      setFechaHora(`${dias[n.getDay()]} ${n.getDate()} de ${meses[n.getMonth()]} · ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Sesión → nombre del empleado (sin selector: la identidad la da el login)
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { location.href = "/login"; return; }
      const { data: p } = await supabase.from("users").select("display_name, active").eq("auth_id", user.id).single();
      if (!p || !p.active) { location.href = "/login?error=no-autorizado"; return; }
      setNombre(p.display_name);
    })();
  }, []);

  // GPS con compensación de precisión (igual que el checador: margen ≤ 15 m)
  useEffect(() => {
    if (!navigator.geolocation) { setGps({ ok: false, txt: "GPS no disponible", lat: null, lng: null }); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const dist = haversine(lat, lng, OFICINA.lat, OFICINA.lng);
        const precision = Math.round(accuracy || 0);
        const margen = Math.min(accuracy || 0, 15);
        const efectiva = Math.max(0, dist - margen);
        if (efectiva <= OFICINA.radio) {
          setGps({ ok: true, txt: `Ubicación verificada ✓ (${Math.round(dist)} m · ±${precision} m)`, lat, lng });
        } else {
          setGps({ ok: false, txt: `Fuera de rango · ${Math.round(dist)} m de la oficina (±${precision} m)`, lat, lng });
        }
      },
      (err) => setGps({ ok: false, txt: err.code === 1 ? "Permiso denegado — activa ubicación" : "No se pudo obtener GPS", lat: null, lng: null }),
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ── Envío al servidor: éxito SOLO con UUID devuelto ──
  const enviar = useCallback(async (reg: QueuedReg): Promise<{ ok: true; time: string; pausedActivity: boolean } | { ok: false; msg: string; retriable: boolean }> => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/fichar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          reason: reg.reason, lat: reg.lat, lng: reg.lng,
          captured_at: reg.captured_at, device_id: getDeviceId(),
        }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const json = await res.json();
      if (json.ok && json.id) return { ok: true, time: json.time, pausedActivity: !!json.pausedActivity };
      return { ok: false, msg: json.error ?? "No se pudo registrar", retriable: false };
    } catch {
      return { ok: false, msg: "Sin conexión", retriable: true };
    }
  }, []);

  // Reintento automático de la cola offline
  const drenarCola = useCallback(async () => {
    const q = readQueue();
    setPendientes(q.length);
    if (!q.length) return;
    const rest: QueuedReg[] = [];
    for (const reg of q) {
      const r = await enviar(reg);
      if (!r.ok && r.retriable) rest.push(reg); // sigue sin red: conservar
      // ok o rechazo definitivo (p.ej. duplicado): sale de la cola
    }
    writeQueue(rest);
    setPendientes(rest.length);
  }, [enviar]);

  useEffect(() => {
    drenarCola();
    const id = setInterval(drenarCola, 30000);
    const onOnline = () => drenarCola();
    window.addEventListener("online", onOnline);
    return () => { clearInterval(id); window.removeEventListener("online", onOnline); };
  }, [drenarCola]);

  const registrar = async () => {
    if (enviandoRef.current || !tipo || !motivo || !gps.ok || gps.lat === null) return;
    enviandoRef.current = true;
    setEnviando(true);
    const reg: QueuedReg = { reason: motivo, tipo, lat: gps.lat, lng: gps.lng!, captured_at: new Date().toISOString() };
    const r = await enviar(reg);
    enviandoRef.current = false;
    setEnviando(false);
    if (r.ok) {
      const q = tipo === "Entrada" ? quoteEntrada() : quoteSalida();
      setResultado({ kind: "ok", motivo, hora: r.time?.slice(0, 8) ?? "", quote: q, pausedActivity: r.pausedActivity });
    } else if (r.retriable) {
      // I15: sin red → a la cola. NUNCA un éxito falso: pantalla ámbar "pendiente".
      writeQueue([...readQueue(), reg]);
      setPendientes(readQueue().length);
      setResultado({ kind: "queued", motivo });
    } else {
      setResultado({ kind: "error", msg: r.msg });
    }
  };

  const reiniciar = () => {
    // Fix B8: React re-renderiza el resultado completo — no hay quotes apilados posibles.
    setTipo(""); setMotivo(""); setResultado(null);
  };

  // Quote del día en portada (antes de 14:00 → entrada; después → salida)
  const esManana = new Date().getHours() < 14;
  const q = esManana ? quoteEntrada() : quoteSalida();

  const motivos = tipo === "Entrada" ? MOTIVOS_ENTRADA : tipo === "Salida" ? MOTIVOS_SALIDA : [];
  const puedeRegistrar = Boolean(nombre && tipo && motivo && gps.ok && !enviando);

  return (
    <div className="checador-body">
      <div className="ck-card">
        {resultado === null ? (
          <>
            <div className="ck-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-cert.png" alt="Logo CERT" />
            </div>
            <h1 className="ck-h1">Check-in Oficina</h1>
            <p className="ck-subtitle">{fechaHora}</p>

            {/* Quote del día */}
            <div className="ck-quote-card">
              <span className={`ck-quote-tipo ${esManana ? "entrada" : "salida"}`}>
                {esManana ? "✦ Para empezar el día" : "✦ Para cerrar el día"}
              </span>
              <p className="ck-quote-texto">“{q.texto}”</p>
              <p className="ck-quote-autor">— {q.autor}</p>
            </div>

            {/* Empleado: identidad de la sesión (Google), sin selector */}
            <label className="ck-label">Empleado</label>
            <div className="ck-empleado">
              <span style={{ fontSize: 16 }}>👤</span> {nombre || "Cargando…"}
            </div>

            {pendientes > 0 && (
              <div className="ck-aviso">
                <span style={{ fontSize: 16 }}>📶</span>
                <span>{pendientes} registro{pendientes > 1 ? "s" : ""} guardado{pendientes > 1 ? "s" : ""} en el teléfono — se enviará{pendientes > 1 ? "n" : ""} automáticamente al recuperar señal.</span>
              </div>
            )}

            <label className="ck-label">Tipo de registro</label>
            <div className="ck-tipo-grupo">
              <button
                className={`ck-tipo-btn entrada ${tipo === "Entrada" ? "activo" : ""}`}
                onClick={() => { setTipo("Entrada"); setMotivo(""); }}
              >🟢 Entrada</button>
              <button
                className={`ck-tipo-btn salida ${tipo === "Salida" ? "activo" : ""}`}
                onClick={() => { setTipo("Salida"); setMotivo(""); }}
              >🔴 Salida</button>
            </div>

            {tipo && (
              <div className="ck-motivo-wrap">
                <label className="ck-label">Motivo de {tipo === "Entrada" ? "entrada" : "salida"}</label>
                <div className="ck-motivo-grid">
                  {motivos.map((m) => (
                    <button
                      key={m.value}
                      className={`ck-motivo-btn ${motivo === m.value ? "activo" : ""}`}
                      onClick={() => setMotivo(m.value)}
                    >{m.label}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="ck-gps">
              <div className={`ck-gps-dot ${gps.lat === null && gps.txt.startsWith("Obteniendo") ? "buscando" : gps.ok ? "ok" : "error"}`} />
              <span>{gps.txt}</span>
            </div>

            <button className="ck-btn-registrar" disabled={!puedeRegistrar} onClick={registrar}>
              {enviando ? "Enviando…" : "Registrar"}
            </button>
          </>
        ) : resultado.kind === "ok" ? (
          <div className="ck-resultado ok">
            <div className="ck-res-icono">{ICONOS[resultado.motivo] ?? "✅"}</div>
            <div className="ck-res-titulo">{resultado.motivo}</div>
            <div className="ck-res-hora">{nombre} · {fechaHora.split("·")[0].trim()} {resultado.hora}</div>
            <div className="ck-quote-resultado">
              “{resultado.quote.texto}”<br />
              <strong style={{ fontSize: 11, opacity: 0.7 }}>— {resultado.quote.autor}</strong>
            </div>
            {resultado.pausedActivity && (
              <p style={{ fontSize: 12, marginTop: 10, opacity: 0.8 }}>⏸️ Se pausó tu actividad en curso automáticamente.</p>
            )}
            <Link href="/" className="ck-btn-registrar ck-btn-primary" style={{ marginTop: 16, display: "block", textAlign: "center", textDecoration: "none" }}>
              Ir a Mi Día
            </Link>
            <button className="ck-btn-registrar ck-btn-secondary" style={{ marginTop: 10 }} onClick={reiniciar}>Nuevo registro</button>
          </div>
        ) : resultado.kind === "queued" ? (
          <div className="ck-resultado pendiente">
            <div className="ck-res-icono">📶</div>
            <div className="ck-res-titulo">Guardado en el teléfono</div>
            <div className="ck-res-hora">
              Sin señal: tu «{resultado.motivo}» se enviará automáticamente al recuperar conexión.
              <br /><strong>Aún NO está registrado en el sistema.</strong>
            </div>
            <button className="ck-btn-registrar" style={{ marginTop: 16 }} onClick={reiniciar}>Entendido</button>
          </div>
        ) : (
          <div className="ck-resultado error">
            <div className="ck-res-icono">❌</div>
            <div className="ck-res-titulo">No se registró</div>
            <div className="ck-res-hora">{resultado.msg}</div>
            <button className="ck-btn-registrar" style={{ marginTop: 16 }} onClick={reiniciar}>Intentar de nuevo</button>
          </div>
        )}

        <p className="ck-powered">Hecho con ❤️ por Samu Chan</p>
      </div>
    </div>
  );
}
