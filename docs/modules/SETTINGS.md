# Módulo · Configuración

Rutas: dominio "Config" (`/admin/config/*`) · Roles: admin.

## Qué es

Panel de administración de la operación: parámetros globales, dispositivos, pausas, horarios y tipos. Es la "nevera" de la que beben fichaje, tiempo y calendario.

## Secciones

| Sección | Ruta | Contenido |
|---|---|---|
| Horarios | `/admin/config/horarios` | Matriz persona/día con picker de hora nativo |
| GPS / dispositivos | `/admin/config/gps` | `dispositivos_gps` con radios de geofence; rangos (`<input type="range">`) |
| Pausa activa | `/admin/config/pausa-activa` | Frecuencia/duración de la pausa y del popup |
| Estados de jornada | `/admin/config/estados-jornada` | Catálogo de estados configurables |
| Tipos de actividad | `/admin/config/tipos-actividad` | `tipo_tarea` usados en Mi Día y actividades |
| Colores | `/admin/config/colores` | Paleta/personalización de tokens y etiquetas |

## Modelo de datos (resumen)

- `configuracion` / `parametros` — valores globales (`param`, `valor`).
- `dispositivos_gps` — dispositivo, radio, geofence.
- `estados_jornada`, `tipos_actividad`, `horarios`, `pausa_activa`.

## Reglas

1. Todo cambio en config es **inmediato y auditado** (quién, cuándo, valor anterior).
2. Config global es solo admin; los datos de su propio equipo pueden verlos coordinador (lectura).
3. Los cambios de horarios/GPS se reflejan sin redeploy: el cliente lee la config por RLS/Realtime (ver `docs/architecture/STATE.md`).
4. Un valor configurable lleva siempre su default sensato en el schema (migración) y en `SETTINGS` del cliente.

## Ver también

- `docs/modules/TIME.md` — cómo consume horarios/GPS/pausas
- `docs/architecture/DATABASE.md` — tabla de configuración
