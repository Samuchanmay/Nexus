"use client";
// ═══════════════════════════════════════════════════════════════
//  NEXUS · /fichar — Registro de Jornada (antes "Check-in Oficina")
//  El estado/acciones/preselección/frase ya vienen resueltos del
//  servidor (page.tsx) — este componente solo confirma la acción y
//  maneja lo que de verdad necesita el navegador: GPS en vivo, reloj,
//  y la cola offline (I15, se conserva casi intacta del diseño previo,
//  ya funcionaba bien).
// ═══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";
import { Icon } from "@/components/os/icons";
import type { AttendanceReason } from "@/lib/types";
import type { AccionJornada, ContextoJornada, Momento } from "@/lib/jornada-flow";
import type { Quote } from "./quotes";

const ZONA_RESPALDO = { lat: 20.405833, lng: -89.529222, radio_m: 50 };

const BADGE_MOMENTO: Record<Momento, string> = {
  inicio: "Para empezar el día",
  durante: "Mientras trabajas",
  cierre: "Para cerrar el día",
  finalizada: "Que descanses",
};

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Cola offline (I15) — sin cambios de fondo, solo movida de archivo ──
type QueuedReg = { reason: AttendanceReason; lat: number; lng: number; captured_at: string };
const QKEY = "nexus_fichar_queue";
const readQueue = (): QueuedReg[] => {
  try { return JSON.parse(localStorage.getItem(QKEY) ?? "[]"); } catch { return []; }
};
const writeQueue = (q: QueuedReg[]) => localStorage.setItem(QKEY, JSON.stringify(q));

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

export default function FicharClient({
  nombre, area, avatarUrl, color, contexto, frase, zonas: zonasIniciales,
}: {
  nombre: string;
  area: string;
  avatarUrl: string | null;
  color: string;
  contexto: ContextoJornada;
  frase: Quote;
  zonas: { lat: number; lng: number; radio_m: number }[] | null;
}) {
  const router = useRouter();
  const [fechaHora, setFechaHora] = useState("Cargando…");
  const [gps, setGps] = useState<{ ok: boolean; txt: string; lat: number | null; lng: number | null }>(
    { ok: false, txt: "Obteniendo ubicación…", lat: null, lng: null },
  );
  const [zonas] = useState(zonasIniciales?.length ? zonasIniciales : [ZONA_RESPALDO]);
  const [seleccion, setSeleccion] = useState<AttendanceReason | null>(contexto.preseleccionId);
  const [enviando, setEnviando] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [banner, setBanner] = useState<null | { kind: "ok" | "queued" | "error"; texto: string }>(null);
  const enviandoRef = useRef(false);

  // Reloj
  useEffect(() => {
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const tick = () => {
      const n = new Date();
      const p = (x: number) => String(x).padStart(2, "0");
      let h = n.getHours();
      const suffix = h >= 12 ? "p.m." : "a.m.";
      h = h % 12; if (h === 0) h = 12;
      setFechaHora(`${dias[n.getDay()]} ${n.getDate()} de ${meses[n.getMonth()]} · ${h}:${p(n.getMinutes())}:${p(n.getSeconds())} ${suffix}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // GPS en vivo — dentro de rango = dentro del radio de CUALQUIERA de las zonas activas.
  useEffect(() => {
    if (!navigator.geolocation) { setGps({ ok: false, txt: "GPS no disponible", lat: null, lng: null }); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const precision = Math.round(accuracy || 0);
        const margen = Math.min(accuracy || 0, 15);
        let dist = Infinity;
        let dentro = false;
        for (const z of zonas) {
          const d = haversine(lat, lng, z.lat, z.lng);
          if (d < dist) dist = d;
          if (Math.max(0, d - margen) <= z.radio_m) { dentro = true; break; }
        }
        setGps(dentro
          ? { ok: true, txt: `Ubicación verificada (${Math.round(dist)} m · ±${precision} m)`, lat, lng }
          : { ok: false, txt: `Fuera de rango · ${Math.round(dist)} m de la zona más cercana (±${precision} m)`, lat, lng });
      },
      (err) => setGps({ ok: false, txt: err.code === 1 ? "Permiso denegado — activa ubicación" : "No se pudo obtener GPS", lat: null, lng: null }),
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [zonas]);

  const enviar = useCallback(async (reg: QueuedReg): Promise<{ ok: true; pausedActivity: boolean } | { ok: false; msg: string; retriable: boolean }> => {
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
      if (json.ok && json.id) return { ok: true, pausedActivity: !!json.pausedActivity };
      return { ok: false, msg: json.error ?? "No se pudo registrar", retriable: false };
    } catch {
      return { ok: false, msg: "Sin conexión", retriable: true };
    }
  }, []);

  const drenarCola = useCallback(async () => {
    const q = readQueue();
    setPendientes(q.length);
    if (!q.length) return;
    const rest: QueuedReg[] = [];
    for (const reg of q) {
      const r = await enviar(reg);
      if (!r.ok && r.retriable) rest.push(reg);
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
    if (enviandoRef.current || !seleccion || !gps.ok || gps.lat === null) return;
    enviandoRef.current = true;
    setEnviando(true);
    setBanner(null);
    const reg: QueuedReg = { reason: seleccion, lat: gps.lat, lng: gps.lng!, captured_at: new Date().toISOString() };
    const r = await enviar(reg);
    enviandoRef.current = false;
    setEnviando(false);
    if (r.ok) {
      setBanner({ kind: "ok", texto: "Registro realizado correctamente" });
      setTimeout(() => router.push("/"), 1100);
    } else if (r.retriable) {
      writeQueue([...readQueue(), reg]);
      setPendientes(readQueue().length);
      setBanner({ kind: "queued", texto: "Guardado en este dispositivo. Se sincronizará automáticamente cuando vuelva la conexión." });
      setTimeout(() => router.push("/"), 1800);
    } else {
      setBanner({ kind: "error", texto: r.msg });
    }
  };

  const puedeRegistrar = Boolean(seleccion && gps.ok && !enviando && contexto.acciones.length > 0);
  const esUnicaAccion = contexto.acciones.length <= 1;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[420px] rounded-[22px] p-6" style={{ background: "var(--surface)", boxShadow: "var(--shadow-2)" }}>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 mb-3.5 text-[13px] font-semibold"
          style={{ color: "var(--text-2)" }}
        >
          <Icon name="chevron" size={14} style={{ transform: "rotate(180deg)" }} /> Volver
        </button>

        <div className="text-center mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-cert.png" alt="Logo CERT" className="w-14 h-14 mx-auto object-contain mb-2" />
          <h1 className="text-[19px] font-bold" style={{ color: "var(--text-1)" }}>Registro de jornada</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text-2)" }}>{fechaHora}</p>
        </div>

        {/* Frase del día — un momento de pausa, no compite con la acción principal */}
        <div className="mt-4 rounded-[14px] px-4 py-3.5 text-center" style={{ background: "var(--accent-tint)" }}>
          <span
            className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-wide mb-1.5 px-2 py-0.5 rounded-full"
            style={{ color: "var(--accent)", background: "var(--surface)" }}
          >
            <Icon name="sparkle" size={10} /> {BADGE_MOMENTO[contexto.momento]}
          </span>
          <p className="text-[13.5px] font-medium leading-snug" style={{ color: "var(--text-1)" }}>&ldquo;{frase.texto}&rdquo;</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-3)" }}>— {frase.autor}</p>
        </div>

        {/* Colaborador */}
        <div className="mt-4 flex items-center gap-2.5">
          <Avatar name={nombre} avatarUrl={avatarUrl} color={color} size={34} />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold truncate" style={{ color: "var(--text-1)" }}>{nombre}</p>
            {area && <p className="text-[12px] truncate" style={{ color: "var(--text-3)" }}>{area}</p>}
          </div>
        </div>

        {pendientes > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-[10px] px-3 py-2" style={{ background: "var(--warn-tint)" }}>
            <Icon name="signal" size={14} style={{ color: "var(--warn)" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--text-1)" }}>
              {pendientes} registro{pendientes > 1 ? "s" : ""} guardado{pendientes > 1 ? "s" : ""} en este dispositivo — se enviará{pendientes > 1 ? "n" : ""} solo{pendientes > 1 ? "s" : ""} al recuperar señal.
            </span>
          </div>
        )}

        {/* ── Acciones — tarjetas con emoji, no botones. Cuando hay una sola,
            ya viene preseleccionada del servidor y ni siquiera hace falta
            tocarla: solo confirmar con Registrar. ── */}
        <div className="mt-4 space-y-2">
          {contexto.acciones.length === 0 ? (
            <TarjetaInfo emoji="✅" titulo="Jornada finalizada" descripcion="Nos vemos mañana." />
          ) : (
            contexto.acciones.map((accion) => (
              <TarjetaAccion
                key={accion.id}
                accion={accion}
                seleccionada={seleccion === accion.id}
                tocable={!esUnicaAccion}
                onClick={() => !esUnicaAccion && setSeleccion(accion.id)}
              />
            ))
          )}
        </div>

        {contexto.acciones.length > 0 && (
          <>
            <div className="mt-4 flex items-center gap-2 text-[12px]" style={{ color: gps.ok ? "var(--ok)" : "var(--text-3)" }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: gps.lat === null && gps.txt.startsWith("Obteniendo") ? "var(--text-3)" : gps.ok ? "var(--ok)" : "var(--danger)" }} />
              {gps.txt}
            </div>

            {banner && (
              <div
                className="mt-3 rounded-[10px] px-3 py-2.5 text-[12.5px] font-medium flex items-start gap-2"
                style={{
                  background: banner.kind === "ok" ? "var(--ok-tint)" : banner.kind === "queued" ? "var(--warn-tint)" : "var(--danger-tint)",
                  color: banner.kind === "ok" ? "var(--ok)" : banner.kind === "queued" ? "var(--warn)" : "var(--danger)",
                }}
              >
                <Icon name={banner.kind === "ok" ? "check" : banner.kind === "queued" ? "signal" : "close"} size={14} className="shrink-0 mt-0.5" />
                <span>{banner.texto}</span>
              </div>
            )}

            <button
              disabled={!puedeRegistrar}
              onClick={registrar}
              className="w-full mt-4 h-12 rounded-[14px] text-[14.5px] font-bold transition-opacity"
              style={{
                background: "var(--accent)", color: "#fff",
                opacity: puedeRegistrar ? 1 : 0.4,
                cursor: puedeRegistrar ? "pointer" : "not-allowed",
              }}
            >
              {enviando ? "Enviando…" : "Registrar"}
            </button>
          </>
        )}

        <p className="text-center text-[12px] mt-5" style={{ color: "var(--text-3)" }}>Hecho con ❤️ por Samu Chan</p>
      </div>
    </div>
  );
}

function TarjetaAccion({
  accion, seleccionada, tocable, onClick,
}: { accion: AccionJornada; seleccionada: boolean; tocable: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 rounded-[14px] px-3.5 py-3 border transition-all duration-[180ms]"
      style={{
        borderColor: seleccionada ? "var(--accent)" : "var(--border)",
        background: seleccionada ? "var(--accent-tint)" : "var(--surface-2)",
        cursor: tocable ? "pointer" : "default",
        transform: seleccionada ? "translateY(-1px)" : "none",
        boxShadow: seleccionada ? "var(--shadow-1)" : "none",
      }}
    >
      <span className="text-[24px] leading-none shrink-0" aria-hidden>{accion.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold" style={{ color: "var(--text-1)" }}>{accion.titulo}</p>
        {accion.descripcion && <p className="text-[12px] mt-0.5" style={{ color: "var(--text-3)" }}>{accion.descripcion}</p>}
      </div>
      <div
        className="w-5 h-5 rounded-full border shrink-0 flex items-center justify-center"
        style={{ borderColor: seleccionada ? "var(--accent)" : "var(--border-2)", background: seleccionada ? "var(--accent)" : "transparent" }}
      >
        {seleccionada && <Icon name="check" size={11} style={{ color: "#fff" }} />}
      </div>
    </div>
  );
}

function TarjetaInfo({ emoji, titulo, descripcion }: { emoji: string; titulo: string; descripcion: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] px-3.5 py-4" style={{ background: "var(--ok-tint)" }}>
      <span className="text-[24px] leading-none shrink-0" aria-hidden>{emoji}</span>
      <div>
        <p className="text-[14px] font-semibold" style={{ color: "var(--text-1)" }}>{titulo}</p>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-3)" }}>{descripcion}</p>
      </div>
    </div>
  );
}
