# Emet · Visión

## Qué es

Emet es un **sistema operativo para organizaciones**: una plataforma web única donde un equipo vive su trabajo diario. Un solo lugar para **comunicarse** (chat con estados de entrega, reacciones, imágenes, ubicación), **operar** (solicitudes → proyectos → checklist → evidencias), **gestionar el tiempo** (checado de entrada/salida, jornada, vacaciones, incidencias, asistencia) y **colaborar** (calendario compartido, directorio, biblioteca).

Nació como la herramienta interna del Departamento de Comunicación de CERT (Mérida) y evolucionó hasta ser un **producto general**: Emet ya no es "de CERT", es un sistema operativo empresarial reutilizable.

## El problema que resuelve

Un equipo pequeño vive en 6 herramientas a la vez: un chat para hablar, un Excel para vacaciones, otro Excel para horarios, un Google Calendar, correos para solicitudes y Drive para entregables. El resultado: **el contexto está fragmentado y nada se recuerda**.

Emet concentra ese contexto en un solo lugar con memoria: quién pidió qué, cuándo se aprobó, cuánto tiempo se invirtió, quién está de vacaciones, qué entregable falta. No es "otra app": es la base sobre la que vive el trabajo.

## Principios de visión

1. **Un solo sistema, no una colección de apps.** Todos los módulos comparten shell, paleta, componentes, navegación y tono. Nadie debería poder adivinar dónde termina un módulo y empieza otro.
2. **El tiempo es un ciudadano de primera clase.** Checar entrada, saber cuántas horas lleva el día, vacaciones e incidencias no son trámites: son el pulso del equipo.
3. **Diseñado para humanos, no para administradores.** La interfaz le habla a una persona con prisas, no a un sistema de control.
4. **Soberano sobre sus datos.** Emet corre sobre Supabase (Postgres + RLS). El equipo es dueño de sus datos; nada se sube a terceros sin necesidad.
5. **Hecho con calma, a propósito.** Cada pantalla se construye con intención (ver `02-BLUEPRINT.md` y `docs/design/`). Sin "sprint de funcionalidades" a costa del pulido.

## Qué NO es Emet

- **No es un ERP**: no inventa contabilidad, nómina ni inventarios.
- **No es un CRM**: no modela clientes ni pipelines de ventas.
- **No es un chat standalone**: el chat es un módulo más; usa el mismo diseño y el mismo login que el resto.
- **No es un módulo de RH**: la gestión de vacaciones vive aquí, pero es una pieza del sistema de tiempo, no un subsistema aislado.

## Qué NO hará nunca

- No tendrá anuncios ni venta de datos.
- No romperá el sistema de diseño para "hacer una excepción" en una pantalla.
- No añadirá una dependencia externa sin justificación documentada (ver `EMET_CANON.md`).
- No abandonará el modelo single-tenant a medias: si se migra a multi-tenant, será con `organization_id` global y RLS vía `my_org_id()` en una migración planeada (ver ADR-0003).
