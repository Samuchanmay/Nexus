# Nexus · CERT Comunicación

Sistema operativo del Departamento de Comunicación: checador GPS, jornadas, vacaciones, incidencias, solicitudes de comunicación, proyectos con checklist y time tracking, panel RH de solo lectura y portal para coordinadores.

**Un solo proyecto Next.js · un dominio · un login con Google.**

Hecho con ❤️ por Samu Chan

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind |
| Backend | Supabase (Postgres + Auth + Edge Functions + RLS) |
| Auth | Google OAuth con whitelist en `public.users` |
| Correo | Resend (notificación de vacaciones a Samuel) |
| Hosting | Vercel |

## Módulos y rutas

| Ruta | Rol | Qué hace |
|---|---|---|
| `/fichar` | empleado, admin | Fichaje rápido con GPS (≤50 m) y confirmación real |
| `/empleado` | empleado, admin | Mi Día: jornada + tareas con time tracking y checklist |
| `/empleado/jornada` | empleado, admin | Historial de 30 días con detalle por movimiento |
| `/empleado/vacaciones` | empleado, admin | Solicitar (días hábiles automáticos) y consultar |
| `/empleado/incidencias` | empleado, admin | Permisos, incapacidades, home office… |
| `/admin` | admin | Panel: KPIs + presencia del equipo + mi propia jornada |
| `/admin/solicitudes` | admin | Aprobar/rechazar con prioridad + asignación múltiple + checklist automático |
| `/admin/proyectos` | admin | Todos los proyectos activos y cerrados |
| `/admin/nexus` | admin | Asistencia del equipo en tiempo real |
| `/admin/vacaciones` | admin | Aprobar tras el VoBo externo (descuenta saldo) |
| `/admin/incidencias` | admin | Autorizar/rechazar incidencias |
| `/admin/equipo` | admin | Carga de trabajo por persona |
| `/admin/empleados` | admin | Whitelist: alta, especialidades, horario, color |
| `/admin/dias-inhabiles` | admin | Festivos y puentes |
| `/rh` | rh, admin | Solo lectura: horas por periodo + export CSV. Sin retardos ni faltas |
| `/coordinador` | coordinador, departamento | Onboarding 1er login + wizard de solicitud (valida 72 h / 168 h) |

## Reglas de negocio implementadas

- **Horas**: `total = salida − entrada`. La comida **cuenta** como tiempo laborado. No existen retardos. Tolerancia 15 min. Jorge tiene jornada vespertina 14:00–21:00 (420 min); el resto 09:00–18:00 (480 min).
- **Fichaje**: GPS validado en el cliente **y** en el servidor (Edge Function). El éxito solo se muestra si Supabase devuelve el UUID del registro — nunca hay confirmación falsa. `UNIQUE(user_id, reason, date, time)` frena duplicados a nivel BD.
- **Vacaciones**: el empleado solicita → correo automático a Samuel (Resend) → Samuel gestiona el VoBo por fuera → aprueba en `/admin/vacaciones` → se descuenta el saldo.
- **Solicitudes**: anticipación mínima 72 h (Lona y Video: 168 h), validada en el wizard. Al aprobar se crea el proyecto, se asigna a una o varias personas con responsable principal, y se copia el checklist de la plantilla (5 tipos).
- **Time tracking**: una tarea activa a la vez. "Agregar actividad" registra trabajo no asignado y queda `en_revision` hasta que el admin lo valide.
- **Admin = superset de Empleado**: todo lo que Samuel hace suma a su jornada y aparece en RH.

---

## Cómo se conecta cada API (resumen claro)

| Necesidad | Solución en v1 | Qué hay que configurar |
|---|---|---|
| **Login con Google** | Supabase Auth + Google OAuth | Client ID/Secret en Google Cloud → pegarlos en Supabase (paso 2). **Es la única API de Google que requiere configuración.** |
| **Correo de vacaciones a Samuel** | **Resend** (no Gmail API) | Cuenta gratis en resend.com + 1 API key (paso 4). Gmail API requeriría verificación de Google y OAuth de servidor — Resend hace lo mismo en 5 minutos. |
| **Google Calendar** | **Enlace de un clic** al aprobar | **Nada.** Al aprobar vacaciones o un proyecto con fecha, Nexus abre el evento pre-llenado en Google Calendar. Como los calendarios (Vacaciones, Eventos CERT) viven en **macgenio55@gmail.com**, basta con tener esa cuenta iniciada en el navegador: en la pantalla del evento eliges a qué calendario va y das "Guardar". Cero API keys, cero service accounts. |
| **Google Drive** | Campo `drive_folder_url` por proyecto | Nada en v1: pegas el enlace de la carpeta. La creación automática de carpetas queda en backlog (requiere service account). |
| **GPS del fichaje** | Geolocation API del navegador + validación en Edge Function | Nada — solo servir por HTTPS (Vercel ya lo hace). |

> Coordenadas de la oficina ya configuradas con los valores reales del checador actual: **lat 20.405833, lng -89.529222, radio 50 m**.

---

## Puesta en marcha (paso a paso)

### 1 · Crear el proyecto Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project** (región us-east recomendada).
2. En **SQL Editor**, pega y ejecuta el contenido completo de `supabase/schema.sql`. Esto crea las 21 tablas, las políticas RLS, los 4 usuarios reales, horarios, festivos 2026 y las 5 plantillas de checklist.
3. En **Settings → API**, copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

### 2 · Configurar Google OAuth

1. En [Google Cloud Console](https://console.cloud.google.com) crea un proyecto → **APIs & Services → Credentials → OAuth client ID** (tipo *Web application*).
2. **Authorized redirect URI**: `https://TU-PROYECTO.supabase.co/auth/v1/callback`
3. En Supabase: **Authentication → Providers → Google** → pega Client ID y Secret → Enable.
4. En **Authentication → URL Configuration** agrega tu dominio de Vercel a *Redirect URLs* (ej. `https://nexus.cert.edu.mx/auth/callback`).

> La whitelist ya funciona: si el correo de Google no existe en `public.users`, el callback cierra la sesión y muestra "no autorizado".

### 3 · Deploy de las Edge Functions

Con el [CLI de Supabase](https://supabase.com/docs/guides/functions) instalado:

```bash
supabase link --project-ref TU-PROYECTO
supabase functions deploy fichar
supabase functions deploy notify-vacation

# Secrets de las funciones
supabase secrets set OFICINA_LAT=20.405833 OFICINA_LNG=-89.529222 RADIO_MAX_M=50
supabase secrets set RESEND_API_KEY=re_xxx NOTIFY_EMAIL=samuel.chan@cert.edu.mx
```

> Ajusta `OFICINA_LAT/LNG` a las coordenadas reales de la oficina (Google Maps → clic derecho → copiar coordenadas). Deben coincidir con las variables `NEXT_PUBLIC_OFICINA_*` del frontend.

### 4 · Resend (correo de vacaciones)

1. Crea cuenta en [resend.com](https://resend.com) → verifica el dominio `cert.edu.mx` (o usa el dominio de pruebas al inicio).
2. Genera un API key y úsalo en el secret `RESEND_API_KEY` del paso anterior.

### 5 · Migrar los saldos y las 16 vacaciones históricas

1. Los saldos iniciales ya están en el seed (`vacation_balance`); ajústalos en **Table Editor → users** si cambiaron.
2. Abre el final de `supabase/schema.sql`: ahí está la plantilla comentada para insertar los 16 movimientos del Excel `CONTROL_VACACIONES`. Complétala con las fechas reales y ejecútala en SQL Editor.
3. La asistencia arranca en blanco: no se migra historial del checador anterior.

### 5b · ¿Cómo entran coordinadores y RH?

Igual que todos: **con su cuenta de Google**. No hay contraseñas en Nexus.

1. Tú los das de alta en `/admin/empleados` con su correo (sirve cualquier Gmail o cuenta @cert.edu.mx) y el rol **Coordinador**, **Departamento** o **RH**.
2. Ellos entran a la URL de Nexus → "Continuar con Google".
3. El sistema detecta su rol y los manda a su portal: coordinadores al wizard de solicitudes (con onboarding en el primer login), RH al panel de solo lectura.
4. Si alguien intenta entrar con un correo que no diste de alta, ve "no autorizado" y no pasa.

### 6 · Deploy con GitHub + Vercel (sin dominio propio por ahora)

```bash
# 1. Sube el proyecto a GitHub
cd nexus
git init && git add -A && git commit -m "Nexus v1"
# crea el repo en github.com (privado) y:
git remote add origin https://github.com/TU-USUARIO/nexus.git
git push -u origin main
```

2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo de GitHub.
3. Agrega las variables de entorno (las de `.env.example`) en el paso de configuración y dale **Deploy**.
4. Vercel te da una URL tipo `https://nexus-xxxx.vercel.app` — esa es tu app funcionando. **Agrega esa URL** en Supabase → Authentication → URL Configuration → Redirect URLs (`https://nexus-xxxx.vercel.app/auth/callback`).
5. Cada `git push` redespliega automáticamente.
6. **Cuando tengan el dominio**: Vercel → Settings → Domains → agregar `nexus.cert.edu.mx`, y sumar la nueva redirect URL en Supabase. Nada más cambia.

En **Vercel → Settings → Environment Variables** agrega todas las variables de `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_OFICINA_LAT
NEXT_PUBLIC_OFICINA_LNG
NEXT_PUBLIC_RADIO_MAX_M
```

Después `vercel --prod`. Conecta el dominio (ej. `nexus.cert.edu.mx`) en Settings → Domains.

### 7 · Primer login

1. Entra con `samuel.chan@cert.edu.mx` → el trigger vincula tu cuenta de Google a tu perfil admin.
2. Verifica en `/admin/empleados` que los 4 usuarios estén correctos.
3. Pide a cada empleado entrar una vez para vincular su cuenta.
4. Comparte `/fichar` para que lo agreguen a la pantalla de inicio del teléfono (Safari/Chrome → Compartir → Agregar a pantalla de inicio).

---

## Desarrollo local

```bash
cp .env.example .env.local   # completa las variables
npm install
npm run dev                  # http://localhost:3000
```

## Estructura

```
nexus/
├── supabase/
│   ├── schema.sql                 # 21 tablas + RLS + seeds + trigger whitelist
│   └── functions/
│       ├── fichar/                # GPS server-side + INSERT con UUID real
│       └── notify-vacation/       # correo Resend a Samuel
├── src/
│   ├── middleware.ts              # sesión + protección de rutas
│   ├── lib/
│   │   ├── supabase/              # clientes browser/server (@supabase/ssr)
│   │   ├── types.ts               # dominio completo
│   │   └── hours.ts               # motor de horas (comida cuenta, sin retardos)
│   ├── components/                # icons, toast, sheet, avatar, segments
│   └── app/
│       ├── fichar/                # ruta crítica
│       ├── empleado/              # Mi Día, jornada, vacaciones, incidencias
│       ├── admin/                 # 9 secciones
│       ├── rh/                    # solo lectura + CSV
│       └── coordinador/           # onboarding + wizard
```

## Backlog (fuera de v1, diseñado)

- Guardias de sábado (tabla `guards` lista, sin UI)
- Carpeta de Drive y evento de Calendar automáticos por proyecto (columnas listas)
- Escalamiento automático de prioridad vía cron (la sugerencia 48 h/96 h ya opera al aprobar)
- Export a Excel/PDF nativo en RH (v1 exporta CSV compatible con Excel)
