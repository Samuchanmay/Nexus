# Migraciones pendientes para Supabase (emet.uno)

> **Estado**: 2026-08-05 — faltan por aplicar las migraciones **0025 a 0035** (aún NO están en la base de nube).
>
> **⚠️ URGENTE — 0035**: `docs/MIGRACIONES-APLICAR-0035-ATTENDANCE-RLS.sql` desbloquea la corrección de
> asistencia (hoy falla con "No se pudo guardar la corrección"). Se puede aplicar **solo**; el resto (0025→0034)
> sigue en el script combinado.
>
> **Instrucciones**: Abre el **SQL Editor** del proyecto `emet.uno`, copia TODO el contenido de
> [`docs/MIGRACIONES-APLICAR-0025-0034.sql`](./MIGRACIONES-APLICAR-0025-0034.sql) y ejecuta en una sola
> pasada. Los bloques van en orden (0025 → 0034) y son aditivos/idempotentes. Luego ejecuta por separado
> [`docs/MIGRACIONES-APLICAR-0035-ATTENDANCE-RLS.sql`](./MIGRACIONES-APLICAR-0035-ATTENDANCE-RLS.sql).

---

## Qué aplica cada bloque

| Migración | Archivo | Qué hace |
|---|---|---|
| 0025 | `0025_chat_mute_duration_read_at.sql` | Silencio por duración (`muted_until`) + hora de lectura (`read_at`) + RPCs `nx_enlace_set_mute` / `nx_enlace_unmute` / `nx_enlace_mark_read` |
| 0026 | `0026_chat_realtime_publication_fix.sql` | Añade `conversation_participants` y `push_subscriptions` a `supabase_realtime` + `REPLICA IDENTITY FULL` en las tablas del chat (mensajes en vivo, ticks de lectura) |
| 0027 | `0027_attendance_corrections_history.sql` | Tabla `attendance_corrections` (historial de correcciones de asistencia por admin) |
| 0028 | `0028_events_extended.sql` | Eventos ampliados: hora inicio/fin, cliente, departamento, ubicación + GPS, responsable, estado, prioridad |
| 0029 | `0029_event_participants_attendance.sql` | `event_participants`, `event_attendance`, `event_history` + funciones de participación/asistencia |
| 0030 | `0030_event_checkin_gps.sql` | `event_check_in` / `event_check_out` con validación GPS y duración automática + `get_event_coverage_status` / `get_event_coverage_summary` |
| 0031 | `0031_google_calendar_sync.sql` | Campos de sync en `institutional_events`, `event_google_mapping`, `google_calendar_webhooks` |
| 0032 | `0032_event_checkin_ownership_guard.sql` | Guard de seguridad: check-in/out solo del propio usuario o admin (`p_user_id = auth.uid()`) |
| 0033 | `0033_chat_push_subscriptions.sql` | Tabla `push_subscriptions` (Web Push con la app cerrada) — ya la consumía `send-chat-push` |
| 0034 | `0034_phone_self_editable.sql` | `phone` editable por el propio empleado (se quita de columnas protegidas del trigger de perfil) |
| 0035 | `0035_attendance_admin_write_rls.sql` | **Corrección de asistencia**: políticas RLS para que admin/RH hagan UPDATE e INSERT de `attendance` de cualquier persona (hoy todo escrito por admin es rechazado → "No se pudo guardar la corrección") |

> Cada archivo individual está en `supabase/migrations/`. El script combinado se genera con:
> `Get-Content supabase/migrations/00{25..34}_*.sql | ...` (o se regenera desde los 10 archivos si cambian).
> El bloque 0035 se aplica por separado (urgente).

---

## Verificación post-aplicación

1. **Chat en vivo**: enviar un mensaje entre dos cuentas → debe aparecer sin recargar. Ticks ✓✓→leído en dos pestañas.
2. **Silencio por duración**: silenciar 8h → mostrar "Silenciado hasta HH:MM".
3. **Asistencia (0035)**: el admin edita entrada/salida de un día pasado → se guarda SIN error y queda registro en `attendance_corrections`.
4. **Eventos**: crear un evento externo con ubicación → aparece con hora, cliente y departamento; añadir participante y hacer check-in desde su cuenta con GPS.
5. **Teléfono**: un empleado (no admin) edita su `phone` desde su perfil → se guarda sin error.

---

## Edge Functions de la Fase 3 (Google Calendar) — pendientes de desplegar

No son SQL: viven en `supabase/functions/`. Si aún no están en la nube, desplegar con:

```bash
supabase functions deploy gcal-sync-event
supabase functions deploy gcal-webhook
supabase functions deploy gcal-register-webhook
supabase functions deploy gcal-unregister-webhook
supabase functions deploy gcal-create-event
supabase functions deploy gcal-delete-event
supabase functions deploy gcal-list-events
```

## Archivos de referencia

- `docs/MIGRACIONES-APLICAR-0025-0034.sql` — script único para pegar en el SQL Editor
- `docs/MIGRACIONES-APLICAR-0035-ATTENDANCE-RLS.sql` — migración urgente 0035 (corrección de asistencia), para aplicar aparte
- `supabase/migrations/0025..0035_*.sql` — versiones individuales
- `docs/PENDIENTE-REALTIME-CHAT.md` — diagnóstico del realtime del chat
