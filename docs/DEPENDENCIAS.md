# Mapa de Dependencias — EMET

> Qué módulos afectan otros módulos cuando se modifican.  
> Última actualización: 04 Ago 2026

---

## Asistencia

Cuando modificas **Asistencia**, revisa:

```
Asistencia
  ↓
Calendario (heatmap de asistencia)
  ↓
Reportes (semanal, Excel)
  ↓
Directorio/Equipo (estado del empleado)
  ↓
Hoy/Mi día (estado personal)
  ↓
Notificaciones (recordatorios de fichaje)
  ↓
Eventos (check-in en eventos externos)
```

**Archivos afectados**:
- `src/app/admin/asistencia/client.tsx`
- `src/app/admin/asistencia/page.tsx`
- `src/lib/domain/attendance/status.ts`
- `src/lib/hours.ts`
- `supabase/migrations/*` (tablas: attendance, attendance_corrections)

---

## Eventos

Cuando modificas **Eventos**, revisa:

```
Eventos
  ↓
Calendario (vista de eventos)
  ↓
Asistencia (check-in en eventos)
  ↓
Notificaciones (asignación de participantes)
  ↓
Chat (grupo del evento)
  ↓
Google Calendar (sincronización)
  ↓
Reportes (horas por evento)
  ↓
GPS (validación en ubicación del evento)
```

**Archivos afectados**:
- `src/app/admin/calendario/client.tsx`
- `src/app/admin/calendario/page.tsx`
- `supabase/migrations/*` (tablas: institutional_events, event_participants, event_attendance)
- `supabase/functions/gcal-*` (Edge Functions)

---

## Chat

Cuando modificas **Chat**, revisa:

```
Chat
  ↓
Notificaciones (push de mensajes)
  ↓
Usuarios (lista de participantes)
  ↓
Eventos (grupo del evento)
  ↓
Realtime (Supabase Realtime)
  ↓
Storage (imágenes, audios, videos)
```

**Archivos afectados**:
- `src/app/chat/client.tsx`
- `src/app/chat/[id]/client.tsx`
- `src/lib/chat/use-outbox.ts`
- `src/lib/chat/use-typing.ts`
- `src/lib/chat/use-unread-count.ts`
- `supabase/migrations/*` (tablas: conversations, messages, message_attachments)

---

## Usuarios

Cuando modificas **Usuarios**, revisa:

```
Usuarios
  ↓
Chat (participantes de conversaciones)
  ↓
Asistencia (historial del empleado)
  ↓
Eventos (responsable/participantes)
  ↓
Proyectos (asignaciones)
  ↓
Calendario (vacaciones, disponibilidad)
  ↓
Reportes (datos del empleado)
```

**Archivos afectados**:
- `src/app/admin/empleados/client.tsx`
- `src/lib/types.ts` (UserProfile)
- `supabase/migrations/*` (tabla: users)

---

## Vacaciones

Cuando modificas **Vacaciones**, revisa:

```
Vacaciones
  ↓
Asistencia (no genera falta)
  ↓
Calendario (vista de vacaciones)
  ↓
Reportes (días de vacaciones)
  ↓
Notificaciones (aprobación/rechazo)
```

**Archivos afectados**:
- `src/app/admin/vacaciones/client.tsx`
- `src/lib/domain/attendance/status.ts` (prioridad de vacaciones)
- `supabase/migrations/*` (tabla: vacations)

---

## Google Calendar

Cuando modificas **Google Calendar**, revisa:

```
Google Calendar
  ↓
Calendario (eventos de Google)
  ↓
Eventos (sincronización bidireccional)
  ↓
Notificaciones (recordatorios)
```

**Archivos afectados**:
- `supabase/functions/gcal-list-events/index.ts`
- `supabase/functions/gcal-sync/index.ts` (pendiente)
- `src/app/admin/calendario/page.tsx`
- `src/lib/gcal.ts`

---

## GPS

Cuando modificas **GPS**, revisa:

```
GPS
  ↓
Asistencia (validación de ubicación)
  ↓
Eventos (validación en ubicación del evento)
  ↓
Configuración (zonas GPS)
```

**Archivos afectados**:
- `src/app/admin/config/gps/client.tsx`
- `src/app/fichar/client.tsx`
- `supabase/migrations/*` (tabla: gps_zones)

---

## Notificaciones

Cuando modificas **Notificaciones**, revisa:

```
Notificaciones
  ↓
Chat (push de mensajes)
  ↓
Eventos (asignación de participantes)
  ↓
Vacaciones (aprobación/rechazo)
  ↓
Asistencia (recordatorios)
```

**Archivos afectados**:
- `src/lib/use-push-notifications.ts`
- `supabase/functions/send-chat-push/index.ts`
- `supabase/migrations/*` (tabla: push_subscriptions)

---

## Proyectos

Cuando modificas **Proyectos**, revisa:

```
Proyectos
  ↓
Calendario (deadlines)
  ↓
Actividades (tareas del proyecto)
  ↓
Usuarios (asignaciones)
  ↓
Reportes (horas por proyecto)
```

**Archivos afectados**:
- `src/app/admin/proyectos/client.tsx`
- `src/app/admin/actividades/client.tsx`
- `supabase/migrations/*` (tablas: projects, project_assignments)

---

## Reportes

Cuando modificas **Reportes**, revisa:

```
Reportes
  ↓
Asistencia (datos de asistencia)
  ↓
Eventos (horas por evento)
  ↓
Proyectos (horas por proyecto)
  ↓
Vacaciones (días de vacaciones)
  ↓
Usuarios (datos del empleado)
```

**Archivos afectados**:
- `src/app/admin/reportes/client.tsx`
- `src/app/admin/asistencia/xlsx-weekly-report.tsx`
- `supabase/functions/weekly-attendance-report/index.ts`

---

## Matriz de Impacto

| Módulo | Afecta | Prioridad de revisión |
|--------|--------|----------------------|
| Asistencia | Calendario, Reportes, Directorio, Eventos | 🔴 Alta |
| Eventos | Calendario, Asistencia, Notificaciones, GPS | 🔴 Alta |
| Chat | Notificaciones, Usuarios, Realtime | 🟡 Media |
| Usuarios | Chat, Asistencia, Eventos, Proyectos | 🔴 Alta |
| Vacaciones | Asistencia, Calendario, Reportes | 🟡 Media |
| Google Calendar | Calendario, Eventos | 🟡 Media |
| GPS | Asistencia, Eventos | 🟡 Media |
| Notificaciones | Chat, Eventos, Vacaciones, Asistencia | 🟡 Media |
| Proyectos | Calendario, Actividades, Usuarios | 🟢 Baja |
| Reportes | Asistencia, Eventos, Proyectos, Vacaciones | 🟢 Baja |

---

## Checklist de Auditoría Cruzada

Cuando modifiques un módulo, revisa:

- [ ] ¿Afecta otros módulos? (ver mapa arriba)
- [ ] ¿Hay dependencias circulares?
- [ ] ¿Los datos se sincronizan correctamente?
- [ ] ¿Las notificaciones llegan a los módulos afectados?
- [ ] ¿Los reportes muestran los datos correctos?
- [ ] ¿El calendario refleja los cambios?
- [ ] ¿Los permisos son consistentes?
