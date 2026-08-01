"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeScreenData, SerPlayer } from "@/lib/recorridos/player/player";
import type { SerScreen } from "@/lib/recorridos/player/types";

type ScreenSource = {
  snapshot_url: string;
};

type Props = {
  screens: ScreenSource[];
  screenIdx: number;
  onReady?: () => void;
  onError?: () => void;
  className?: string;
};

export function SerPlayerFrame({ screens, screenIdx, onReady, onError, className }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<SerPlayer | null>(null);
  const cacheRef = useRef<Map<number, SerScreen>>(new Map());
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  }, [onReady, onError]);

  const loadScreen = useCallback(async (i: number): Promise<SerScreen> => {
    const cached = cacheRef.current.get(i);
    if (cached) return cached;
    const url = screens[i]?.snapshot_url;
    if (!url) throw new Error("sin snapshot");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`snapshot ${res.status}`);
    const screen = normalizeScreenData(await res.json());
    cacheRef.current.set(i, screen);
    return screen;
  }, [screens]);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;

    const player = new SerPlayer(frame);
    playerRef.current = player;
    let cancelled = false;

    const boot = async () => {
      try {
        if (!frame.contentDocument || frame.contentDocument.readyState === "loading") {
          await new Promise<void>((resolve) => {
            const onLoad = () => resolve();
            frame.addEventListener("load", onLoad, { once: true });
            setTimeout(() => {
              frame.removeEventListener("load", onLoad);
              resolve();
            }, 1000);
          });
        }
        if (cancelled) return;
        const screen0 = await loadScreen(0);
        if (cancelled) return;
        await player.loadFirst(screen0);
        if (!cancelled) {
          setReady(true);
          onReadyRef.current?.();
        }
      } catch (e) {
        console.error("[recorridos]", e);
        if (!cancelled) {
          setReady(true);
          onErrorRef.current?.();
        }
      }
    };
    boot();

    return () => {
      cancelled = true;
      player.destroy();
      playerRef.current = null;
      cacheRef.current = new Map();
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !ready || screenIdx <= 0) return;
    let cancelled = false;
    (async () => {
      try {
        const screen = await loadScreen(screenIdx);
        if (cancelled) return;
        await player.applyNext(screen);
      } catch (e) {
        console.error("[recorridos]", e);
        if (!cancelled) onErrorRef.current?.();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenIdx, ready]);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {!ready && (
        <div className="absolute inset-0 z-10 grid place-items-center text-[12px] text-text-3 bg-white">
          Cargando…
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="about:blank"
        title="recorrido"
        className="block w-full h-full"
        style={{ border: 0, background: "#fff" }}
      />
    </div>
  );
}
