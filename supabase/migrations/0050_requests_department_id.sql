-- ═══════════════════════════════════════════════════════════════════
--  0050 — requests.department_id (Rediseño del módulo Reportes)
--  ═══════════════════════════════════════════════════════════════════
--  Contexto: el nuevo Reporte 3 ("Pendientes por coordinación") necesita
--  agrupar solicitudes/actividades por coordinación/departamento de forma
--  confiable. Hoy solo existe `requests.requester_area`, un TEXTO LIBRE
--  guardado como snapshot al momento de crear la solicitud (ver
--  coordinador/client.tsx: `areaLabel = profile.departments?.nombre ??
--  profile.area`) — sin llave real a `departments`, así que agrupar por
--  ese texto es frágil (mayúsculas, acentos, nombres que cambiaron desde
--  entonces no calzarían).
--
--  Esta migración agrega una FK real, sin tocar `requester_area` (queda
--  como está, es el snapshot histórico legible). El backfill es
--  best-effort: empareja por nombre exacto (case-insensitive, trim) contra
--  `departments.nombre` — las filas que no calcen quedan con
--  department_id NULL (se excluyen del reporte, no se inventa un valor).
-- ═══════════════════════════════════════════════════════════════════

alter table public.requests
  add column if not exists department_id uuid references public.departments(id);

comment on column public.requests.department_id is
  'FK real a departments — usada por el Reporte "Pendientes por coordinación" (motor de reportes). requester_area sigue siendo el snapshot de texto histórico; no se reemplaza.';

-- Backfill best-effort de filas existentes.
update public.requests r
set department_id = d.id
from public.departments d
where r.department_id is null
  and r.requester_area is not null
  and lower(trim(r.requester_area)) = lower(trim(d.nombre));

create index if not exists idx_requests_department_id on public.requests(department_id);
