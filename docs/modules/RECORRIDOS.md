# Módulo · Recorridos (preptour, demos)

Rutas: `/preptour` (tour de preparación) · dominio "Recorridos" (operativo) · Roles: admin, empleado (según habilitación).

## Qué es

**Recorridos** es el módulo de rutas/visitas de campo: recorridos diarios del equipo en terreno. **Preptour** es el tour de primera visita (onboarding interactivo) que comparte ADN visual pero no comparte datos.

## Dos cosas distintas (¡no confundir!)

| | Preptour | Recorridos |
|---|---|---|
| Qué es | Tour de onboarding | Visitas de campo operativas |
| Ruta | `/preptour` | Hub "Recorridos" |
| Datos | Nada persistente real | `recorridos`, checkpoints, evidencias |
| Quién | Todo nuevo usuario | Colaboradores habilitados |

## Edge Functions de demos (recorridos de demostración)

- `demos-ingest` — recibe el payload de un recorrido de demo (checkpoints, evidencias, tiempos).
- `demos-list` — lista demos/recorridos ingresados.
- `demos-public` — endpoint público/read-only para consumo externo (p. ej. mapas o reportes de visita).
- `drive-upload` — sube evidencias (fotos del recorrido) a Drive con WebP/pipeline.

## Flujo de un recorrido

1. Se inicia un recorrido con checkpoints esperados.
2. El colaborador va registrando pasos/evidencia (`demos-ingest`).
3. Se suben evidencias (`drive-upload`).
4. La operación consulta lo registrado (`demos-list`, `demos-public`).

## Reglas

1. Los endpoints de demo son de **escritura controlada** (`demos-ingest` validado) y **lectura pública** solo de lo no sensible (`demos-public`).
2. Las evidencias pasan por el mismo pipeline de imágenes que el chat (WebP thumb/medium/original) antes de subir a Drive.
3. `demos-public` no expone PII: devuelve solo lo necesario para el caso de uso externo.

## Ver también

- `docs/modules/ONBOARDING.md` — preptour en el ciclo de acceso
- `docs/architecture/API.md` — contrato de las Edge Functions de demos
- `docs/coding/SECURITY.md` — sanitización en endpoints públicos
