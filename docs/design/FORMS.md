# Emet · Formularios

## Anatomía

```
<Field label="Nombre" hint="Así lo verán los demás">
  <Input placeholder="Ej. Samu" />
</Field>
```

Campos con: label corto, `placeholder` útil (no "escribe aquí"), `hint` opcional debajo, y error con `aria-invalid="true"`.

## Estados

| Estado | Visual |
|---|---|
| Normal | `border: 1px var(--border-2)`, fondo `--surface` |
| Focus | `border-color: var(--accent)` + `box-shadow 0 0 0 4px var(--accent-tint)` |
| Error | `aria-invalid="true"` → borde + ring `--danger`/`--danger-tint` |
| Disabled | `opacity .55`, `cursor not-allowed`, fondo `--surface-2` |
| Placeholder | `--text-3` |

## Reglas

1. **Una acción primaria por formulario** (`.btn-primary`); "Cancelar" como terciario; "Guardar y continuar" (`.btn-ok`) cuando el verde tiene sentido (estado final).
2. El botón primario vive junto al formulario o en su footer (Sheet), siempre visible.
3. Validar en el borde: el error aparece al salir del campo, no al presionar "Guardar" (cuando sea asíncrono, mostrar estado del botón con spinner + toast de error).
4. `aria-invalid` es la ÚNICA señal de error (misma para ojo y lector de pantalla); no duplicar con colores solos.
5. Longitud máxima y formato (fechas, teléfonos) se validan y explican con `hint`.
6. Campos que se guardan solos (p. ej. toggle) llevan su propio estado guardado + toast "Guardado".
7. Los formularios de edición en Sheet (reutilizados en varias pantallas) mantienen el mismo orden de campos y labels en todas las instancias.

## Casos especiales

- **Empleado nuevo** (`admin/empleados`): form de alta con color de avatar (`nexus_color`), área, especialidades, saldo de vacaciones inicial y fecha de ingreso — las etiquetas son las mismas que luego verá RRHH.
- **Solicitud** (`admin/solicitudes`): tipo → subtipos → título → fecha/hora/lugar → notas → prioridad; el `min_hours_required` se valida server-side (trigger).
- **Horarios** (`admin/config/horarios`): matriz por persona/día con picker de hora nativo.
