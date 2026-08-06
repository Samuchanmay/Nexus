-- ═══════════════════════════════════════════════════════════════════
--  Vincular una Actividad (projects) a un Evento institucional
--  (institutional_events) — a pedido del usuario: quiere poder editar
--  el evento y los asignados de una actividad directamente desde
--  /admin/proyectos, sin tener que ir a /admin/calendario.
--  ═══════════════════════════════════════════════════════════════════
--  OJO: projects YA tenía calendar_event_id/calendar_id, pero esas dos
--  columnas son para la sincronización con GOOGLE CALENDAR (guardan el
--  id del evento en la cuenta de Google del admin) — no tienen relación
--  con institutional_events (la tabla propia de EMET para eventos del
--  Calendario de Equipo). Son cosas distintas, por eso esta es una
--  columna nueva, no una reutilización de las existentes.
--  Aditivo e idempotente. Depende de: projects (existente),
--  institutional_events (existente, migración 0008).
-- ═══════════════════════════════════════════════════════════════════

alter table public.projects
  add column if not exists institutional_event_id uuid references public.institutional_events(id) on delete set null;

comment on column public.projects.institutional_event_id is
  'Evento institucional (calendario de equipo) vinculado a esta actividad — editable desde /admin/proyectos. NO confundir con calendar_event_id/calendar_id (esos son de la sincronización con Google Calendar).';
