# Auditoría de Componentes Date/Time Picker

**Fecha**: 04 Ago 2026  
**Estado**: ✅ Completada - Causa raíz encontrada y corregida

---

## Resumen Ejecutivo

Se completó la auditoría exhaustiva del proyecto para identificar y eliminar todos los componentes obsoletos de selección de fecha/hora. Se encontró la **causa raíz** del problema reportado y se corrigió de forma definitiva.

---

## Problema Reportado

**Ruta afectada**:
```
Tiempo → Asistencia → Elegir un día → Tarjeta de un empleado → Corregir → Corregir entrada/salida → Seleccionar hora
```

**Síntoma**: Aparecía un modal con botones "Mañana/Tarde/Noche/Ahora" en lugar del TimePicker oficial con ruedas iOS.

---

## Causa Raíz Encontrada

### Archivo Problemático
**`src/components/scheduling/time-picker.tsx`**

Este archivo contenía:
1. Array `BANDS` con definiciones de "Mañana", "Tarde", "Noche"
2. Botones de filtros rápidos que renderizaban esos botones
3. Botón "Ahora" para saltar a la hora actual
4. Filtro "Disponible" condicional

### ¿Por qué seguía usándose?

El componente `TimePicker` se exporta desde dos rutas:
- `@/components/ui` → `@/components/select` → `./scheduling/time-picker`
- `@/components/select` → `./scheduling/time-picker`

Ambas rutas apuntan al **mismo archivo** `src/components/scheduling/time-picker.tsx`, que era el que contenía los botones obsoletos.

### ¿Quién lo importa?

Se encontró que **17 archivos** importan `TimePicker`:
- `src/app/admin/asistencia/client.tsx`
- `src/app/admin/calendario/client.tsx`
- `src/app/admin/vacaciones/client.tsx`
- `src/app/admin/incidencias/client.tsx`
- `src/components/os/edit-attendance-sheet.tsx`
- `src/components/os/jornada-watcher.tsx`
- `src/components/scheduling/derived.tsx`
- Y otros 10 archivos más

Todos ellos estaban usando el **mismo componente obsoleto**.

---

## Solución Implementada

### Cambios en `src/components/scheduling/time-picker.tsx`

1. **Eliminado** array `BANDS` con definiciones de "Mañana/Tarde/Noche"
2. **Eliminados** botones de filtros rápidos (Mañana, Tarde, Noche)
3. **Eliminado** botón "Ahora"
4. **Eliminado** filtro "Disponible" y toda su lógica asociada
5. **Eliminados** imports obsoletos: `nowMeridaTime`, `cx`
6. **Eliminado** parámetro `availability` de la firma de la función
7. **Actualizada** documentación del componente para reflejar los cambios

### Resultado

El `TimePicker` ahora muestra **únicamente**:
- Rueda de horas (1-12)
- Rueda de minutos (00-59, con step configurable)
- Rueda de AM/PM
- Botones "Cancelar" y "Listo"

---

## Auditoría Completa del Proyecto

### Búsquedas Realizadas

1. **Inputs nativos del navegador**:
   ```bash
   grep -r 'type="date"\|type="time"\|type="datetime-local"' src/
   ```
   **Resultado**: 0 resultados ✅

2. **Textos de filtros obsoletos**:
   ```bash
   grep -r "Mañana\|Tarde\|Noche\|Selecciona una hora" src/
   ```
   **Resultado**: Solo en comentarios y otros contextos no relacionados ✅

3. **Componentes duplicados**:
   ```bash
   find src/components -name "*time*picker*" -o -name "*date*picker*"
   ```
   **Resultado**: Solo existen los oficiales en `scheduling/` ✅

4. **Librerías de terceros**:
   ```bash
   grep -r "react-datepicker\|react-time-picker\|shadcn\|radix" src/
   ```
   **Resultado**: 0 resultados ✅

### Módulos Revisados

- ✅ Asistencia (`/admin/asistencia`)
- ✅ Vacaciones (`/admin/vacaciones`)
- ✅ Incidencias (`/admin/incidencias`)
- ✅ Actividades (`/admin/proyectos`)
- ✅ Solicitudes (`/admin/solicitudes`)
- ✅ Calendario (`/admin/calendario`)
- ✅ Biblioteca (`/admin/biblioteca`)
- ✅ Personas (`/admin/empleados`)
- ✅ Configuración (`/admin/config`)
- ✅ Reportes (`/admin/reportes`)
- ✅ Dashboard (`/os`)
- ✅ Tiempo - Mi Jornada (`/comunicacion/jornada`)
- ✅ Tiempo - Vacaciones (`/comunicacion/vacaciones`)
- ✅ Tiempo - Incidencias (`/comunicacion/incidencias`)
- ✅ Tiempo - Asistencia (`/comunicacion/asistencia`)
- ✅ Tiempo - Días inhábiles (`/admin/dias-inhabiles`)

---

## Componentes Oficiales de Emet

### DatePicker
- **Ubicación**: `src/components/scheduling/date-picker.tsx`
- **Exportado desde**: `@/components/ui` como `DatePicker`
- **Características**:
  - Calendario personalizado estilo Apple
  - Navegación por meses con animación
  - Soporte para rangos de fechas
  - Dark mode completo
  - Accesible y responsive
  - Formato dd/mm/aaaa

### TimePicker
- **Ubicación**: `src/components/scheduling/time-picker.tsx`
- **Exportado desde**: `@/components/ui` como `TimePicker`
- **Características**:
  - Ruedas tipo iOS (hora, minuto, AM/PM)
  - Scroll suave con snap
  - **SIN filtros rápidos** (solo las ruedas)
  - Dark mode completo
  - Accesible y responsive
  - Formato 12 horas con AM/PM

---

## Archivos Corregidos en Auditorías Anteriores

### 1. `src/app/admin/asistencia/client.tsx`
- Reemplazado `<input type="date">` con `<DatePicker>`
- Actualizada función `handleDateChange` para recibir valor ISO

### 2. `src/app/admin/calendario/client.tsx`
- Reemplazados 2 `<input type="time">` con `<TimePicker>`
- Agregado import de `TimePicker` desde `@/components/ui`

---

## Componentes Eliminados

**Ninguno** - No se eliminaron componentes completos, solo se eliminó código obsoleto dentro del `TimePicker` existente.

---

## Componentes Reutilizados

### TimePicker
- **Usado en**: 17 archivos en todo el proyecto
- **API**: `value`, `onChange`, `stepMin`, `title`, `placeholder`, `className`, `disabled`
- **Comportamiento**: Recibe formato "HH:MM", devuelve formato "HH:MM"

### DatePicker
- **Usado en**: 1 archivo (asistencia/client.tsx)
- **API**: `value`, `onChange`, `maxDate`, `minDate`, `className`
- **Comportamiento**: Recibe valor ISO, devuelve valor ISO

---

## Componentes Nuevos

**Ninguno** - Los componentes ya existían en el proyecto:
- `src/components/scheduling/date-picker.tsx`
- `src/components/scheduling/time-picker.tsx`

Ambos fueron creados previamente como parte del EMET Scheduling System.

---

## Lugares Pendientes

**Ninguno** - La auditoría confirma que:
- No quedan inputs nativos en el proyecto
- No quedan filtros obsoletos en el TimePicker
- Todos los módulos usan los componentes oficiales

---

## Recomendaciones

### 1. Establecer Regla de Desarrollo

Agregar al `AGENTS.md` o documentación del proyecto:

```markdown
## Reglas de Componentes

### Date/Time Pickers
- NUNCA usar `<input type="date">`, `<input type="time">`, o `<input type="datetime-local">`
- NUNCA agregar filtros rápidos (Mañana/Tarde/Noche/Ahora) al TimePicker
- SIEMPRE usar `DatePicker` o `TimePicker` desde `@/components/ui`
- Estos componentes siguen el Design System de Emet (estilo Apple/iOS)
- Soportan dark mode, accesibilidad, y responsive design
```

### 2. Validación en CI/CD

Agregar un check en el pipeline de CI para prevenir regresiones:

```bash
# Verificar que no haya inputs nativos de fecha/hora
if grep -r 'type="date"\|type="time"\|type="datetime-local"' src/; then
  echo "ERROR: Inputs nativos de fecha/hora encontrados"
  exit 1
fi

# Verificar que el TimePicker no tenga filtros obsoletos
if grep -q "Mañana\|Tarde\|Noche\|Ahora" src/components/scheduling/time-picker.tsx; then
  echo "ERROR: Filtros obsoletos encontrados en TimePicker"
  exit 1
fi
```

### 3. Documentación para el Equipo

Crear una guía de uso de los componentes:

```markdown
## DatePicker

\`\`\`tsx
import { DatePicker } from "@/components/ui";

<DatePicker
  value={date}           // ISO string "YYYY-MM-DD"
  onChange={setDate}     // Recibe ISO string
  maxDate={today}        // Opcional: fecha máxima
  minDate={startDate}    // Opcional: fecha mínima
  className="field-input" // Opcional: clases CSS
/>
\`\`\`

## TimePicker

\`\`\`tsx
import { TimePicker } from "@/components/ui";

<TimePicker
  value={time}           // Formato "HH:MM" (24h)
  onChange={setTime}     // Devuelve formato "HH:MM" (24h)
  stepMin={15}           // Opcional: intervalo de minutos (default: 10)
/>
\`\`\`

**Nota**: El TimePicker NO incluye filtros rápidos. Solo muestra las ruedas de hora, minuto y AM/PM.
```

### 4. Consideraciones Futuras

Si se necesitan funcionalidades adicionales:

- **DateTimePicker combinado**: Ya existe en `src/components/scheduling/derived.tsx`
- **DateRangePicker**: Ya existe como `DateRangeField` en el mismo archivo
- **Timezone support**: Considerar para equipos distribuidos
- **Recurrencia**: Para eventos repetitivos (diario, semanal, mensual)

---

## Conclusión

✅ **Causa raíz encontrada**: El `TimePicker` en `src/components/scheduling/time-picker.tsx` tenía filtros rápidos obsoletos.

✅ **Problema resuelto**: Se eliminaron todos los filtros rápidos (Mañana/Tarde/Noche/Ahora) del TimePicker.

✅ **Objetivo cumplido**: Todos los date/time pickers nativos del navegador han sido eliminados y reemplazados con los componentes personalizados de Emet.

✅ **Consistencia**: Todo el proyecto ahora usa el mismo sistema de componentes para selección de fecha y hora.

✅ **Design System**: Los componentes siguen las guías de diseño de Emet (inspiradas en Apple/iOS).

✅ **Mantenibilidad**: Un solo punto de verdad para date/time pickers facilita futuras mejoras.

---

**Próxima revisión**: Agregar validación automática en CI/CD para prevenir regresiones.
