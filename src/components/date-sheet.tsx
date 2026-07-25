"use client";
/* ═══════════════════════════════════════════════════════════════
   Date Sheet — el ÚNICO componente de selección de fechas en Nexus.
   Un solo motor visual (CalendarGrid) + una sola cáscara de
   interacción (DateSheetShell), portados a document.body para que
   NUNCA queden detrás de un Card, Sheet o Modal por temas de
   stacking context (transform/filter/backdrop-blur de un ancestro).

   - Escritorio: popover anclado al input, animación opacity+scale+
     translateY, cierre por click-fuera / ESC, footer Cancelar·Hoy·Aplicar.
   - Móvil: bottom sheet (mismo lenguaje visual que Sheet en ui.tsx),
     ~70vh, drag-to-dismiss, scroll interno, footer Cancelar·Aceptar.

   Se usa para: DatePicker (día único) y DateRangeField (rango, ej.
   registrar vacaciones directo). DateRangeCalendar sigue existiendo
   para flujos donde el rango ya vive embebido dentro de un Sheet
   propio (solicitar vacaciones) — pero reutiliza el mismo CalendarGrid,
   así que visualmente es exactamente el mismo calendario en todos lados.
═══════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { IconCalendar } from "./icons";
import { MONTHS, DOW, buildMonthGrid, monthBounds, shiftMonth } from "@/lib/calendar-grid";

function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

function todayIsoOf() {
  return new Date().toISOString().slice(0, 10);
}

/* ── CalendarGrid: rejilla mensual — día único o rango. Mismos colores,
   radios, tipografía, hover, "hoy" y "seleccionado" en TODA la app. ── */
function CalendarGrid({
  ym, onYm, value, range, isBlocked, onPick,
}: {
  ym: string;
  onYm: (ym: string) => void;
  value?: string | null;
  range?: { start: string | null; end: string | null };
  isBlocked?: (date: string) => boolean;
  onPick: (date: string) => void;
}) {
  const todayIso = todayIsoOf();
  const { first, last, daysInMonth, year, month } = monthBounds(ym);
  const cells = useMemo(() => buildMonthGrid(first, last, daysInMonth), [first, last, daysInMonth]);

  return (
    <div>
      <div className="flex items-center justify-between px-1 pb-3">
        <button type="button" onClick={() => onYm(shiftMonth(ym, -1))}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[16px] font-bold transition-colors hover:bg-hover"
          style={{ color: "var(--text-2)" }} aria-label="Mes anterior">‹</button>
        <p className="text-[14px] font-bold capitalize tracking-tight px-4">{MONTHS[month - 1]} {year}</p>
        <button type="button" onClick={() => onYm(shiftMonth(ym, 1))}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[16px] font-bold transition-colors hover:bg-hover"
          style={{ color: "var(--text-2)" }} aria-label="Mes siguiente">›</button>
      </div>
      <div className="grid grid-cols-7 text-center mb-1.5">
        {DOW.map((d) => (
          <span key={d} className="text-[10.5px] font-bold py-1" style={{ color: "var(--text-3)" }}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((c, i) => {
          if (!c.inMonth) return <div key={c.date} />;
          const blocked = !!isBlocked?.(c.date);
          const isToday = c.date === todayIso;
          const col = i % 7;
          const rowStart = col === 0, rowEnd = col === 6;

          let selected = false, isStart = false, isEnd = false, ranged = false;
          if (range) {
            isStart = c.date === range.start;
            isEnd = c.date === range.end;
            ranged = !!(range.start && range.end && c.date > range.start && c.date < range.end);
            selected = isStart || isEnd;
          } else {
            selected = c.date === value;
          }
          const barLeft = !rowStart && (ranged || isEnd);
          const barRight = !rowEnd && (ranged || isStart);

          return (
            <div key={c.date} className="relative aspect-square">
              {(barLeft || barRight) && (
                <div className="absolute inset-y-[4px]" style={{
                  left: barLeft ? 0 : "50%",
                  right: barRight ? 0 : "50%",
                  background: "var(--accent-tint)",
                }} />
              )}
              <button
                type="button" disabled={blocked}
                onClick={() => onPick(c.date)}
                className={cx(
                  "relative z-10 w-full h-full rounded-full text-[12.5px] flex items-center justify-center transition-colors",
                  !selected && !blocked && "hover:bg-[var(--hover)]"
                )}
                style={{
                  background: selected ? "var(--accent)" : isToday ? "var(--accent-tint)" : "transparent",
                  color: selected ? "#fff" : blocked ? "var(--text-3)" : isToday ? "var(--accent)" : "var(--text-1)",
                  fontWeight: selected || isToday ? 800 : 600,
                  boxShadow: selected ? "0 2px 8px color-mix(in srgb, var(--accent) 45%, transparent)" : "none",
                  cursor: blocked ? "default" : "pointer",
                  textDecoration: blocked ? "line-through" : "none",
                }}
              >
                {c.day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Footer = { onCancel: () => void; onToday?: () => void; onApply: () => void; applyLabel?: string };

function FooterRow({ footer }: { footer: Footer }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-t border-border">
      <button type="button" onClick={footer.onCancel} className="btn-tertiary h-8 px-2.5 text-[12.5px]">Cancelar</button>
      {footer.onToday && (
        <button type="button" onClick={footer.onToday} className="btn-tertiary h-8 px-2.5 text-[12.5px]">Hoy</button>
      )}
      <button type="button" onClick={footer.onApply} className="btn-primary h-8 px-4 text-[12.5px]">
        {footer.applyLabel ?? "Aplicar"}
      </button>
    </div>
  );
}

/* ── Shell — popover en escritorio, bottom sheet en móvil. Portado a
   document.body: escapa de cualquier stacking context (Cards con
   backdrop-blur, Sheets con transform, motion.div animado, etc.) —
   así se resuelve el bug de z-index de raíz, en todos los usos a la vez. ── */
function DateSheetShell({
  open, anchorRef, onClose, title, children, footer,
}: {
  open: boolean; anchorRef: RefObject<HTMLElement | null>; onClose: () => void;
  title: string; children: React.ReactNode; footer: Footer;
}) {
  const mounted = useMounted();
  const isMobile = useIsMobile();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [dragY, setDragY] = useState(0);
  const dragging = useRef(false);
  const startY = useRef(0);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => { if (!open) setDragY(0); }, [open]);

  useEffect(() => {
    if (!open || isMobile) return;
    const update = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = 304;
      let left = r.left;
      if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - width - 12);
      setPos({ top: r.bottom + 6, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, isMobile, anchorRef]);

  if (!mounted || !open) return null;

  if (isMobile) {
    const onTouchStart = (e: React.TouchEvent) => { dragging.current = true; startY.current = e.touches[0].clientY; };
    const onTouchMove = (e: React.TouchEvent) => {
      if (!dragging.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) setDragY(delta);
    };
    const onTouchEnd = () => {
      dragging.current = false;
      if (dragY > 80) onClose();
      setDragY(0);
    };
    return createPortal(
      <div className="fixed inset-0 z-[999] flex items-end justify-center"
        style={{ background: "rgba(0,0,0,.4)", backdropFilter: "blur(12px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-[520px] flex flex-col"
          style={{
            height: "70vh",
            background: "var(--surface)",
            borderRadius: "26px 26px 0 0",
            borderTop: "0.5px solid var(--border-2)",
            boxShadow: "0 -8px 60px rgba(0,0,0,0.22)",
            transform: `translateY(${dragY}px)`,
            transition: dragY ? "none" : "transform .4s var(--spring)",
          }}>
          <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="shrink-0 cursor-grab active:cursor-grabbing">
            <div className="w-[34px] h-[5px] rounded-[3px] mx-auto mt-3" style={{ background: "var(--surface-3)" }} />
            <div className="px-5 pt-3.5 pb-1">
              <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto nx-scroll px-5 pt-2">{children}</div>
          <div className="shrink-0">
            <FooterRow footer={{ onCancel: footer.onCancel, onApply: footer.onApply, applyLabel: "Aceptar" }} />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[998]" onClick={onClose} />
      <div className="fixed z-[999] nx-datesheet-pop" style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: 304 }}>
        <div className="rounded-lg overflow-hidden shadow-nx" style={{ border: "1px solid var(--border)", background: "var(--panel)" }}>
          <div className="p-3.5 pb-2.5">{children}</div>
          <FooterRow footer={footer} />
        </div>
      </div>
    </>,
    document.body
  );
}

/* ── DateField: input con máscara dd/mm/aaaa. Reemplaza <input type="date">
   para no depender del locale del sistema operativo. Valor ISO en/salida. ── */
export function DateField({ value, onChange, className, placeholder = "dd/mm/aaaa" }: {
  value: string; onChange: (iso: string) => void; className?: string; placeholder?: string;
}) {
  const isoToDmy = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return y && m && d ? `${d}/${m}/${y}` : "";
  };
  const [text, setText] = useState(value ? isoToDmy(value) : "");
  useEffect(() => { setText(value ? isoToDmy(value) : ""); }, [value]);

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);
    if (digits.length === 8) {
      const d = digits.slice(0, 2), m = digits.slice(2, 4), y = digits.slice(4, 8);
      const iso = `${y}-${m}-${d}`;
      const dt = new Date(`${iso}T12:00:00`);
      if (!isNaN(dt.getTime()) && dt.getUTCDate() === Number(d) && dt.getUTCMonth() + 1 === Number(m)) {
        onChange(iso);
      }
    } else if (value) {
      onChange("");
    }
  };

  return (
    <input
      className={className ?? "field-input"} placeholder={placeholder} value={text}
      onChange={(e) => handle(e.target.value)} inputMode="numeric" maxLength={10}
    />
  );
}

/* ── DatePicker: día único. Único selector de fecha simple de Nexus —
   Actividades, Solicitudes, Incidencias, Empleados, Proyectos, Días
   inhábiles, Horarios, o cualquier formulario futuro. ── */
export function DatePicker({ value, onChange, placeholder = "dd/mm/aaaa", className, minDate, maxDate, disabled }: {
  value: string; onChange: (iso: string) => void; placeholder?: string; className?: string;
  minDate?: string; maxDate?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const todayIso = todayIsoOf();
  const [pending, setPending] = useState(value || "");
  const [ym, setYm] = useState((value || minDate || todayIso).slice(0, 7));
  const wrapRef = useRef<HTMLDivElement>(null);

  const isBlocked = (date: string) => (!!minDate && date < minDate) || (!!maxDate && date > maxDate);

  const openSheet = () => {
    setPending(value || "");
    setYm((value || minDate || todayIso).slice(0, 7));
    setOpen(true);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <DateField value={value} onChange={onChange} className={className} placeholder={placeholder} />
        <button type="button" disabled={disabled} onClick={openSheet}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-sm transition-colors hover:bg-hover"
          style={{ color: "var(--text-3)" }} aria-label="Abrir calendario">
          <IconCalendar className="w-[15px] h-[15px]" />
        </button>
      </div>
      <DateSheetShell
        open={open} anchorRef={wrapRef} onClose={() => setOpen(false)} title="Seleccionar fecha"
        footer={{
          onCancel: () => setOpen(false),
          onToday: () => { if (!isBlocked(todayIso)) { setPending(todayIso); setYm(todayIso.slice(0, 7)); } },
          onApply: () => { onChange(pending); setOpen(false); },
        }}
      >
        <CalendarGrid
          ym={ym} onYm={setYm} value={pending} isBlocked={isBlocked}
          onPick={(date) => { if (!isBlocked(date)) setPending(date); }}
        />
      </DateSheetShell>
    </div>
  );
}

/* ── DateRangeField: rango con popover/bottom sheet — para formularios
   compactos que necesitan un rango sin ya estar dentro de un Sheet propio
   (ej. "Registrar vacaciones directo" en admin). ── */
export function DateRangeField({
  start, end, onSelect, placeholder = "Selecciona un rango", className, minDate, disabledDates, holidays,
}: {
  start: string | null; end: string | null; onSelect: (start: string | null, end: string | null) => void;
  placeholder?: string; className?: string; minDate?: string;
  disabledDates?: Set<string>; holidays?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const todayIso = todayIsoOf();
  const [pStart, setPStart] = useState<string | null>(start);
  const [pEnd, setPEnd] = useState<string | null>(end);
  const [ym, setYm] = useState((start ?? minDate ?? todayIso).slice(0, 7));
  const wrapRef = useRef<HTMLDivElement>(null);

  const isBlocked = (date: string) => (!!minDate && date < minDate) || !!holidays?.has(date) || !!disabledDates?.has(date);

  const dmy = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
  const label = start && end ? `${dmy(start)} — ${dmy(end)}` : start ? `${dmy(start)} — …` : "";

  const pick = (date: string) => {
    if (isBlocked(date)) return;
    if (!pStart || (pStart && pEnd)) { setPStart(date); setPEnd(null); return; }
    if (date < pStart) { setPStart(date); setPEnd(null); return; }
    setPEnd(date);
  };

  const openSheet = () => {
    setPStart(start); setPEnd(end);
    setYm((start ?? minDate ?? todayIso).slice(0, 7));
    setOpen(true);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button type="button" onClick={openSheet}
        className={className ?? "field-input w-full text-left flex items-center justify-between gap-2"}>
        <span style={{ color: label ? "var(--text-1)" : "var(--text-3)" }}>{label || placeholder}</span>
        <span className="shrink-0" style={{ color: "var(--text-3)" }}><IconCalendar className="w-[15px] h-[15px]" /></span>
      </button>
      <DateSheetShell
        open={open} anchorRef={wrapRef} onClose={() => setOpen(false)} title="Selecciona el rango"
        footer={{
          onCancel: () => setOpen(false),
          onToday: () => { if (!isBlocked(todayIso)) setYm(todayIso.slice(0, 7)); },
          onApply: () => { onSelect(pStart, pEnd); setOpen(false); },
        }}
      >
        <CalendarGrid ym={ym} onYm={setYm} range={{ start: pStart, end: pEnd }} isBlocked={isBlocked} onPick={pick} />
      </DateSheetShell>
    </div>
  );
}

/* ── DateRangeCalendar: mismo CalendarGrid, embebido SIN cáscara de
   popover/bottom-sheet — para cuando el rango ya vive dentro de un Sheet
   propio (Solicitar vacaciones, empleado y admin). Click 1 = inicio,
   click 2 = fin. Marca fines de semana, festivos y fechas ya tomadas. ── */
export function DateRangeCalendar({
  start, end, onSelect, holidays, disabledDates, minDate, legend = true,
}: {
  start: string | null; end: string | null;
  onSelect: (start: string | null, end: string | null) => void;
  holidays?: Set<string>; disabledDates?: Set<string>; minDate?: string; legend?: boolean;
}) {
  const todayIso = todayIsoOf();
  const [ym, setYm] = useState((start ?? todayIso).slice(0, 7));

  const isWeekend = (date: string) => { const dow = new Date(`${date}T12:00:00`).getDay(); return dow === 0 || dow === 6; };
  const isHoliday = (date: string) => holidays?.has(date) ?? false;
  const isTaken = (date: string) => disabledDates?.has(date) ?? false;
  const isPast = (date: string) => (minDate ? date < minDate : false);
  const isBlocked = (date: string) => isWeekend(date) || isHoliday(date) || isTaken(date) || isPast(date);

  const click = (date: string) => {
    if (isBlocked(date)) return;
    if (!start || (start && end)) { onSelect(date, null); return; }
    if (date < start) { onSelect(date, null); return; }
    onSelect(start, date);
  };

  return (
    <div className="rounded-md overflow-hidden p-3.5" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <CalendarGrid ym={ym} onYm={setYm} range={{ start, end }} isBlocked={isBlocked} onPick={click} />
      {legend && (
        <div className="flex flex-wrap items-center gap-3 pt-3 text-[10.5px]" style={{ color: "var(--text-3)" }}>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--accent)" }} /> Seleccionado
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--accent-tint)" }} /> Rango
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--danger-tint)" }} /> Festivo/Fin de semana
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--warn-tint)" }} /> Ya tomado
          </span>
        </div>
      )}
    </div>
  );
}
