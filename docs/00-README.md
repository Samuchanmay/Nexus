# Emet · Documentación

> **Emet es un sistema operativo para organizaciones.** Centraliza comunicación, operación, gestión del tiempo y colaboración en un solo lugar, con un solo login (Google) y un solo dominio (`emet.uno`). No es un ERP, ni un CRM, ni un chat, ni un RH: **integra módulos** y todos deben sentirse parte del mismo sistema — nunca parecer aplicaciones diferentes.

## Índice

| Doc | Qué contiene |
|---|---|
| [`01-VISION.md`](01-VISION.md) | Por qué existe Emet, qué resuelve, qué NO hará nunca |
| [`02-BLUEPRINT.md`](02-BLUEPRINT.md) | La filosofía completa del producto y de la experiencia |
| [`03-ROADMAP.md`](03-ROADMAP.md) | Qué existe, qué falta, qué viene (fases) |
| [`EMET_CANON.md`](EMET_CANON.md) | Reglas inmutables del proyecto — máxima autoridad |
| [`INSPIRATION.md`](INSPIRATION.md) | Referentes de diseño y qué se toma de cada uno |
| [`DECISIONES-PENDIENTES.md`](DECISIONES-PENDIENTES.md) | Documento vivo de lo que está sin decidir |

### Arquitectura · `architecture/`

`ARCHITECTURE.md` · `STACK.md` · `DATABASE.md` · `API.md` · `PERMISSIONS.md` · `STATE.md` · `EVENTS.md` · `PERFORMANCE.md`

### Diseño · `design/`

`DESIGN_PRINCIPLES.md` · `DESIGN_SYSTEM.md` · `DESIGN_FOR_HUMANS.md` · `MOTION.md` · `COLORS.md` · `TYPOGRAPHY.md` · `ICONOGRAPHY.md` · `EMOJIS.md` · `COMPONENTS.md` · `SPACING.md` · `SHADOWS.md` · `BORDERS.md` · `PICKERS.md` · `FORMS.md` · `EMPTY_STATES.md` · `TABLES.md` · `CARDS.md` · `MOBILE.md` · `DESKTOP.md` · `ACCESSIBILITY.md` · `COPYWRITING.md`

### Módulos · `modules/`

`CHAT.md` · `ACTIVITIES.md` · `CALENDAR.md` · `REQUESTS.md` · `TIME.md` · `REPORTS.md` · `PEOPLE.md` · `SETTINGS.md` · `ONBOARDING.md` · `INCIDENTS.md` · `RECORRIDOS.md`

### Código · `coding/`

`CODE_STYLE.md` · `FILE_STRUCTURE.md` · `COMPONENT_GUIDE.md` · `NAMING.md` · `TYPESCRIPT.md` · `REACT.md` · `SUPABASE.md` · `TESTING.md` · `SECURITY.md` · `AI_RULES.md`

### Decisiones · `decisions/`

`ADR-0001.md` … `ADR-0015.md` (Architecture Decision Records en orden cronológico)

### Historial · `changelog/`

`CHANGELOG.md` · `MIGRATIONS.md`

## Cómo usar estos documentos

1. **Antes de escribir código, lee** [`EMET_CANON.md`](EMET_CANON.md) y [`AI_RULES.md`](coding/AI_RULES.md). Son obligatorios, no sugerencias.
2. **Antes de tocar un módulo**, lee su doc en `modules/` y el ADR que lo originó.
3. **Antes de proponer una pantalla o flujo nuevo**, lee `design/` (en especial `DESIGN_FOR_HUMANS.md` y `COPYWRITING.md`).
4. **Todo cambio se documenta**: ADR si hay decisión, `changelog/CHANGELOG.md` siempre, `03-ROADMAP.md` si afecta lo planeado.

## Estado de la documentación

Esta documentación se generó a partir del código real del repositorio en agosto de 2026 y se mantiene en vivo: cualquier cambio que contradiga estos documentos es un bug que debe corregirse en los documentos.
