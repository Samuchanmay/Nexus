# Emet · Tablas

## Principio

Emet evita las tablas densas: prefiere **tarjetas y grids** para listas. Las tablas reales se reservan para reportes y comparaciones de datos (asistencia semanal, saldos, reportes), donde la cuadrícula aporta lectura.

## Tipos

1. **Listas tipo tarjeta** (default): avatar + nombre + meta + estado como píldora. Ej. directorio, vacaciones, solicitudes.
2. **Grid de estadísticas** (`StatCard`): métricas clave del período.
3. **Tabla de reporte** (asistencia/saldos): columnas fijas, filas por persona, números `tabular-nums`, estados coloreados por celda.

## Reglas para tablas de reporte

- Header: fondo `--surface-2`, texto `--text-3`, size `12px`, uppercase, `letter-spacing`.
- Números alineados a la derecha; texto a la izquierda; `font-variant-numeric: tabular-nums`.
- Celdas de estado: píldora (`.pill`) con tone, no texto plano.
- Sin líneas verticales; separadores horizontales finos `--border`.
- Zonas horarias y duraciones: formato corto (`8h 30m`), no decimales.
- En impresión (Reportes → PDF): `break-inside: avoid` en filas, colores en grises legibles (ver `@media print`).

## Alternativas

- Si la "tabla" tiene >6 columnas en móvil, convertir a **tarjeta apilada** (p. ej. el reporte semanal en celular muestra persona + resumen, con detalle al tocar).
- Los comparadores semanales (asistencia vs objetivo) se muestran como barras/deltas en `StatCard`, no como columna extra.

## Ver también

- `modules/REPORTS.md` — el reporte semanal y su exportación
- `SPACING.md` — densidad de filas
