"use client";
// ══════════════════════════════════════════════════════════
//  EMU · Banner — única superficie que Fase 1 renderiza de verdad
//  (ver decision-engine.ts → resolveSurface). Nunca decide QUÉ
//  mostrar, solo CÓMO: recibe una EmuDecision ya resuelta por el
//  Decision Engine y la pinta.
//
//  Tono (crítica del usuario, punto 5 "personalidad"): un hecho
//  corto, sin saludo, sin relleno — nunca "Hola Samuel, espero que
//  tengas un excelente día". El texto ya viene así desde rules.ts;
//  este componente no le agrega adornos.
//
//  Memoria mínima (punto 4): si el usuario ignora la misma regla
//  3+ veces, el snooze del botón "×" deja de durar "hasta mañana"
//  y pasa a durar solo 1 hora — EMU insiste un poco más, no porque
//  lo decida un LLM, sino porque el conteo de veces ignoradas
//  (guardado en localStorage) así lo marca.
// ══════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui";
import { Icon } from "./icons";
import { gatherEmuContext } from "@/lib/emu/context-engine";
import { EMU_RULES_FASE1 } from "@/lib/emu/rules";
import { decide, resolveSurface } from "@/lib/emu/decision-engine";
import type { EmuDecision } from "@/lib/emu/types";

const POLL_MS = 2 * 60 * 1000;
const SNOOZE_NORMAL_MS = 20 * 60 * 60 * 1000; // ~hasta mañana
const SNOOZE_INSISTENT_MS = 60 * 60 * 1000; // 1h — cuando ya se ignoró 3+ veces

const IGNORE_KEY = "nx_emu_ignored";
const SNOOZE_KEY = "nx_emu_snoozed_until";
const TOAST_SHOWN_KEY = "nx_emu_toast_shown";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* localStorage no disponible — EMU sigue funcionando sin memoria */ }
}

export function EmuBanner({ userId, role }: { userId: string; role: string }) {
  const router = useRouter();
  const toast = useToast();
  const [decision, setDecision] = useState<EmuDecision | null>(null);
  const shownToastRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const poll = async () => {
      const ctx = await gatherEmuContext(supabase, userId, role);
      if (cancelled) return;

      const ignoreCounts = readJSON<Record<string, number>>(IGNORE_KEY, {});
      const candidates = EMU_RULES_FASE1.map((rule) => rule(ctx));
      const next = decide(candidates, ignoreCounts);
      if (!next) { setDecision(null); return; }

      const surface = resolveSurface(next);

      if (surface === "toast") {
        // Refuerzo positivo (presencia silenciosa) — una sola vez por día,
        // no compite con nada, no se puede posponer porque no hay nada que
        // resolver: es solo una constancia de que algo salió bien.
        const todayKey = `${TOAST_SHOWN_KEY}:${ctx.today}:${next.id}`;
        if (!shownToastRef.current.has(todayKey) && !localStorage.getItem(todayKey)) {
          shownToastRef.current.add(todayKey);
          try { localStorage.setItem(todayKey, "1"); } catch { /* no bloquea el toast */ }
          toast(next.message, "ok");
        }
        setDecision(null);
        return;
      }

      // Banner (critical/high) — respeta el snooze activo.
      const snoozed = readJSON<Record<string, number>>(SNOOZE_KEY, {});
      const until = snoozed[next.id] ?? 0;
      if (Date.now() < until) { setDecision(null); return; }
      setDecision(next);
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [userId, role]);

  if (!decision) return null;

  const snoozeFor = (ms: number) => {
    const snoozed = readJSON<Record<string, number>>(SNOOZE_KEY, {});
    snoozed[decision.id] = Date.now() + ms;
    writeJSON(SNOOZE_KEY, snoozed);
  };

  const dismiss = () => {
    // Se ignoró sin actuar — sube el contador de memoria y aplica el
    // snooze correspondiente (normal o insistente, según ese mismo conteo).
    const counts = readJSON<Record<string, number>>(IGNORE_KEY, {});
    const nextCount = (counts[decision.id] ?? 0) + 1;
    counts[decision.id] = nextCount;
    writeJSON(IGNORE_KEY, counts);
    snoozeFor(nextCount >= 3 ? SNOOZE_INSISTENT_MS : SNOOZE_NORMAL_MS);
    setDecision(null);
  };

  const act = () => {
    // Actuó — la memoria de "veces ignorada" se resetea, EMU no tiene por
    // qué seguir insistiendo con algo que ya se resolvió.
    const counts = readJSON<Record<string, number>>(IGNORE_KEY, {});
    delete counts[decision.id];
    writeJSON(IGNORE_KEY, counts);
    snoozeFor(SNOOZE_NORMAL_MS);
    setDecision(null);
    if (decision.ctaHref) router.push(decision.ctaHref);
  };

  const tone = decision.priority === "critical" ? "var(--danger)" : "var(--accent)";
  const tint = decision.priority === "critical" ? "var(--danger-tint)" : "var(--accent-tint)";

  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] w-[min(94vw,480px)]"
      style={{ animation: "nx-pop .2s ease-out" }}
      role="status"
    >
      <div className="flex items-center gap-2.5 rounded-full pl-3.5 pr-2 py-1.5 shadow-nx"
        style={{ background: "var(--panel)", border: `0.5px solid ${tone}` }}>
        <span className="shrink-0 grid place-items-center h-6 w-6 rounded-full" style={{ background: tint, color: tone }}>
          <Icon name={decision.priority === "critical" ? "alert" : "sparkle"} size={13} />
        </span>
        <p className="text-[12.5px] font-semibold flex-1 min-w-0 truncate">{decision.message}</p>
        {decision.offerAutoRemind && (
          <span className="hidden sm:inline text-[11px] shrink-0" style={{ color: "var(--text-3)" }} title="Se te ha recordado varias veces">
            · insistente
          </span>
        )}
        {decision.ctaLabel && (
          <button
            onClick={act}
            className="shrink-0 text-[12px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: tone, color: "#fff" }}
          >
            {decision.ctaLabel}
          </button>
        )}
        <button onClick={dismiss} aria-label="Descartar" className="shrink-0 grid place-items-center h-6 w-6 rounded-full hover:bg-hover">
          <Icon name="close" size={13} />
        </button>
      </div>
    </div>
  );
}
