# Emet · Emojis

Emet usa emojis de forma **deliberada y contenida**: dan calidez (el producto nació en un equipo pequeño mexicano) pero nunca sustituyen a un estado bien diseñado.

## Dónde están permitidos

| Lugar | Ejemplo | Regla |
|---|---|---|
| Reacciones del chat | 👍 ❤️ 🔥 🎉 | Catálogo acotado (ver `reactions.tsx`) |
| Stickers del chat | pack de stickers | Migración 0022 |
| Cumpleaños | 🎂 junto al nombre | Solo en la fila de la persona |
| Saludo del día | 👋 en header de Hoy | Una vez por carga |
| Pausa activa | (sin emoji) | Rediseñada a ilustración propia (taza + vapor) |
| Asistente EMU | icono animado | Sin emojis: icono del set + bounce |

## Principios

0. **Diseño Apple únicamente (SPEC-004, `EMET_CANON.md`)**: el estilo de emoji es siempre `Apple Color Emoji`; prohibido empaquetar o usar assets Twemoji/Noto/EmojiOne/JoyPixels. En plataformas sin el font de Apple se usa el emoji nativo del sistema vía la pila de fuentes, nunca un font/imagen alternativo.
1. **Nunca** emojis como botones de acción de negocio (aprovechar → no, usar el set de iconos).
2. **Nunca** emojis en títulos de tarjetas o headers de sección (ensucian la jerarquía).
3. Los emojis de estado (⚠️ en vacío, etc.) se reemplazan por iconos del set + copy.
4. La pausa activa, el asistente y los estados tienen **ilustración/movimiento propio**, no emoji: el emoji es para momentos puntuales de calidez, no para UI del sistema.
5. En copy de notificaciones/EMU: sin emojis (tono Apple/Linear/Signal — directo, sin adornos).

## Chat

- Reacciones: pop animado (0.9→1.1→1.0), el emoji es contenido del usuario, no UI. Solo se puede reaccionar a mensajes de **otros** (Signal no permite reacciones propias).
- Stickers: se suben como assets y se muestran como imágenes (`message_attachments`), no como texto emoji.

## Regla general

Si no hay un lugar en esta lista, **no usar emoji**. Ante la duda, icono del set o nada.
