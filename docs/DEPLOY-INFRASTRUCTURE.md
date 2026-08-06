# 🚀 Despliegue de Infraestructura — Emet (emet.uno)

> **Fecha**: 2026-08-05  
> **Estado**: Pendiente de aplicar en producción  
> **Tiempo estimado**: 30-45 minutos

---

## 📋 Checklist de tareas

- [ ] **1. Aplicar migraciones SQL** (0025-0038) en el SQL Editor de Supabase
- [ ] **2. Configurar secrets de Google Calendar** en el dashboard
- [ ] **3. Configurar secrets VAPID** para push notifications
- [ ] **4. Desplegar Edge Functions** (7 gcal-* + send-chat-push)
- [ ] **5. Verificaciones manuales** con 2 cuentas

---

## 1️⃣ Aplicar migraciones SQL (0025-0038)

### ⚠️ IMPORTANTE: Orden de aplicación

Aplicar en **este orden exacto** en el SQL Editor de Supabase (dashboard → SQL Editor → New Query):

#### Paso 1: Migraciones 0025-0034 (script unificado)
```bash
# Abrir y copiar TODO el contenido de:
docs/MIGRACIONES-APLICAR-0025-0034.sql
```
**Qué incluye:**
- 0025: Chat mute duration + read_at
- 0026: Realtime publication fix
- 0027: Attendance corrections history
- 0028: Events extended
- 0029: Event participants attendance
- 0030: Event check-in GPS
- 0031: Google Calendar sync
- 0032: Event check-in ownership guard
- 0033: Chat push subscriptions
- 0034: Phone self-editable

**Pegar en SQL Editor → Run** ✅

---

#### Paso 2: Migración 0035 (Attendance Admin RLS)
```bash
# Abrir y copiar TODO el contenido de:
docs/MIGRACIONES-APLICAR-0035-ATTENDANCE-RLS.sql
```
**Qué incluye:**
- 0035: Admin/RH pueden escribir asistencia de cualquier persona

**Pegar en SQL Editor → Run** ✅

---

#### Paso 3: Migración 0036 (Chat Search)
```bash
# Abrir y copiar TODO el contenido de:
docs/MIGRACIONES-APLICAR-0036-CHAT-SEARCH.sql
```
**Qué incluye:**
- 0036: Búsqueda cross-conversación con índice trigram

**Pegar en SQL Editor → Run** ✅

---

#### Paso 4: Migración 0037 (Chat Lecturas + Ocultar)
```bash
# Abrir y copiar TODO el contenido de:
docs/MIGRACIONES-APLICAR-0037-CHAT-LECTURAS-Y-OCULTAR.sql
```
**Qué incluye:**
- 0037: message_reads (Leído por...) + message_hidden (Eliminar para mí)

**Pegar en SQL Editor → Run** ✅

---

#### Paso 5: Migraciones 0037b + 0038 (Attendance fixes)
```bash
# Abrir y copiar TODO el contenido de:
docs/MIGRACIONES-APLICAR-0037b-0038-ATTENDANCE-FIX.sql
```
**Qué incluye:**
- 0037b: Policy para que admin/RH puedan eliminar movimientos de asistencia
- 0038: Fix de RLS para attendance_corrections (usaba auth.uid() incorrectamente)

**Pegar en SQL Editor → Run** ✅

---

### ✅ Verificación post-migraciones

Ejecutar en SQL Editor para confirmar:
```sql
-- Debe devolver las tablas nuevas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('message_reads', 'message_hidden', 'google_oauth_tokens', 'event_participants', 'event_attendance', 'attendance_corrections');

-- Debe devolver los RPCs nuevos
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'nx_%'
ORDER BY routine_name;
```

---

## 2️⃣ Configurar secrets de Google Calendar

### 📍 Dónde: Dashboard Supabase → Edge Functions → Secrets

### 🔑 Secrets necesarios:

| Secret | Valor | Dónde obtenerlo |
|--------|-------|-----------------|
| `GOOGLE_CLIENT_ID` | Client ID de Google Cloud Console | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client IDs |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google Cloud Console | Mismo lugar que arriba |
| `ALLOWED_ORIGINS` | `https://emet.uno,https://nexus-cert01.vercel.app,https://nexus-samu09.vercel.app` | Opcional (ya está hardcodeado) |

### 📝 Pasos:

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Seleccionar proyecto → APIs & Services → Credentials
3. Crear OAuth 2.0 Client ID (Web application)
4. Agregar URI de redireccionamiento: `https://emet.uno/auth/callback`
5. Copiar Client ID y Client Secret
6. En Supabase Dashboard → Edge Functions → Secrets → Add Secret
7. Agregar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`

---

## 3️⃣ Configurar secrets VAPID (Push Notifications)

### 📍 Dónde: Dashboard Supabase → Edge Functions → Secrets

### 🔑 Secrets necesarios:

| Secret | Valor | Dónde obtenerlo |
|--------|-------|-----------------|
| `VAPID_PUBLIC_KEY` | Clave pública VAPID | Generar con `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Clave privada VAPID | Mismo comando |
| `VAPID_SUBJECT` | `mailto:admin@emet.uno` | Email de contacto |

### 📝 Pasos:

1. En tu máquina local:
```bash
npx web-push generate-vapid-keys
```

2. Copiar las 3 claves generadas

3. En Supabase Dashboard → Edge Functions → Secrets → Add Secret
4. Agregar `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

5. **IMPORTANTE**: Actualizar la constante `VAPID_PUBLIC_KEY_FALLBACK` en:
   - `src/lib/use-push-notifications.ts` (línea ~10)
   - `supabase/functions/send-chat-push/index.ts` (línea ~26)

---

## 4️⃣ Desplegar Edge Functions

### 📍 Dónde: Terminal local (con Supabase CLI instalado)

### 🚀 Comandos:

```bash
# Navegar al directorio del proyecto
cd C:\Users\Samuel\Downloads\Nexus\Nexus

# Login a Supabase (si no lo has hecho)
supabase login

# Link al proyecto (si no lo has hecho)
supabase link --project-ref <TU_PROJECT_REF>

# Desplegar Edge Functions (una por una)
supabase functions deploy gcal-create-event
supabase functions deploy gcal-delete-event
supabase functions deploy gcal-list-events
supabase functions deploy gcal-register-webhook
supabase functions deploy gcal-sync-event
supabase functions deploy gcal-unregister-webhook
supabase functions deploy gcal-webhook
supabase functions deploy send-chat-push
```

### ✅ Verificación post-despliegue:

```bash
# Listar funciones desplegadas
supabase functions list

# Probar una función (ejemplo)
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/gcal-list-events \
  -H "Authorization: Bearer <ANON_KEY>"
```

---

## 5️⃣ Verificaciones manuales

### 👥 Necesitas: 2 cuentas de usuario (admin + empleado)

### ✅ Checklist de verificación:

#### Chat (Realtime + Push)
- [ ] Enviar mensaje desde cuenta A → aparece en cuenta B en <2s
- [ ] Marcar como leído → tick doble aparece en cuenta A
- [ ] "Leído por..." aparece en grupos (migración 0037)
- [ ] "Eliminar para mí" oculta mensaje solo para ti (migración 0037)
- [ ] Push notification llega con app cerrada

#### Asistencia
- [ ] Admin corrige asistencia de otro empleado → se guarda ✅
- [ ] Admin elimina movimiento de asistencia → se elimina ✅
- [ ] Historial de correcciones visible en `attendance_corrections`

#### Eventos
- [ ] Crear evento → aparece en calendario
- [ ] Check-in con GPS → valida ubicación
- [ ] Participantes y asistencia se registran

#### Google Calendar Sync
- [ ] Vincular cuenta Google → OAuth flow completo
- [ ] Crear evento en Nexus → aparece en Google Calendar
- [ ] Crear evento en Google Calendar → aparece en Nexus (webhook)

---

## 🐛 Troubleshooting

### Error: "relation X does not exist"
**Causa**: Migraciones no aplicadas en orden  
**Solución**: Volver al paso 1 y aplicar en orden

### Error: "permission denied for table X"
**Causa**: RLS policies no aplicadas  
**Solución**: Verificar que migraciones 0035, 0037b, 0038 están aplicadas

### Error: "GOOGLE_CLIENT_ID not found"
**Causa**: Secrets no configurados  
**Solución**: Ir al paso 2

### Error: "VAPID keys not configured"
**Causa**: Secrets VAPID no configurados  
**Solución**: Ir al paso 3

### Push notifications no llegan
**Causa**: Edge Function `send-chat-push` no desplegada o secrets VAPID incorrectos  
**Solución**: Verificar despliegue y secrets

---

## 📞 Soporte

Si algo falla:
1. Revisar logs en Supabase Dashboard → Edge Functions → Logs
2. Verificar que todas las migraciones están aplicadas (paso 1)
3. Verificar que todos los secrets están configurados (pasos 2-3)
4. Verificar que todas las Edge Functions están desplegadas (paso 4)

---

## 🎯 Resumen final

Después de completar todos los pasos:
- ✅ Chat con "Leído por..." y "Eliminar para mí" funcionando
- ✅ Push notifications funcionando
- ✅ Google Calendar sync funcionando
- ✅ Asistencia con correcciones y eliminaciones funcionando
- ✅ Eventos con participantes y check-in GPS funcionando

**Tiempo total**: ~30-45 minutos
