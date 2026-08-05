# Handoff · Pendientes para Claude (2026-08-05)

> Documento de transferencia: **todo lo que está pendiente de aplicar y no se ha
> podido hacer en esta sesión**. El código del repo está terminado y compila
> (`next build` limpio, 57 páginas); lo que falta es **subir el código**,
> **aplicar SQL en la nube** y **desplegar/configurar servicios**.

---

## 1. Push pendiente (código sin commitear)

La sesión terminó **sin commit ni push**. Hay **9 archivos modificados** en `main`
que hay que revisar, commitear y pushear:

```
M src/app/admin/asistencia/client.tsx          (fix bug segmented "Semana")
M src/app/admin/config/colores/client.tsx      (swatch selección: anillo --accent + check)
M src/app/admin/dias-inhabiles/client.tsx      (KPIs .card compactos + vista Año celda coloreada)
M src/app/admin/reportes/loading.tsx           (skeleton .card)
M src/app/admin/reportes/page.tsx              (rediseño tarjetas + CsvLink)
M src/app/admin/solicitudes/client.tsx         (pestañas → SlidingSegments con badge)
M src/app/admin/vacaciones/client.tsx          (quitar heatmap 60d, filas → tarjetas)
M src/app/globals.css                          (token único --primary, .btn-primary plano, chat-ws)
M src/components/ui.tsx                        (SlidingSegments: prop badge + fallback)
```

Todo corresponde a la pasada de unificación visual (sprint UI/UX) + fix del picker
de colores. Mensaje de commit sugerido (estilo repo):
`feat: pasada de unificación visual (tokens --primary, reportes, vacaciones, dias-inhabiles, solicitudes, colores)`.

---

## 2. Migraciones SQL en Supabase (emet.uno) — lo más importante

La nube **no se sincroniza sola** con `supabase/migrations/`; se aplica a mano en
el **SQL Editor** del proyecto.

### Orden obligatorio

1. **Primero** aplicar TODO el script combinado:
   `docs/MIGRACIONES-APLICAR-0025-0034.sql`
   (pegar todo en el SQL Editor y ejecutar en una sola pasada; bloques 0025→0034,
   aditivos/idempotentes).
2. **Después** aplicar por separado:
   `docs/MIGRACIONES-APLICAR-0035-ATTENDANCE-RLS.sql`

### ⚠️ Dependencia crítica (verificar antes de dar por cerrada la 0035)

`src/components/os/edit-attendance-sheet.tsx:129-136` hace `await` en un INSERT a
**`attendance_corrections`**. Si esa tabla (migración 0027) no existe aún en la
nube, la 0035 **sola no basta**: el guardado de asistencia seguiría fallando.

Antes y después de aplicar, Claude debe correr en el SQL Editor:

```sql
-- ¿Existe la tabla del historial de correcciones (0027)?
select exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'attendance_corrections');

-- Verificar el fix 0035 (políticas de escritura de admin/rh en attendance)
select polname, polcmd from pg_policy
where polrelid = 'public.attendance'::regclass order by polname;

-- Diagnóstico realtime (tablas publicadas)
select p.tablename from pg_publication_tables p
where p.pubname = 'supabase_realtime' order by p.tablename;
```

### Qué aplica cada bloque (resumen)

| Mig | Archivo | Qué hace |
|---|---|---|
| 0025 | chat mute por duración (`muted_until`) + `read_at` + RPCs set/unset/mark_read |
| 0026 | `conversation_participants` y `push_subscriptions` a la publicación realtime + `REPLICA IDENTITY FULL` en las 5 tablas del chat |
| 0027 | tabla `attendance_corrections` (historial de correcciones de asistencia) |
| 0028 | eventos ampliados (hora, cliente, departamento, ubicación+GPS, responsable, estado, prioridad) |
| 0029 | `event_participants`, `event_attendance`, `event_history` + funciones |
| 0030 | `event_check_in`/`event_check_out` con validación GPS + coverage status |
| 0031 | sync Google Calendar (campos + `event_google_mapping` + webhooks) |
| 0032 | guard de ownership en check-in/out (solo propio usuario o admin) |
| 0033 | tabla `push_subscriptions` (Web Push app cerrada) |
| 0034 | `phone` editable por el propio empleado |
| 0035 | RLS: admin/RH hacen UPDATE e INSERT de `attendance` de cualquiera (fix "No se pudo guardar la corrección") |

---

## 3. Edge Functions pendientes de desplegar (Fase 3 · Google Calendar)

Si aún no están en la nube, desplegar:

```bash
supabase functions deploy gcal-sync-event
supabase functions deploy gcal-webhook
supabase functions deploy gcal-register-webhook
supabase functions deploy gcal-unregister-webhook
supabase functions deploy gcal-create-event
supabase functions deploy gcal-delete-event
supabase functions deploy gcal-list-events
```

---

## 4. Secrets del Web Push (VAPID) — manual en el dashboard

`send-chat-push` está redesplegado (v2), pero **sin los secrets responde 500
"VAPID no configurado"**. Pegar en Project Settings → Edge Functions →
`send-chat-push` → Secrets:

```
VAPID_PUBLIC_KEY  = BCBYW7jMiV4B0oCdSDyiC2wUuXMlXA4ecKt4jNpjEs8zohScS3glxfmYxr3UkS1SyEBOSmk-OIbonYBcP1RLWIA
VAPID_PRIVATE_KEY = MDXX8BSzXWr4CMMcMmenB09cx60rL5cgaarnlNAuinU
VAPID_SUBJECT     = mailto:macgenio55@gmail.com
```

Sin deploy extra: en cuanto se guarden, el push funciona.

---

## 5. Verificación manual pendiente (dos cuentas reales)

Confirmaciones que nadie pudo probar en sesión (requieren 2 sesiones):

- **Realtime chat**: mensaje entre dos cuentas aparece sin recargar; ticks
  ✓✓→leído y no-leídos se actualizan en vivo (el fix 0026 ya está en la nube,
  falta confirmación manual).
- **Silencio por duración** (0025): silenciar 8h → mostrar "Silenciado hasta HH:MM".
- **Asistencia** (0035): admin edita entrada/salida de un día pasado → guarda SIN
  error y queda registro en `attendance_corrections` (requiere 0027, ver §2).
- **Eventos** (0028-0032): crear evento externo con ubicación; check-in de un
  participante con GPS.
- **Teléfono** (0034): un empleado no-admin edita su `phone` → guarda sin error.
- **Web Push** (0033 + §4): cerrar la app, enviar mensaje desde otra cuenta →
  llega notificación del sistema.

---

## 6. Otros pendientes de producto (para contexto, sin urgencia)

- `docs/DECISIONES-PENDIENTES.md` — decisiones abiertas (P-001..P-009): LLM en
  EMU, reorganización de menú, multi-tenant, framework de tests, renombre
  `nexus_*`, sender de correos, RPCs de conversación (silenciar por duración,
  vaciar/eliminar), emoji Apple en Windows.
- `docs/PENDIENTE-REALTIME-CHAT.md` — estado completo del chat (realtime + push).

---

## Archivos de referencia

- `docs/MIGRACIONES-APLICAR-0025-0034.sql` — script único 0025→0034 (pegar primero)
- `docs/MIGRACIONES-APLICAR-0035-ATTENDANCE-RLS.sql` — 0035 urgente (aplicar después)
- `docs/MIGRACIONES-PENDIENTES-SUPABASE.md` — resumen oficial de migraciones
- `supabase/migrations/00{25..35}_*.sql` — versiones individuales
- `docs/audits/attendance-correction-save.md` — diagnóstico del bug de asistencia
- `src/components/os/edit-attendance-sheet.tsx:129-136` — INSERT a `attendance_corrections`
