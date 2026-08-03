# Emet · Design for Humans

> La guía de cómo Emet se siente. Se originó como el estándar de UX del producto y gobierna TODO lo que se construye. Complementa `DESIGN_PRINCIPLES.md` (los principios) con comportamientos concretos.

## 1. El sistema siempre dice qué está pasando

- **Carga**: skeleton (`.nx-skel`) con la forma real del contenido, o `DelayedFallback` a los 350ms. Nunca texto "Cargando…" suelto.
- **Éxito**: feedback discreto (toast verde, tick animado). Sin confeti.
- **Error**: visible, explicado y con salida. Un error silencioso es un bug (se corrige el bug, no el copy).

## 2. Los estados vacíos no son agujeros negros

Todo `EmptyState` tiene: icono + título que explica la situación + pista de qué hacer + acción opcional. Ej.: "Sin solicitudes" no basta; "Aún no hay solicitudes. Crea la primera desde el botón Nueva solicitud."

## 3. La memoria es una función, no una frase

- EMU recuerda lo que ignoraste ≥3 veces y ofrece un recordatorio (CTA extra).
- El sistema recuerda: tema, vista activa del hub, recorridos vistos, dispositivo del quiosco.
- El copy **nunca** finge memoria ("como te dije ayer…") si no la hay.

## 4. Formularios que no castigan

- Placeholders claros, `hint` bajo el campo, focus ring azul visible.
- Errores con `aria-invalid="true"` (misma señal para el ojo y el lector de pantalla).
- Campos deshabilitados con opacidad y cursor not-allowed explícitos.
- La acción primaria del formulario es obvia; "Cancelar" siempre cerca.

## 5. La confirmación interrumpe solo cuando debe

- **Sheet** para lo que es parte del flujo (adjuntos, reenvío, cámara): no bloquea, se desliza.
- **Dialog** solo para decisiones irreversibles o que necesitan atención total (ver ADR-0002).

## 6. Notificaciones que respetan la atención

- Campana con contador de no leídos.
- Toasts breves; los de error "tiemblan" (`.nx-toast-shake`) para distinguirse del éxito sin sonido.
- Pausa activa: aparece una vez, es silenciable, con ilustración calmada (taza respirando, no emoji ruidoso).

## 7. Tiempo: el pulso del equipo

- El colaborador ve **su día** primero (hero + temporizador + agenda), no un reporte.
- El admin ve la **operación**: quién está, quién falta, qué se entregó.
- La asistencia se deriva de datos (checadas, horarios) y se muestra con color semántico, nunca con texto plano "estado: ok".

## 8. Toques humanos

- El saludo 👋 anima una vez por carga — no es persistente ni molesto.
- Los nombres y avatares con color por persona (`nexus_color`) hacen al equipo reconocible.
- Cumpleaños se celebran en la fila de la persona (badge con pastel 🎂), sin interrumpir el flujo.
- El copy habla como un buen colega: directo, útil, sin condescendencia (ver `COPYWRITING.md`).

## 9. Errores del servidor y red

- Si una acción falla por red, el sistema lo dice y ofrece reintentar (outbox del chat ya lo hace solo).
- Los estados offline son visibles (mensaje "sin conexión, se enviará cuando vuelvas").

## 10. Accesibilidad mínima exigida

- Contraste de texto ≥ 4.5:1 para texto normal (los tokens están diseñados para ello).
- Foco visible (`:focus-visible` anillo azul).
- `prefers-reduced-motion` respetado globalmente.
- Botones con label accesible (`aria-label` cuando solo hay icono).
- Ver `ACCESSIBILITY.md` para el detalle.
