# Emet · Copywriting

## Tono

**Directo, cálido y sin ruido.** Emet habla como un buen colega que te da una instrucción clara: sin "Hola Samuel, espero que estés muy bien…", sin jerga técnica, sin exclamaciones de marketing. Referentes de tono: Apple (calmado), Linear (preciso), Signal (respetuoso).

## Principios

1. **Verbos de acción, no sustantivos** de sistema: "Guardar", "Enviar", "Aprobar", "Pausar" — no "Submit", "Execute".
2. **Sin saludos falsos** en notificaciones ni EMU: el mensaje es la información, no el preámbulo.
3. **Errores con causa y remedio**: "No se pudo guardar: revisa tu conexión e inténtalo de nuevo." (no "Error 500").
4. **Tiempos en lenguaje natural**: "Lunes, 3 de agosto" / "Hace 5 min" / "8h 30m" — nunca ISO ni decimales crudos.
5. **Contraste de voz por contexto**:
   - Admin/operación → preciso, neutral ("3 solicitudes pendientes").
   - Colaborador (Mi Día) → cercano, ligero ("Buenas tardes, Jorge. Llevas 4h 30m hoy.").
   - Chat → natural, humano (es contenido del usuario; la UI es invisible).
6. **Números honestos**: los saldos/tiempos se redondean solo en display, nunca se maquillan.

## Guías por pieza

| Pieza | Regla |
|---|---|
| Botones | ≤2 palabras; verbo infinitivo o acción ("Nueva solicitud", "Enviar") |
| Títulos de pantalla | Sustantivo del dominio ("Solicitudes", "Mi día", "Asistencia") |
| Estados vacíos | Situación + qué sigue (ver `EMPTY_STATES.md`) |
| Notificaciones | Asunto directo + contexto; sin emojis (canon) |
| Toasts | "Guardado." / "No se pudo guardar." (con razón breve si cabe) |
| Confirmation dialogs | Verbo exacto de la acción + qué implica ("Cancelar esta solicitud" no "¿Seguro?") |
| EMU (asistente) | Mensajes ≤2 líneas, escrito a mano, con CTA cuando hay siguiente paso |
| Errores de validación | Qué campo, qué se espera ("El correo debe ser @cert.edu.mx") |

## Palabras que se usan

`Mi día`, `Jornada`, `Asistencia`, `Incidencias`, `Vacaciones`, `Solicitudes`, `Biblioteca`, `Recorridos`, `Equipo`, `Personas`, `Tiempo`, `Reportes`, `Configuración`.

## Palabras que NO se usan

`Usuario` (se dice persona/colaborador), `Submit`, `Deploy`, `Endpoint`, `Bug`, `Dashboard` (se dice Inicio/Hoy), `Preview` (Vista previa), `Backend` (no aparece en UI), `Error 500` crudo, anglicismos cuando hay palabra en español clara.

## Reglas duras

1. Cero emojis en copy de sistema/notificaciones (ver `EMOJIS.md`).
2. La UI en español (es_MX); los códigos de error en el servidor son slugs en español (`archivo-muy-grande`), la UI los traduce.
3. Fechas y horas locales a `America/Merida`.
4. Si el copy de una pantalla no se puede escribir corto, la pantalla probablemente necesita otra estructura, no más texto.
5. El saludo 👋 es la ÚNICA excepción de calidez decorativa permitida (una vez por carga).
