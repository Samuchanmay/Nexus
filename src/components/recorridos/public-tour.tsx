"use client";
/**
 * PublicTour — reproductor público de un recorrido compartido por link
 * (/r/<slug>). Misma presentación (portada + branding) que el overlay del
 * onboarding, pero de un solo demo y sin navegación de demos.
 */
import { useState } from "react";
import { Button } from "@/components/os/ui";
import { SerPlayerFrame } from "@/components/recorridos/ser-player";

type ScreenRow = { index: number; snapshot_url: string; thumbnail_url: string | null; interaction_ctx: Record<string, unknown> };

type TourOptions = {
  color?: string;
  showStepNo?: boolean;
  nextBtnText?: string;
  prevBtnText?: string;
};

export function PublicTour({ title, description, screens, slug }: {
  title: string; description: string | null; screens: ScreenRow[]; slug: string;
}) {
  const [screenIdx, setScreenIdx] = useState(0);
  const totalScreens = Math.max(screens.length, 1);
  const isLast = screenIdx === screens.length - 1;

  const options = (screens[0]?.interaction_ctx?.tour_options ?? {}) as TourOptions;
  const accent = options.color || "var(--accent)";
  const nextText = options.nextBtnText || "Siguiente";
  const prevText = options.prevBtnText || "Anterior";
  const showStepNo = options.showStepNo !== false;

  const currentCtx = (screens[screenIdx]?.interaction_ctx ?? {}) as Record<string, unknown>;
  const isCover = !!currentCtx.cover;
  const coverTitle = typeof currentCtx.cover_title === "string" ? currentCtx.cover_title : title;
  const coverText = typeof currentCtx.cover_text === "string" ? currentCtx.cover_text : "";

  return (
    <div className="bg-card border border-border rounded-m shadow-nx overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          <span className="text-[13.5px] font-bold text-text-1">Recorrido</span>
        </div>
        <span className="text-[12.5px] text-text-3">{slug}</span>
      </div>

      <div className="px-5 pt-4">
        <h1 className="text-[19px] font-bold text-text-1">{title}</h1>
        {description && <p className="text-[13.5px] text-text-2 mt-1">{description}</p>}
      </div>

      <div className="px-5 py-4">
        {isCover ? (
          <div className="aspect-[16/9] w-full rounded-m overflow-hidden border border-border grid place-items-center p-6 text-center" style={{ background: "var(--card)" }}>
            <div>
              <h2 className="text-[19px] font-bold text-text-1">{coverTitle}</h2>
              {coverText && <p className="text-[13.5px] text-text-2 mt-2">{coverText}</p>}
            </div>
          </div>
        ) : (
          <div className="aspect-[16/9] w-full rounded-m overflow-hidden bg-white border border-border">
            <SerPlayerFrame
              key={`${slug}:${screens.length}`}
              screens={screens}
              screenIdx={screenIdx}
              className="w-full h-full"
            />
          </div>
        )}
        <p className="text-[12px] text-text-3 text-center mt-3">
          {title}
          {showStepNo && <> · Pantalla {screenIdx + 1} de {totalScreens}</>}
        </p>
      </div>

      {screens.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-5 pb-2">
          {screens.map((s, i) => (
            <button
              key={i}
              onClick={() => setScreenIdx(i)}
              className={`shrink-0 w-16 h-10 rounded border overflow-hidden transition-opacity ${
                i === screenIdx ? "border-accent opacity-100" : "border-border opacity-50 hover:opacity-80"
              }`}
              aria-label={`Pantalla ${i + 1}`}
            >
              <span className="w-full h-full grid place-items-center text-[10px] font-bold text-text-3">{i + 1}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-5 py-4 border-t border-border">
        <Button variant="subtle" size="sm" disabled={screenIdx === 0} onClick={() => setScreenIdx((i) => Math.max(0, i - 1))}>
          {prevText}
        </Button>
        <Button variant="primary" size="sm" onClick={() => setScreenIdx((i) => Math.min(screens.length - 1, i + 1))}>
          {isLast ? "Fin" : nextText}
        </Button>
      </div>
    </div>
  );
}
