"use client";
/**
 * OnboardingDemos — overlay del primer login. Tras completar el onboarding
 * de perfil, si hay recorridos (demos) publicados para el rol del usuario,
 * se muestran como tour guiado (título + descripción + miniaturas por
 * pantalla). Se ve una sola vez por usuario (marca en localStorage).
 */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/os/ui";
import { SerPlayerFrame } from "@/components/recorridos/ser-player";
import { useTourPlayer } from "@/components/recorridos/use-tour-player";

type DemoRow = { id: string; slug: string; title: string; description: string | null; target_role: string };
type ScreenRow = { index: number; snapshot_url: string; thumbnail_url: string | null; interaction_ctx: Record<string, unknown> };

type TourOptions = {
  color?: string;
  showStepNo?: boolean;
  nextBtnText?: string;
  prevBtnText?: string;
};

type LoadedDemo = DemoRow & { screens: ScreenRow[]; thumbs: (string | null)[] };

const SEEN_KEY = (userId: string) => `nexus:recorridos:visto:${userId}`;

function recordView(demoId: string, event: "abierta" | "completada") {
  fetch("/api/demos/view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ demo_id: demoId, event }),
  }).catch(() => { /* analítica no crítica */ });
}

export function OnboardingDemos({ userId }: { userId: string }) {
  const [demos, setDemos] = useState<LoadedDemo[]>([]);
  const [open, setOpen] = useState(false);
  const [demoIdx, setDemoIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window === "undefined") return;
        if (window.localStorage.getItem(SEEN_KEY(userId))) return;

        const supabase = createClient();
        const { data: rows } = await supabase.rpc("get_onboarding_demos");
        if (cancelled || !rows || rows.length === 0) return;

        const loaded = await Promise.all((rows as DemoRow[]).map(async (d) => {
          const { data } = await supabase.rpc("get_public_demo", { p_slug: d.slug });
          const screens = (data?.screens ?? []) as ScreenRow[];
          const thumbs = await Promise.all(screens.map((s) => {
            if (!s.thumbnail_url) return Promise.resolve(null);
            // Publicadas: URLs públicas directas. Borradores visibles para
            // admin: ruta de storage que se firma con la sesión.
            if (s.thumbnail_url.startsWith("http")) return Promise.resolve(s.thumbnail_url);
            return supabase.storage.from("demos").createSignedUrl(s.thumbnail_url, 3600)
              .then((r) => r.data?.signedUrl ?? null)
              .catch(() => null);
          }));
          return { ...d, screens, thumbs };
        }));

        if (cancelled) return;
        setDemos(loaded);
        setOpen(true);
        recordView(loaded[0].id, "abierta");
      } catch {
        /* si falla la carga, simplemente no se muestra el tour */
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const finish = (completed: boolean) => {
    if (demos[demoIdx]) recordView(demos[demoIdx].id, "completada");
    window.localStorage.setItem(SEEN_KEY(userId), "1");
    setOpen(false);
  };

  const demo = demos[demoIdx] ?? null;
  const tour = useTourPlayer({
    total: demo?.screens.length ?? 0,
    intervalMs: 3000,
    resetKey: demo?.id,
    onEnd: () => {
      if (demoIdx < demos.length - 1) {
        setDemoIdx(demoIdx + 1);
        recordView(demos[demoIdx + 1].id, "abierta");
      } else {
        finish(true);
      }
    },
  });

  // Al volver a un demo anterior, quedarse en su última pantalla (el reset
  // del hook por cambio de demo deja la primera).
  const prevDemoIdx = useRef(demoIdx);
  useEffect(() => {
    const prev = prevDemoIdx.current;
    prevDemoIdx.current = demoIdx;
    if (prev > demoIdx && demo) {
      tour.goTo(Math.max(demo.screens.length - 1, 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoIdx]);

  if (!open || demos.length === 0 || !demo) return null;

  const totalScreens = Math.max(demo.screens.length, 1);
  const isLast = demoIdx === demos.length - 1 && tour.isLast;

  // Branding / opciones guardadas por la extensión en la 1ª pantalla
  const options = (demo.screens[0]?.interaction_ctx?.tour_options ?? {}) as TourOptions;
  const accent = options.color || "var(--accent)";
  const nextText = options.nextBtnText || "Siguiente";
  const prevText = options.prevBtnText || "Anterior";
  const showStepNo = options.showStepNo !== false;

  // Portada: pantalla de presentación capturada sin URL ni snapshot
  const currentCtx = (demo.screens[tour.screenIdx]?.interaction_ctx ?? {}) as Record<string, unknown>;
  const isCover = !!currentCtx.cover;
  const coverTitle = typeof currentCtx.cover_title === "string" ? currentCtx.cover_title : demo.title;
  const coverText = typeof currentCtx.cover_text === "string" ? currentCtx.cover_text : "";

  const jumpTo = (i: number) => {
    tour.pause();
    tour.goTo(i);
  };

  const next = () => {
    tour.pause();
    if (tour.screenIdx < demo.screens.length - 1) {
      tour.next();
    } else if (demoIdx < demos.length - 1) {
      setDemoIdx(demoIdx + 1);
      recordView(demos[demoIdx + 1].id, "abierta");
    } else {
      finish(true);
    }
  };

  const back = () => {
    tour.pause();
    if (tour.screenIdx > 0) {
      tour.prev();
    } else if (demoIdx > 0) {
      setDemoIdx(demoIdx - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 nx-fade">
      <div className="absolute inset-0 bg-black/50" onClick={() => finish(false)} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-m shadow-nx overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
            <span className="text-[13.5px] font-bold text-text-1">Recorridos</span>
          </div>
          <button
            className="text-[12.5px] text-text-3 hover:text-text-1 transition-colors"
            onClick={() => finish(false)}
          >
            Omitir
          </button>
        </div>

        {/* Título del demo */}
        <div className="px-5 pt-4">
          <h2 className="text-[19px] font-bold text-text-1">{demo.title}</h2>
          {demo.description && <p className="text-[13.5px] text-text-2 mt-1">{demo.description}</p>}
        </div>

        {/* Pantalla */}
        <div className="px-5 py-4">
          {isCover ? (
            <div className="aspect-[16/9] w-full rounded-m overflow-hidden border border-border grid place-items-center p-6 text-center" style={{ background: "var(--card)" }}>
              <div>
                <h3 className="text-[19px] font-bold text-text-1">{coverTitle}</h3>
                {coverText && <p className="text-[13.5px] text-text-2 mt-2">{coverText}</p>}
              </div>
            </div>
          ) : (
            <div className="aspect-[16/9] w-full rounded-m overflow-hidden bg-white border border-border">
              <SerPlayerFrame
                key={`${demo.id}:${demo.screens.length}`}
                screens={demo.screens}
                screenIdx={tour.screenIdx}
                className="w-full h-full"
              />
            </div>
          )}
          <p className="text-[12px] text-text-3 text-center mt-3">
            {demo.title}
            {showStepNo && <> · Pantalla {tour.screenIdx + 1} de {totalScreens}</>}
            {demos.length > 1 && <> · Demo {demoIdx + 1} de {demos.length}</>}
            {tour.playing && <> · Reproduciendo</>}
          </p>
        </div>

        {/* Tira de miniaturas */}
        {demo.screens.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-5 pb-2">
            {demo.screens.map((s, i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                className={`shrink-0 w-16 h-10 rounded border overflow-hidden transition-opacity ${
                  i === tour.screenIdx ? "border-accent opacity-100" : "border-border opacity-50 hover:opacity-80"
                }`}
                aria-label={`Pantalla ${i + 1}`}
              >
                {demo.thumbs[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={demo.thumbs[i] ?? ""} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full grid place-items-center text-[10px] font-bold text-text-3">
                    {i + 1}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Progreso */}
        <div className="flex justify-center gap-1.5 pb-2">
          {demo.screens.map((_, i) => (
            <span
              key={i}
              className={cxDot(i === tour.screenIdx)}
              style={i === tour.screenIdx && accent !== "var(--accent)" ? { background: accent } : undefined}
            />
          ))}
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <Button variant="subtle" size="sm" disabled={demoIdx === 0 && tour.screenIdx === 0} onClick={back}>
            {prevText}
          </Button>
          <Button
            variant={tour.playing ? "subtle" : "primary"} size="sm"
            disabled={demo.screens.length <= 1}
            onClick={() => (tour.playing ? tour.pause() : tour.play())}
          >
            {tour.playing ? "⏸ Pausar" : "▶ Reproducir"}
          </Button>
          <Button variant="primary" size="sm" onClick={next}>
            {isLast ? "Listo" : nextText}
          </Button>
        </div>
      </div>
    </div>
  );
}

function cxDot(active: boolean) {
  return `h-1.5 rounded-full transition-all duration-200 ${active ? "w-5 bg-accent" : "w-1.5 bg-text-3 opacity-40"}`;
}
