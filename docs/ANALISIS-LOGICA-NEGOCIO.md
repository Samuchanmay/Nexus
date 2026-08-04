# Análisis de Lógica de Negocio — EMET

> Fecha: 04 Ago 2026  
> Status: Auditoría completa de módulos Calendario, Eventos, Asistencia

---

## Resumen Ejecutivo

Tu lógica es **correcta en un 90%**. El sistema actual tiene varias de las capacidades que describes, pero implementadas de forma incompleta o con gaps importantes. Este documento detalla qué funciona, qué falta y qué está mal.

---

## 1. Eventos — Estado Actual vs. Lo Que Necesitas

### ✅ Lo que YA existe

| Campo | Status | Tabla |
|-------|--------|-------|
| Nombre del evento | ✅ Existe | `institutional_events.title` |
| Tipo/Categoría | ✅ Existe | `institutional_events.kind` (academico, evento, administrativo, aviso) |
| Fecha inicio/fin | ✅ Existe | `start_date`, `end_date` |
| Notas | ✅ Existe | `notes` |
| Editar eventos | ✅ Existe | CRUD completo en `/admin/calendario` |

### ❌ Lo que FALTA (crítico)

| Campo | Prioridad | Impacto |
|-------|-----------|---------|
| **Hora inicio/fin** | 🔴 Alta | No puedes agendar "Graduación 6pm-1am" |
| **Cliente** | 🔴 Alta | No sabes para quién es el evento |
| **Departamento solicitante** | 🔴 Alta | No puedes reportar "Comunicación: 53 eventos" |
| **Ubicación (interno/externo)** | 🔴 Alta | No puedes validar GPS diferente |
| **Dirección + Google Maps** | 🟡 Media | No puedes guiar al equipo |
| **Responsable principal** | 🔴 Alta | No hay asignación clara |
| **Equipo asignado (participantes)** | 🔴 Alta | No sabes quién debe asistir |
| **Prioridad del evento** | 🟡 Media | No puedes triage |
| **Estado (pendiente/confirmado/cancelado)** | 🟡 Media | No hay workflow |
| **Historial de cambios** | 🟡 Media | No hay auditoría |

### 📊 Estructura actual de `institutional_events`

```sql
create table institutional_events (
  id uuid primary key,
  title text not null,
  kind text not null, -- solo: academico, evento, administrativo, aviso
  start_date date not null, -- SOLO fecha, sin hora
  end_date date not null,
  notes text,
  created_by uuid,
  created_at timestamptz
);
```

**Problema**: Solo 6 campos. Necesitas ~20 campos para cubrir tu caso de uso.

---

## 2. Google Calendar — Estado Actual

### ✅ Lo que YA existe

- **Importación de eventos**: Edge Function `gcal-list-events` lee eventos de un calendario de Google
- **Configuración**: Se guarda el `calendar_id` en `app_settings` con key `gcal_activity_calendar_id`
- **Visualización**: Los eventos de Google aparecen como capa en el calendario

### ❌ Lo que FALTA

| Funcionalidad | Status | Impacto |
|---------------|--------|---------|
| **Sincronización bidireccional** | ❌ No existe | Si editas en Emet, no se refleja en Google |
| **Crear eventos en Google desde Emet** | ❌ No existe | Solo lectura |
| **Eliminar eventos en Google desde Emet** | ❌ No existe | Solo lectura |
| **Switch por evento** | ❌ No existe | No puedes elegir sincronizar evento por evento |
| **Webhooks/Push notifications** | ❌ No existe | No hay actualización en tiempo real |

### 🐛 Bug Reportado: "No aparecen eventos de Google"

**Causa probable**: 
1. El `gcal_activity_calendar_id` no está configurado en `/admin/config`
2. El calendario de Google no es público o no tiene permisos correctos
3. La Edge Function `gcal-list-events` está fallando silenciosamente

**Cómo verificar**:
```sql
SELECT value FROM app_settings WHERE key = 'gcal_activity_calendar_id';
```

Si está vacío → no hay calendario configurado → no hay eventos.

---

## 3. Eventos Nocturnos / Externos — Estado Actual

### ❌ No existe ningún concepto de "evento externo"

**Lo que necesitas**:
- Evento con ubicación externa (Hotel Fiesta Americana)
- GPS validado en radio de 150m alrededor del hotel (no de la oficina)
- Check-in específico: "Iniciar cobertura" / "Finalizar cobertura"
- Asistencia vinculada al evento, no a la oficina

**Lo que hay ahora**:
- GPS solo valida contra zona de oficina (`gps_zones`)
- No hay concepto de "cobertura de evento"
- No hay check-in/out de evento

---

## 4. Asistencia — Estado Actual

### ✅ Lo que YA funciona correctamente

**Prioridad de estados** (ya está bien implementada en `status.ts`):

```
1. no_registro_salida (100) — CRÍTICO
2. pendiente_confirmar_salida (99)
3. trabajando/pausa (98) — jornada activa
4. vacaciones (90)
5. incapacidad (85)
6. permiso (80)
7. comision (75)
8. home_office (70)
9. falta_justificada (65)
10. dia_inhabil (60)
11. descanso (55)
12. jornada_terminada (50)
13. falta_injustificada (10)
14. fuera_horario (5)
15. sin_iniciar (0)
```

**Tu lógica de prioridad es CORRECTA**:
```
Vacaciones → Permiso → Incapacidad → Día inhábil → Evento externo → Home Office → Oficina → Ausencia
```

El sistema actual ya sigue este orden. Si alguien tiene vacaciones, NO marca falta injustificada.

### ❌ Lo que FALTA

| Funcionalidad | Status | Impacto |
|---------------|--------|---------|
| **Check-in en evento externo** | ❌ No existe | No puedes fichar en "Hotel Fiesta" |
| **Asistencia vinculada a evento** | ❌ No existe | No hay relación events ↔ attendance |
| **GPS dinámico por evento** | ❌ No existe | GPS solo valida oficina |
| **Asistencia manual por admin** | ✅ Ya existe | Botón "Corregir" en `/admin/asistencia` |
| **Historial de correcciones** | ✅ Ya existe | Tabla `attendance_corrections` (migración 0027) |
| **Permitir check-in sin GPS** | ❌ No existe | No hay switch "allow_any_location" |

---

## 5. Vacaciones/Permisos — Estado Actual

### ✅ Lo que YA funciona

- Si tienes vacaciones aprobadas → NO marca falta
- Si tienes incidencia autorizada → NO marca falta
- Si es día inhábil → NO marca falta
- Si es día de descanso → NO marca falta

**El resolver ya revisa en este orden**:
```typescript
if (input.vacation) return "vacaciones";
if (input.incident) return incident.kind; // permiso, incapacidad, etc.
if (input.isHoliday) return "dia_inhabil";
if (input.restDay) return "descanso";
// Solo si nada de lo anterior aplica → busca fichajes
```

### ❌ Lo que FALTA

| Funcionalidad | Status |
|---------------|--------|
| **Vincular vacaciones a evento** | ❌ No aplica (son conceptos separados) |
| **Notificar al equipo sobre vacaciones** | ❌ No existe |
| **Calendario de disponibilidad** | ❌ No existe |

---

## 6. Participantes en Eventos — Estado Actual

### ❌ No existe

**Lo que necesitas**:
- Responsable principal (1 persona)
- Equipo asignado (N personas)
- Cada participante recibe notificación
- Cada participante hace su propio check-in

**Lo que hay ahora**:
- Solo `created_by` (quién creó el evento)
- No hay tabla `event_participants`
- No hay notificaciones por evento

---

## 7. Reportes — Estado Actual

### ✅ Lo que YA existe

- Reporte semanal Excel con motivo de ausencia
- CSV del día
- Motivos: Vacaciones, Incapacidad, Permiso, Comisión, etc.

### ❌ Lo que FALTA

| Funcionalidad | Status |
|---------------|--------|
| **Reporte por departamento solicitante** | ❌ No existe |
| **Reporte por cliente** | ❌ No existe |
| **Reporte de horas por evento** | ❌ No existe |
| **Dashboard de eventos por categoría** | ❌ No existe |

---

## 8. Otros Problemas Detectados

### 🐛 Bug: Edición de horarios solo muestra hoy

**Status**: ✅ Ya corregido en commit `c06104a`

Ahora puedes seleccionar cualquier fecha con el selector de fecha en `/admin/asistencia`.

### 🐛 Bug: Formato de fechas

**Status**: ✅ Ya corregido en commit `c06104a`

Ahora todas las fechas muestran `dd/mm/aaaa` (año completo).

### ⚠️ Problema: No hay validación de conflictos

Si asignas a Samuel a 2 eventos al mismo tiempo, no hay alerta.

### ⚠️ Problema: No hay plantilla de eventos

Cada evento se crea desde cero. No hay "Duplicar evento" o "Plantilla de graduación".

### ⚠️ Problema: No hay recurrencia

No puedes crear "Junta semanal cada lunes" fácilmente.

---

## 9. Recomendaciones Priorizadas

### 🔴 CRÍTICO (hacer primero)

1. **Ampliar tabla `institutional_events`** con:
   - `start_time`, `end_time` (hora)
   - `client_id` (cliente)
   - `department_id` (departamento solicitante)
   - `location_type` (interno/externo)
   - `location_name`, `location_address`, `location_coords`
   - `owner_id` (responsable principal)
   - `status` (pendiente/confirmado/cancelado)
   - `priority` (alta/media/baja)

2. **Crear tabla `event_participants`**:
   ```sql
   create table event_participants (
     id uuid primary key,
     event_id uuid references institutional_events(id),
     user_id uuid references users(id),
     role text, -- "responsable" | "participante"
     status text, -- "pendiente" | "confirmado" | "cancelado"
     check_in_at timestamptz,
     check_out_at timestamptz
   );
   ```

3. **Crear tabla `event_attendance`** (vincular eventos con asistencia):
   ```sql
   create table event_attendance (
     id uuid primary key,
     event_id uuid references institutional_events(id),
     user_id uuid references users(id),
     check_in_at timestamptz,
     check_out_at timestamptz,
     location_type text, -- "oficina" | "evento" | "remoto"
     gps_coords point,
     notes text
   );
   ```

### 🟡 IMPORTANTE (hacer después)

4. **Sincronización bidireccional con Google Calendar**:
   - Edge Function `gcal-sync` que escuche webhooks
   - Cuando creas/editas/eliminas en Emet → actualiza Google
   - Cuando creas/editas/eliminas en Google → actualiza Emet

5. **GPS dinámico por evento**:
   - Si evento es externo → validar GPS contra `location_coords` del evento
   - Radio configurable (150m por defecto)

6. **Check-in de evento**:
   - Botón "Iniciar cobertura" / "Finalizar cobertura"
   - Vincula check-in/out al evento, no a la oficina

### 🟢 NICE-TO-HAVE (hacer al final)

7. **Plantillas de eventos**
8. **Recurrencia (semanal, mensual, etc.)**
9. **Dashboard de eventos por departamento**
10. **Notificaciones push por evento**

---

## 10. Plan de Implementación Sugerido

### Fase 1: Ampliar eventos (1-2 semanas)
- Migración SQL para nuevos campos
- Actualizar UI de creación/edición
- Agregar participantes

### Fase 2: Asistencia en eventos (1 semana)
- Tabla `event_attendance`
- Check-in/out de evento
- GPS dinámico

### Fase 3: Google Calendar bidireccional (1 semana)
- Edge Function `gcal-sync`
- Webhooks
- Switch por evento

### Fase 4: Reportes avanzados (1 semana)
- Reporte por departamento
- Reporte por cliente
- Dashboard de eventos

---

## 11. Conclusión

**Tu lógica es correcta**. El sistema actual tiene la base, pero le faltan piezas críticas para cubrir el caso de uso de eventos externos con asistencia.

**Lo más urgente**:
1. Ampliar la tabla de eventos (agregar hora, cliente, departamento, ubicación, participantes)
2. Crear la relación eventos ↔ asistencia
3. Implementar check-in en eventos externos

**Lo que ya funciona bien**:
- Prioridad de estados de asistencia
- Vacaciones/permisos no generan falta
- Edición de horarios por admin
- Formato de fechas dd/mm/aaaa

---

## Archivos de Referencia

- `src/lib/domain/attendance/status.ts` — Resolver de estados (prioridades correctas)
- `supabase/migrations/0008_institutional_events.sql` — Estructura actual de eventos
- `src/app/admin/calendario/client.tsx` — UI de calendario
- `src/app/admin/asistencia/client.tsx` — UI de asistencia
- `docs/PENDIENTE-REALTIME-CHAT.md` — Estado de migraciones pendientes

---

**¿Quieres que implemente la Fase 1 (ampliar eventos + participantes)?**
