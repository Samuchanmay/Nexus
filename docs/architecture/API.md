# Emet · API

Emet no expone una API REST pública de propósito general: la mayor parte del acceso a datos ocurre **directo a Supabase** (client en el navegador con RLS, o client de servidor). La "API" se compone de: (1) rutas `app/api/*` de Next.js y (2) Edge Functions de Supabase.

## 1. Rutas `app/api/*` (Next.js)

| Ruta | Método | Propósito |
|---|---|---|
| `/api/auth/callback` | GET | Callback de OAuth Google (`auth/callback`) |
| `/api/push/subscribe` | POST | Guardar suscripción Web Push (`push_subscriptions`) |
| `/api/mfa/recover` | POST | Recuperación de MFA |
| `/api/proxy` | — | Proxy para assets/URLs externas sin exponer credenciales |
| `/api/demos/list` | GET | Listar recorridos publicados para el player |
| `/api/demos/status` | GET | Estado de recorridos (visto/pendiente) |
| `/api/demos/view` | POST | Marcar recorrido como visto |
| `/api/demos/ingest` | POST | Crear/actualizar recorrido desde el editor `/preptour` |

## 2. Edge Functions (Supabase, `supabase/functions/*`)

Todas en Deno. `ALLOWED_ORIGINS` controla CORS; muchas se despliegan con `--no-verify-jwt` porque las invoca `pg_cron` o requieren service role internamente.

| Función | Propósito |
|---|---|
| `fichar` | Checada entrada/salida: valida hora, tolerancia, geocerca (`NEXT_PUBLIC_OFICINA_LAT/LNG/RADIO_MAX_M`) e inserta en `attendance` |
| `send-chat-push` | Envía Web Push al destinatario cuando un mensaje llega y no está activo |
| `notify-vacation` | Correo (Resend) al aprobar/crear vacaciones; crea evento en Google Calendar; usa `calendar_event_id` |
| `weekly-attendance-report` | Resumen semanal por persona → correo a RRHH; invocable manualmente (admin/asistencia) o vía `pg_cron` |
| `gcal-list-events` | Lee eventos de un Google Calendar privado (OAuth por usuario) para el calendario del equipo |
| `gcal-create-event` | Crea evento en Google Calendar (allDay u hora local `America/Merida`) |
| `gcal-delete-event` | Elimina evento del calendario externo |
| `drive-upload` | Sube archivo a Google Drive (multipart, límite 8MB) para evidencias |
| `proxy-asset` | Proxy de assets (imágenes del bucket privado con URL firmada) |
| `demos-ingest` | Guarda/actualiza recorrido guiado desde el editor |
| `demos-list` | Recorridos publicados para el rol actual |
| `demos-public` | Recorridos públicos (vista sin sesión, p. ej. preview) |

## 3. Supabase directo (client)

El navegador habla con Supabase mediante el client con RLS (`src/lib/supabase/client.ts`); el servidor usa `src/lib/supabase/server.ts` (cookies). El service role (`admin.ts`) **solo** se usa en Edge Functions y rutas sensibles del servidor.

Reglas:
- Nunca filtrar datos sensibles en el cliente sin RLS detrás.
- Las escrituras que requieren invariantes de negocio (saldo de vacaciones, un-activo-por-tarea, horas mínimas) se hacen por **función/trigger**, no por insert directo.
- El chat usa RPC (`nx_enlace_*`) para mutaciones que deben ser atómicas y seguras.

## 4. Terceros

| Servicio | Uso | Secreto |
|---|---|---|
| Resend | Correo vacaciones + reporte semanal | `RESEND_API_KEY` |
| Google Calendar API | Eventos institucionales (CERT) | OAuth por usuario |
| Google Drive API | Evidencias de proyectos | OAuth por usuario |
| Web Push (VAPID) | Push del chat | `VAPID_PRIVATE_KEY` (+ pública/subject) |
| Supabase | Todo lo demás | `SUPABASE_SERVICE_ROLE_KEY` |

## 5. Convenciones

- Respuestas de Edge Functions: `{ ok: boolean }` o `{ ok: false, error: "codigo-corto" }` (los códigos de error son slugs, no strings de UI; la UI los traduce).
- CORS explícito vía `ALLOWED_ORIGINS`.
- Errores del servidor nunca incluyen secretos ni SQL crudo.
