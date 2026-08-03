"use client";
/* ═══════════════════════════════════════════════════════════════
   BRIDGE DE COMPATIBILIDAD — components/scheduling es ahora la fuente
   única de los pickers de fecha (EMET Scheduling System). Este archivo
   conserva la firma pública histórica para que los ~20 call sites
   existentes (vía barrel components/ui.tsx) sigan funcionando sin
   cambios: DateField, DatePicker, DateRangeField y DateRangeCalendar
   tienen exactamente la misma API que antes.

   Lo que cambió de lenguaje (ver components/scheduling/date-picker.tsx):
   - Shell siempre centrado, radio 24px, padding 28-32px.
   - Mes+año 24px semibold, flechas de 36px, días de 44px.
   - Selección sólida --accent, hoy con punto, rango tipo Cal.com.
   - Se eliminó el modo "bottom sheet" móvil con grab-handle.
   ═══════════════════════════════════════════════════════════════ */
export { DateField, DatePicker, DateRangeField, DateRangeCalendar } from "./scheduling/date-picker";
