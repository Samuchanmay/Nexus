/* ── Calendar Engine · barrel (EMET-CALENDAR-ENGINE.md) ──
   Punto de entrada único: tipos, provider, header y vistas. Las páginas
   importan SOLO desde aquí, nunca rutas internas. */

export {
  CalendarEngine, useCalendarEngine, CALENDAR_VIEWS,
} from "./engine";
export { CalendarHeader } from "./header";
export { MonthView } from "./month";
export { DayView } from "./day";
export { WeekView } from "./week";
export { AgendaView } from "./agenda";
export { YearView } from "./year";
export { DayPopover } from "./event-popover";
export { CalendarLegend } from "./legend";
export { MiniCalendar } from "./mini-calendar";
export { CalendarDatePicker } from "./date-picker";
export { CalendarRightPanel } from "./right-panel";
export { CalendarFilterBar } from "./filter-bar";
export type {
  CalendarView, CalendarEvent, CalendarEventKind, CalendarLayer,
} from "./types";
export { EVENT_COLOR, eventColor, KIND_LABEL, eventLabel, eventOnDate } from "./types";
