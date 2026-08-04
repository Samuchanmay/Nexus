# Emet Design Principles v1

> Especificación obligatoria para todo el proyecto. Ninguna pantalla nueva puede introducir un estilo diferente sin antes incorporarlo al Design System.

---

## Filosofía

Emet no es un conjunto de pantallas. Es un **producto cohesionado de nivel profesional** que se siente como Apple + Linear + Notion + Stripe.

Cada decisión de diseño debe pasar por los mismos principios. No hay excepciones.

---

## 1. Inspiraciones (qué tomamos de cada uno)

### Apple → Human Interface Guidelines
- **Mucho espacio en blanco** (espacio negativo = lujo)
- **Tipografía como elemento principal** (peso, tamaño, espaciado > color)
- **Muy pocos colores** (máximo 3 de énfasis por pantalla)
- **Estados extremadamente claros** (activo/inactivo/hover/disabled sin ambigüedad)
- **Animaciones sutiles** (150–250 ms, nunca decorativas)
- **Componentes grandes y fáciles de tocar** (mínimo 44px de altura)
- **El contenido siempre tiene prioridad sobre los controles**

**Regla Apple**: No crear tarjetas porque sí. Si un dato puede vivir como texto, mejor texto.

---

### Linear → Consistencia obsesiva
Linear no destaca por ser bonito. Destaca por ser **increíblemente consistente**.

Todo usa:
- El mismo padding
- Los mismos radios
- Mismas alturas
- Mismas sombras
- Misma tipografía
- Mismos botones

**Regla Linear**: Si un botón mide 40 px, otro 44 px y otro 36 px, el sistema se rompe. Todo debe seguir la misma escala.

---

### Notion → Reducir ruido
Notion enseña algo importante: **reducir ruido visual**.

En Emet todavía existen demasiados elementos que compiten entre sí. Por ejemplo:
```
Vacaciones
↓
4 tarjetas
↓
alerta
↓
mensaje verde
↓
formulario
↓
configuración avanzada
↓
equipo
↓
gráfica
↓
historial
```

Todo tiene el mismo peso visual. Eso no ocurre en Notion. Ellos siempre tienen:
```
Título
↓
Acción principal
↓
Contenido
↓
Contenido secundario
↓
Opciones avanzadas
```

**Regla Notion**: Jerarquía clara. El ojo debe saber qué mirar primero, segundo, tercero.

---

### Stripe → Jerarquía implacable
Stripe domina la jerarquía. Nunca dudas qué debes hacer.

```
Botón principal azul
↓
Todo lo demás gris
```

En Emet todavía existen:
- Verde
- Azul
- Morado
- Gris

Todos compitiendo por atención.

**Regla Stripe**: Una sola acción principal por pantalla. Todo lo demás es secundario.

---

### Design for Humans → Empatía radical
Este es el más importante.

La pregunta siempre debe ser:
> **¿Qué necesita saber la persona en este momento?**

No:
> ¿Qué información tenemos?

**Ejemplo: Mi Jornada**

Hoy aparecen:
- Total laborado
- Tiempo extra
- Días registrados

Pero realmente el usuario necesita saber:
- Estoy trabajando
- Llevo 4h
- Me faltan 2h 50m
- Salgo a las 5:02

Todo lo demás puede quedar debajo.

**Regla Design for Humans**: Priorizar lo que el usuario necesita sobre lo que el sistema tiene.

---

## 2. Reglas obligatorias

### Regla 1: Eliminar antes que agregar
Si un componente no aporta valor, **se elimina**.

No agregamos más tarjetas, más botones, más secciones. Quitamos lo que sobra.

---

### Regla 2: Una sola acción principal por pantalla
Nunca dos botones importantes compitiendo.

```
✅ Correcto:
[ Guardar cambios ]  ← principal
Cancelar             ← secundario (gris)

❌ Incorrecto:
[ Guardar ]  [ Cancelar ]  [ Eliminar ]  ← tres acciones iguales
```

---

### Regla 3: Una sola fuente de atención
El ojo debe recorrer:
```
Título
↓
Dato importante
↓
Acción
↓
Detalles
```

Nunca veinte elementos iguales compitiendo.

---

### Regla 4: Menos tarjetas
Linear usa muchísimas menos tarjetas que la mayoría de dashboards. Apple también. Notion aún menos.

En Emet todavía hay secciones donde todo está dentro de una card. Eso hace que el sistema se vea pesado.

**Cuando usar tarjetas**:
- Agrupar información relacionada que necesita separación visual clara
- Contenido interactivo (formularios, listas de acciones)
- Datos que el usuario puede "mover" o "reordenar"

**Cuando NO usar tarjetas**:
- Texto simple (títulos, párrafos)
- Datos que pueden vivir como lista plana
- Información secundaria (puede ir como texto gris debajo)

---

### Regla 5: Padding consistente
Todo debe seguir una escala de 8 puntos:

```
4px   ← micro-espaciado (entre iconos pequeños)
8px   ← espaciado interno de componentes compactos
12px  ← padding de botones pequeños
16px  ← padding estándar de componentes
24px  ← espaciado entre secciones relacionadas
32px  ← espaciado entre secciones independientes
48px  ← espaciado entre bloques grandes
64px  ← espaciado entre páginas/módulos
```

**Nunca**: 17px, 21px, 29px. Siempre múltiplos de 4 (preferentemente 8).

---

### Regla 6: Tipografía antes que color
No depender del color para generar jerarquía.

La jerarquía se logra con:
- **Peso** (400, 500, 600, 700)
- **Tamaño** (12px, 14px, 16px, 20px, 24px, 32px)
- **Espaciado** (letter-spacing, line-height)

**Ejemplo**:
```
❌ Incorrecto (jerarquía por color):
Título (azul)
Subtítulo (verde)
Texto (gris)

✅ Correcto (jerarquía por tipografía):
Título (24px, 700, --text-1)
Subtítulo (16px, 500, --text-2)
Texto (14px, 400, --text-3)
```

---

### Regla 7: Mucho menos texto
Ejemplo:

```
❌ Incorrecto:
"Las incidencias autorizadas nunca generan falta en el registro de asistencia."

✅ Correcto:
"Autorizadas no descuentan asistencia."
```

**Principio**: Si puedes decirlo en 5 palabras, no uses 10.

---

### Regla 8: Tres preguntas en tres segundos
Toda pantalla debe responder:

1. **¿Dónde estoy?** (título de página, breadcrumb)
2. **¿Qué está pasando?** (dato principal, estado)
3. **¿Qué puedo hacer?** (acción principal)

Si alguna falla, la pantalla debe simplificarse.

---

## 3. Especificación visual

### Colores
- **Máximo 3 colores de énfasis por pantalla**
- Usar tokens del Design System (`--accent`, `--ok`, `--warn`, `--danger`)
- Nunca hardcodear colores (siempre `var(--token)`)
- El 80% de la pantalla debe ser neutro (grises, blancos)

### Tipografía
- **Escala**: 12 / 14 / 16 / 20 / 24 / 32 / 40 px
- **Pesos**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Inter** como fuente principal (ya configurado)
- **Line-height**: 1.5 para texto, 1.2 para títulos

### Espaciado
- **Escala de 8 puntos**: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px
- **Padding de componentes**: 16px (estándar), 12px (compacto), 24px (espaciado)
- **Gap entre elementos relacionados**: 8px
- **Gap entre secciones independientes**: 24–32px

### Radios
- **Componentes pequeños** (botones, inputs): 8–12 px
- **Tarjetas**: 12–16 px
- **Modales/Sheets**: 16–20 px
- **Nunca**: radios inconsistentes (si un botón es 8px, todos los botones son 8px)

### Sombras
- **Nivel 1** (sutil): `0 1px 2px rgba(0,0,0,0.05)` — cards en reposo
- **Nivel 2** (medio): `0 4px 12px rgba(0,0,0,0.08)` — cards en hover
- **Nivel 3** (fuerte): `0 12px 32px rgba(0,0,0,0.12)` — modales, dropdowns
- **Nunca**: sombras hardcodeadas (siempre tokens `--shadow-1`, `--shadow-2`, `--shadow-3`)

### Iconos
- **Lucide React** (ya configurado)
- **Stroke**: 2px (estándar), 1.5px (pequeños), 2.5px (grandes)
- **Tamaños**: 16px (inline), 20px (botones), 24px (títulos), 32px (ilustraciones)
- **Color**: siempre `currentColor` o `var(--text-2)` para iconos secundarios

---

## 4. Especificación UX

### Una acción primaria por vista
Cada pantalla tiene **una sola acción principal** (botón azul/primario). Todo lo demás es secundario (gris/terciario).

**Ejemplo**:
```
✅ Correcto:
[ Guardar cambios ]  ← primario (azul)
Cancelar             ← secundario (gris)

❌ Incorrecto:
[ Guardar ]  [ Cancelar ]  [ Eliminar ]  ← tres acciones iguales
```

### Máximo dos niveles de jerarquía visual
```
Nivel 1: Título principal + acción primaria
Nivel 2: Contenido + acciones secundarias
```

Nunca tres o más niveles compitiendo.

### Priorizar lectura antes que interacción
El usuario primero **lee**, luego **actúa**.

```
✅ Correcto:
Título claro
↓
Dato importante (grande, legible)
↓
Acción (botón)

❌ Incorrecto:
Formulario complejo
↓
Botones
↓
Texto explicativo al final
```

### Reducir clics, no agregar funciones
Si el usuario necesita 5 clics para hacer algo, podemos hacerlo en 2.

No agregamos más botones. Eliminamos pasos.

---

## 5. Especificación de contenido

### Títulos cortos
```
❌ Incorrecto:
"Registro de asistencia del empleado Juan Pérez"

✅ Correcto:
"Juan Pérez"
```

El contexto ya lo da la página (breadcrumb, URL).

### Texto mínimo
```
❌ Incorrecto:
"Las vacaciones autorizadas por el administrador no se descuentan del saldo de días disponibles."

✅ Correcto:
"Autorizadas no descuentan saldo."
```

### Números protagonistas
Los números deben ser **grandes, legibles, protagonistas**.

```
✅ Correcto:
4h 32m  ← grande, 32px, 700
Tiempo trabajado  ← pequeño, 14px, 400, --text-2

❌ Incorrecto:
Tiempo trabajado: 4h 32m  ← todo en el mismo tamaño
```

### Estados muy claros
Cada estado debe ser **visualmente obvio** sin necesidad de leer texto.

```
✅ Correcto:
● Trabajando (verde)
● En pausa (amarillo)
● Jornada terminada (gris)

❌ Incorrecto:
Trabajando  ← sin indicador visual
```

---

## 6. Especificación de movimiento

### Microanimaciones discretas
- **Duración**: 150–250 ms
- **Easing**: `cubic-bezier(0.22, 0.61, 0.36, 1)` (ya definido como `--ease`)
- **Propiedades animadas**: `opacity`, `transform`, `background` (nunca `width`, `height`, `margin`)

### Sin animaciones decorativas
Toda animación debe tener un **propósito funcional**:
- Confirmar una acción (check mark)
- Guiar la atención (fade in de contenido nuevo)
- Indicar estado (loading spinner)
- Suavizar transiciones (hover, focus)

**Nunca**: animaciones "porque se ve bonito".

### Todo debe sentirse fluido y natural
- **Hover**: 150ms ease
- **Focus**: 100ms ease
- **Click**: 100ms ease (active state)
- **Modal/Sheet**: 200ms ease-out (entrada), 150ms ease-in (salida)
- **Transiciones de página**: 250ms ease-in-out

---

## 7. Arquitectura del Design System

### Un único Design System para todo Emet
- **Mismos componentes** en todos los módulos
- **Mismos tokens** (colores, espaciados, radios, sombras)
- **Misma iconografía** (Lucide React)
- **Mismos patrones de interacción** (hover, focus, active, disabled)

### Ninguna pantalla nueva puede introducir un estilo diferente
Si una pantalla necesita un componente que no existe:
1. Primero se diseña como parte del Design System
2. Se documenta en `docs/design/`
3. Se implementa en `src/components/ui/`
4. Luego se usa en la pantalla

**Nunca**: crear un componente "solo para esta pantalla".

---

## 8. Checklist de revisión

Antes de aprobar cualquier pantalla nueva o cambio, verificar:

- [ ] ¿Responde las 3 preguntas en 3 segundos? (¿Dónde estoy? ¿Qué pasa? ¿Qué hago?)
- [ ] ¿Tiene una sola acción principal?
- [ ] ¿Usa menos de 3 colores de énfasis?
- [ ] ¿Sigue la escala de 8 puntos para espaciados?
- [ ] ¿Usa tokens del Design System (no hardcode)?
- [ ] ¿Tiene jerarquía visual clara (máximo 2 niveles)?
- [ ] ¿El texto es mínimo y claro?
- [ ] ¿Los números son protagonistas?
- [ ] ¿Las animaciones son funcionales (no decorativas)?
- [ ] ¿Usa componentes del Design System (no inventados)?

Si alguna falla, la pantalla debe simplificarse antes de mergear.

---

## 9. Ejemplos de aplicación

### Antes (Emet actual)
```
┌─────────────────────────────────────┐
│ [Tarjeta 1]                         │
│ Total laborado: 4h 32m              │
│                                     │
│ [Tarjeta 2]                         │
│ Tiempo extra: 1h 15m                │
│                                     │
│ [Tarjeta 3]                         │
│ Días registrados: 12                │
│                                     │
│ [Alerta verde]                      │
│ "Tu jornada va bien"                │
│                                     │
│ [Botón azul] [Botón gris] [Botón]   │
└─────────────────────────────────────┘
```

**Problemas**:
- 3 tarjetas compitiendo
- Alerta verde compitiendo con tarjetas
- 3 botones iguales
- Sin jerarquía clara

### Después (Emet Design Principles v1)
```
┌─────────────────────────────────────┐
│ Mi Jornada                          │
│                                     │
│ 4h 32m                              │
│ de 8h trabajadas                    │
│                                     │
│ Salgo a las 5:02 p.m.               │
│                                     │
│ [ Registrar salida ]                │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ Tiempo extra: 1h 15m                │
│ Días registrados: 12                │
└─────────────────────────────────────┘
```

**Mejoras**:
- Número protagonista (4h 32m, 32px, 700)
- Contexto claro (de 8h trabajadas)
- Dato útil (Salgo a las 5:02 p.m.)
- Una sola acción principal
- Información secundaria debajo (sin tarjetas)

---

## 10. Patrones de Diseño Implementados

### 10.1 Progressive Disclosure (Configuración)
**Principio**: Si el usuario no necesita editarlo en los próximos 5 segundos, no debería verlo abierto.

**Implementación**:
- Solo una sección expandida a la vez
- Sidebar con grupos colapsables
- Links rápidos integrados en el sidebar
- Dashboard de stats eliminado (no aporta contexto para configurar)

**Resultado**: Reducción de ~70% del ruido visual.

---

### 10.2 Estados Vacíos Compactos (Solicitudes)
**Principio**: Un estado vacío no debe parecer un error, debe guiar al usuario.

**Implementación**:
```
┌─────────────────────────────────────┐
│                                     │
│         [Icono 64px]                │
│                                     │
│      Todo está al día               │
│   Las nuevas solicitudes...         │
│                                     │
│  ┌─────────────┐  ┌─────────────┐  │
│  │ Tarjeta 1   │  │ Tarjeta 2   │  │
│  └─────────────┘  └─────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

**Reglas**:
- Icono de 64px en contenedor redondeado
- Mensaje humano ("Todo está al día" vs "Bandeja en cero")
- Ancho máximo de 360px para el texto
- Tarjetas informativas auxiliares opcionales

---

### 10.3 Tabs con Contadores (Solicitudes, Actividades)
**Principio**: Los contadores deben ser visibles pero no dominar.

**Implementación**:
```
┌──────────────────────────────────────────────┐
│  Por revisar (3)  │  Aprobadas (12)  │  ...  │
└──────────────────────────────────────────────┘
```

**Reglas**:
- Badge con contador a la derecha del texto
- Color de acento solo en tab activo
- Transición suave de 200ms al cambiar
- Padding consistente (16px horizontal, 12px vertical)

---

### 10.4 Vista Lista Tipo Notion (Actividades)
**Principio**: Las listas deben ser escaneables, no tarjetas grandes.

**Implementación**:
```
┌──────────────────────────────────────────────────────────────┐
│ Actividad              │ Estado    │ Responsable │ Entrega   │
├──────────────────────────────────────────────────────────────┤
│ Cobertura CERT         │ En curso  │ Jorge       │ 7 Ago     │
│ Diseño de lonas        │ Revisión  │ Angélica    │ 8 Ago     │
└──────────────────────────────────────────────────────────────┘
```

**Reglas**:
- Columnas con ancho fijo
- Hover sutil con cambio de fondo
- Acciones en hover (botón ⋯)
- Eliminadas líneas divisorias

---

### 10.5 Pipeline Inspirado en Plane (Actividades)
**Principio**: Las columnas deben respirar, las tarjetas deben ser compactas.

**Implementación**:
- Columnas de 300px de ancho
- Tarjetas con padding de 16px
- Bordes redondeados de 16px
- Colores semánticos por columna
- Scroll horizontal invisible

**Colores por estado**:
- 🔘 Solicitada → gris
- 🔵 Aprobada → azul
- 🟣 En progreso → morado
- 🟡 En revisión → amarillo
- 🟢 Completada → verde

---

### 10.6 Hero con Métrica Protagonista (Dashboard)
**Principio**: Una sola métrica debe dominar la pantalla.

**Implementación**:
```
┌─────────────────────────────────────┐
│ ¿Cómo va el día?                    │
│                                     │
│ ● Trabajando                        │
│ 3h 37min                            │
│                                     │
│ ████████████████░░░░░░░░            │
│ Entrada 8:12      52% del objetivo  │
│                                     │
│ ┌──────────┬──────────┬──────────┐ │
│ │ Salida   │ Restante │ Descanso │ │
│ │ 5:00 PM  │ 4h 23min │ 30 min   │ │
│ └──────────┴──────────┴──────────┘ │
│                                     │
│ [    Registrar salida    ]          │
└─────────────────────────────────────┘
```

**Reglas**:
- Título a 48px
- Métrica principal a 64px
- Barra de progreso de 8px
- Botón principal de 48px con sombra

---

### 10.6.1 Dashboard de Reportes con Métrica Protagonista
**Principio**: En dashboards analíticos, la métrica más importante debe ser el foco visual inmediato.

**Implementación**:
```
┌─────────────────────────────────────────────┐
│ Reportes                                    │
│ 126 solicitudes en total                    │
├─────────────────────────────────────────────┤
│                                             │
│  126                                        │
│  solicitudes                                │
│  ↑ 18% vs periodo anterior                  │
│                                             │
├─────────────────────────────────────────────┤
│  45           2.3h          8               │
│  Actividades  Tiempo prom.   Áreas          │
│  creadas      aprobación     solicitantes   │
├─────────────────────────────────────────────┤
│ Tendencia                                   │
│ ▁▂▃▅▆▇█▇▆▅  126 solicitudes en 8 semanas   │
├─────────────────────────────────────────────┤
│ Resumen                                     │
│ ┌────────────┬────────────┬────────────┐   │
│ │ Top        │ Área con   │ Cuello de  │   │
│ │ empleado   │ más carga  │ botella    │   │
│ │            │            │            │   │
│ │ Jorge      │ Comunicación│ Dirección │   │
│ │ 45.2h      │ 23 sol.    │ 2.3d prom. │   │
│ └────────────┴────────────┴────────────┘   │
└─────────────────────────────────────────────┘
```

**Reglas**:
- Métrica protagonista: 56px, bold, color primario
- Etiqueta descriptiva: 18px, medium, color secundario
- Tendencia con indicador: ↑/↓ + porcentaje
- KPIs secundarios en línea horizontal: 24px
- Separador visual entre secciones (border o espaciado 32px)
- Insights ejecutivos en grid de 3 columnas
- **NUNCA usar donuts** → reemplazar con barras horizontales
- Sparkline más grande (240x60px) para mejor legibilidad

**Ejemplo de código**:
```jsx
{/* Métrica protagonista */}
<div className="mb-8">
  <div className="flex items-baseline gap-3 mb-2">
    <span className="text-[56px] font-bold tabular-nums leading-none text-text-1">
      {totalReqs}
    </span>
    <span className="text-[18px] font-medium" style={{ color: "var(--text-2)" }}>
      solicitudes
    </span>
  </div>
  <div className="flex items-center gap-2 text-[14px]">
    <span style={{ color: trendUp ? "var(--ok)" : "var(--warn)" }}>
      {trendUp ? "↑" : "↓"} {trendPct}%
    </span>
    <span style={{ color: "var(--text-3)" }}>vs periodo anterior</span>
  </div>
</div>
```

---

### 10.6.2 Directorio de Personas con Buscador Spotlight
**Principio**: El buscador debe ser el protagonista en directorios y listas.

**Implementación**:
```
┌─────────────────────────────────────────────┐
│ Directorio                                  │
│                                             │
│ 🟢 18 activos · 20 colaboradores            │
├─────────────────────────────────────────────┤
│ 🔍 Buscar personas, cargos o departamentos │
├─────────────────────────────────────────────┤
│ [Todos (20)] [Equipo (15)] [Admin (2)] ... │
├─────────────────────────────────────────────┤
│ Equipo · 15                                 │
│ ┌─────────────────────────────────────────┐│
│ │ 👤 Jorge Martínez                       ││
│ │    Diseñador · Comunicación             ││
│ │                                    ⋯ ◉  ││
│ └─────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────┐│
│ │ 👤 Angélica Ramírez                     ││
│ │    Fotógrafa · Comunicación             ││
│ │                                    ⋯ ◉  ││
│ └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

**Reglas**:
- Título de página: 32px, bold
- Contadores con iconos de estado (🟢 activo, 🟡 incompleto)
- Buscador: 44px alto, icono de lupa, placeholder descriptivo
- Filtros: pills con contador, activo con fondo sólido y sombra
- Tarjetas: padding 20px, border-radius 16px, avatar 48px
- Nombre: 16px, bold, domina visualmente
- Metadata: 13px, color secundario
- Grupos: 32px de espaciado entre grupos
- Acciones: menú ⋯ + switch de estado

**Ejemplo de código**:
```jsx
{/* Buscador estilo Spotlight */}
<div className="relative mb-5">
  <svg className="absolute left-4 top-1/2 -translate-y-1/2" ...>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
  <input
    className="w-full h-11 pl-11 pr-4 rounded-xl text-[14px]"
    style={{ background: "var(--surface-2)", border: "1.5px solid var(--border)" }}
    placeholder="Buscar personas, cargos o departamentos..."
  />
</div>
```

---

### 10.6.3 Biblioteca con Lista Tipo Notion
**Principio**: Las listas de documentos/actividades deben ser escaneables, no tarjetas grandes.

**Implementación**:
```
┌─────────────────────────────────────────────┐
│ Biblioteca                                  │
│ Todo el conocimiento generado por el equipo │
├─────────────────────────────────────────────┤
│ 🔍 Buscar actividades, documentos...        │
├─────────────────────────────────────────────┤
│ [Todos (12)] [Cobertura (5)] [Video (4)]   │
├─────────────────────────────────────────────┤
│ Actividad        │ Tipo      │ Responsable  │
│ ─────────────────────────────────────────── │
│ Cobertura CERT   │ Completado│ Jorge        │
│ Comunicación     │           │ 7 Ago        │
│ ─────────────────────────────────────────── │
│ Diseño lonas     │ Completado│ Angélica     │
│ Admisiones       │           │ 5 Ago        │
└─────────────────────────────────────────────┘
```

**Reglas**:
- Título: 32px, bold
- Subtítulo descriptivo: 15px, color secundario
- Buscador: 44px alto, icono de lupa
- Filtros: pills discretos con contadores
- Lista tipo tabla: columnas con ancho fijo
- Hover: cambio de fondo sutil
- Título de actividad: 15px, semibold, hover cambia a color de acento
- Metadata: 12px, color terciario
- Badges de tipo: color semántico (verde para completado)

**Estado vacío**:
- Icono: 64px en contenedor redondeado
- Mensaje humano: "Aún no hay actividades archivadas"
- Descripción: max-width 360px
- Sin tarjetas innecesarias

---

### 10.7 Tarjetas con Hover Elevado
**Principio**: Las tarjetas deben responder al hover de forma sutil.

**Implementación**:
```css
.card {
  transition: all 200ms ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: var(--border-2);
}
```

**Reglas**:
- Elevación de 2px
- Sombra suave
- Borde ligeramente más visible
- Transición de 200ms

---

### 10.8 Badges Semánticos
**Principio**: Los colores deben comunicar estado, no decorar.

**Colores**:
- 🔴 Danger/Error → `var(--danger)`
- 🟡 Warning/Advertencia → `var(--warn)`
- 🟢 Success/Éxito → `var(--ok)`
- 🔵 Info/Interacción → `var(--accent)`
- 🟣 Especial/Destacado → `var(--purple)`
- ⚪ Neutral/Inactivo → `var(--text-3)`

**Implementación**:
```jsx
<span 
  className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
  style={{ 
    background: "var(--ok-tint)", 
    color: "var(--ok)" 
  }}
>
  Completado
</span>
```

---

### 10.9 Animaciones y Transiciones
**Principio**: Las animaciones deben ser sutiles y funcionales.

**Duraciones**:
- Hover: 200ms
- Click: 100ms
- Transición de página: 250ms
- Modal/Sheet entrada: 200ms
- Modal/Sheet salida: 150ms

**Easing**:
```css
--ease: cubic-bezier(0.22, 0.61, 0.36, 1);
--spring: cubic-bezier(0.34, 1.4, 0.64, 1);
```

**Propiedades animables**:
- `opacity`
- `transform`
- `background`
- `border-color`
- `box-shadow`

**Nunca animar**:
- `width`
- `height`
- `margin`
- `padding`

---

### 10.10 Tipografía con Contraste
**Principio**: Debe haber diferencia clara entre niveles.

**Escala**:
- **Display**: 48px, 700 weight (títulos hero)
- **Title**: 32px, 700 weight (títulos de página)
- **Heading**: 22px, 600 weight (subtítulos)
- **Body**: 15px, 500 weight (texto principal)
- **Small**: 13px, 500 weight (metadata)
- **Tiny**: 11px, 600 weight (labels, badges)

**Ejemplo de jerarquía**:
```
¿Cómo va el día?           (48px, 700)
3h 37min                   (64px, 700)
Trabajando                 (22px, 600)
Entrada 8:12               (13px, 500)
```

---

## 11. Implementación

### Fase 1: Auditoría (semana 1)
Revisar todas las pantallas actuales contra este documento. Listar violaciones.

### Fase 2: Refactor crítico (semanas 2-4)
Arreglar las violaciones más graves:
- Inconsistencias de espaciado
- Múltiples acciones principales
- Exceso de tarjetas
- Texto innecesario

### Fase 3: Documentación (semana 5)
Crear Storybook o documentación visual de todos los componentes del Design System.

### Fase 4: Mantenimiento (continuo)
Cada PR nuevo debe pasar el checklist de revisión (sección 8).

---

## Conclusión

Emet dejará de sentirse como un conjunto de pantallas y empezará a percibirse como un **producto cohesionado y de nivel profesional**.

Esto no es opcional. Es la especificación obligatoria para todo el proyecto.

---

**Versión**: 1.0  
**Fecha**: 04 Ago 2026  
**Autor**: Samuel Chan (fundador de Emet)  
**Estado**: Aprobado — obligatorio para todo el equipo
