"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePersistedView } from "@/lib/persisted-view";
import type { CalendarEvent, CalendarLayer, CalendarView } from "./types";

/* ── Calendar Engine · estado global por instancia ──
   (EMET-CALENDAR-ENGINE.md §4) — vista, fecha activa, capas y eventos
   compartidos por todas las vistas del motor. La vista se persiste por
   usuario (usePersistedView); la fecha y las capas son estado local. */

export const CALENDAR_VIEWS: readonly CalendarView[] = ["agenda", "day", "week", "month", "year"];

interface CalendarEngineCtx {
  view: CalendarView;
  setView: (v: CalendarView) => void;
  cursor: string;                 // fecha activa ISO "YYYY-MM-DD"
  setCursor: (d: string) => void;
  today: string;
  events: CalendarEvent[];
  /** Capas activas (toggle de fuentes). Al ocultar una capa, sus eventos
      desaparecen del calendario y de la leyenda al mismo tiempo. */
  layers: CalendarLayer[];
  toggleLayer: (key: string) => void;
  setAllLayers: (active: boolean) => void;
  /** Eventos visibles tras aplicar el filtro de capas. */
  visibleEvents: CalendarEvent[];
  selectedDate: string | null;
  setSelectedDate: (d: string | null) => void;
}

const CalendarCtx = createContext<CalendarEngineCtx | null>(null);

export function CalendarEngine({
  today,
  viewKey = "calendar.engine.view",
  events = [],
  layers = [],
  children,
}: {
  today: string;
  viewKey?: string;
  events?: CalendarEvent[];
  layers?: CalendarLayer[];
  children: React.ReactNode;
}) {
  const [view, setViewState] = usePersistedView<CalendarView>(
    viewKey, CALENDAR_VIEWS, "month"
  );
  const [cursor, setCursor] = useState(today);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [layerState, setLayerState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(layers.map((l) => [l.key, l.active]))
  );

  const setView = useCallback((v: CalendarView) => setViewState(v), [setViewState]);

  const effectiveLayers = useMemo(() =>
    layers.map((l) => ({ ...l, active: layerState[l.key] ?? l.active }))
  , [layers, layerState]);

  const toggleLayer = useCallback((key: string) => {
    setLayerState((s) => ({ ...s, [key]: !(s[key] ?? true) }));
  }, []);

  const setAllLayers = useCallback((active: boolean) => {
    setLayerState(Object.fromEntries(layers.map((l) => [l.key, active])));
  }, [layers]);

  const activeKeys = useMemo(() => {
    const set = new Set(effectiveLayers.filter((l) => l.active).map((l) => l.key));
    if (set.size === 0) return null; // sin capas → no ocultar nada (nada activo)
    return set;
  }, [effectiveLayers]);

  const visibleEvents = useMemo(() => {
    if (!activeKeys) return events;
    return events.filter((ev) => activeKeys.has(ev.kind));
  }, [events, activeKeys]);

  const value = useMemo<CalendarEngineCtx>(() => ({
    view, setView, cursor, setCursor, today,
    events, layers: effectiveLayers, toggleLayer, setAllLayers,
    visibleEvents, selectedDate, setSelectedDate,
  }), [view, setView, cursor, today, events, effectiveLayers, toggleLayer, setAllLayers, visibleEvents, selectedDate]);

  return <CalendarCtx.Provider value={value}>{children}</CalendarCtx.Provider>;
}

export function useCalendarEngine(): CalendarEngineCtx {
  const ctx = useContext(CalendarCtx);
  if (!ctx) throw new Error("useCalendarEngine debe usarse dentro de <CalendarEngine>");
  return ctx;
}
