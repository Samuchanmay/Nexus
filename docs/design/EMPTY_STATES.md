# Emet · Estados vacíos

## Regla

Un estado vacío **nunca** es una página en blanco: explica la situación, quita la culpa al usuario y ofrece el siguiente paso.

## Anatomía

```
EmptyState
  icon   (por defecto `sparkle`)
  title  "Aún no hay solicitudes"
  hint   "Cuando el equipo pida cobertura o diseño, aparecerán aquí."
  action (botón opcional: "Nueva solicitud")
```

## Guías de copy

| Componente | Correcto | Incorrecto |
|---|---|---|
| Título | "Sin solicitudes esta semana" | "No hay datos" |
| Hint | "Las solicitudes aprobadas aparecen aquí automáticamente." | "N/A" / "0 resultados" |
| Acción | "Crear la primera" | "Refrescar" (si no arregla el vacío) |

## Cuándo usarlos

- Listas de resultados vacías (biblioteca, solicitudes, directorio con filtro).
- Bandeja de notificaciones vacía.
- Calendario sin eventos en el rango (con botón para crear).
- Búsqueda sin resultados (distinto de lista vacía: sugerir quitar filtros).

## Qué NO se hace

- No iconos gigantes de error triste; el estado vacío es neutro y útil, no dramático.
- No emojis en vacíos (ver `EMOJIS.md`): icono del set.
- No "vacío" para ocultar un error: si la consulta falló, es un error con su propio copy y retry, no un empty state.

## Implementación

`EmptyState` en `src/components/os/ui.tsx` (icon, title, hint, action). Usarlo en todos los casos nuevos; las pantallas viejas se van migrando conforme se tocan.
