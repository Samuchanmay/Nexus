# Casos de Prueba — Calendario y Eventos

> Casos extremos para validar la lógica de calendario y eventos.  
> Última actualización: 04 Ago 2026

---

## Caso 1: Evento con hora inicio/fin

**Escenario**: Admin crea evento "Graduación" de 6pm a 1am.

**Validar**:
- [ ] Formulario permite seleccionar hora (no solo fecha)
- [ ] Evento muestra "15 Ago 6:00 PM → 16 Ago 1:00 AM"
- [ ] Duración calculada: 7 horas
- [ ] Aparece en calendario con franja horaria
- [ ] Notificación a participantes incluye hora

---

## Caso 2: Evento con cliente y departamento

**Escenario**: Admin crea evento para cliente "Hospital Juárez" solicitado por "Enfermería".

**Validar**:
- [ ] Formulario tiene campos: cliente, departamento solicitante
- [ ] Evento muestra "Cliente: Hospital Juárez"
- [ ] Evento muestra "Solicitante: Enfermería"
- [ ] Reporte puede filtrar por departamento
- [ ] Reporte puede filtrar por cliente

---

## Caso 3: Evento externo con ubicación

**Escenario**: Admin crea evento en "Hotel Fiesta Americana" con dirección y GPS.

**Validar**:
- [ ] Formulario permite seleccionar "Externo"
- [ ] Campos: nombre del lugar, dirección, coordenadas GPS
- [ ] Mapa muestra la ubicación (si hay integración)
- [ ] GPS de participantes valida contra ubicación del evento
- [ ] Radio de validación: 150m (configurable)

---

## Caso 4: Evento con responsable y participantes

**Escenario**: Admin asigna a Samuel como responsable y a Angélica, Citlaly, Jorge como equipo.

**Validar**:
- [ ] Formulario tiene campo "Responsable" (1 persona)
- [ ] Formulario tiene campo "Equipo asignado" (N personas)
- [ ] Samuel ve "Responsable" en el evento
- [ ] Angélica, Citlaly, Jorge ven "Participante"
- [ ] Todos reciben notificación
- [ ] Cada uno puede hacer su propio check-in

---

## Caso 5: Evento con estado pendiente/confirmado/cancelado

**Escenario**: Admin crea evento en estado "pendiente".

**Validar**:
- [ ] Evento aparece como "Pendiente" (badge amarillo)
- [ ] Admin puede cambiar a "Confirmado"
- [ ] Admin puede cambiar a "Cancelado"
- [ ] Participantes reciben notificación al cambiar estado
- [ ] Evento cancelado no permite check-in

---

## Caso 6: Evento con prioridad alta/media/baja

**Escenario**: Admin crea evento con prioridad "alta".

**Validar**:
- [ ] Formulario tiene campo "Prioridad"
- [ ] Evento muestra indicador visual (rojo = alta)
- [ ] Reporte puede filtrar por prioridad
- [ ] Notificación menciona la prioridad

---

## Caso 7: Evento nocturno cruza medianoche

**Escenario**: Evento de 10pm a 3am.

**Validar**:
- [ ] Sistema calcula duración correctamente (5 horas)
- [ ] Check-in registra fecha/hora exacta
- [ ] Check-out registra fecha/hora exacta (día siguiente)
- [ ] No genera "falta injustificada" al día siguiente
- [ ] Reporte muestra las horas en el día del evento

---

## Caso 8: Participante hace check-in en evento

**Escenario**: Samuel llega al evento "Graduación" y hace check-in.

**Validar**:
- [ ] UI muestra "Iniciar cobertura" (no "Registrar entrada")
- [ ] GPS valida contra ubicación del evento
- [ ] Se registra en `event_attendance` (no en `attendance`)
- [ ] Hora de check-in: 18:01
- [ ] Estado del participante: "Presente"
- [ ] Admin ve quién llegó en tiempo real

---

## Caso 9: Participante finaliza cobertura

**Escenario**: Samuel termina el evento y hace check-out.

**Validar**:
- [ ] UI muestra "Finalizar cobertura"
- [ ] Se registra hora de check-out: 02:00
- [ ] Duración calculada: 7h 59m
- [ ] Se guarda en `event_attendance`
- [ ] Admin ve duración de cada participante

---

## Caso 10: Evento sincronizado con Google Calendar

**Escenario**: Admin activa "Sincronizar con Google Calendar" al crear evento.

**Validar**:
- [ ] Evento se crea en Google Calendar
- [ ] Si se edita en Emet, se actualiza en Google
- [ ] Si se elimina en Emet, se elimina en Google
- [ ] Si se edita en Google, se actualiza en Emet (webhook)
- [ ] Participantes ven el evento en sus calendarios personales

---

## Caso 11: Evento de Google Calendar (solo lectura)

**Escenario**: Evento viene de Google Calendar (no creado en Emet).

**Validar**:
- [ ] Evento aparece en calendario de Emet
- [ ] No se puede editar desde Emet
- [ ] Muestra ícono de Google
- [ ] Si se elimina en Google, desaparece en Emet

---

## Caso 12: Dos eventos al mismo tiempo para el mismo participante

**Escenario**: Samuel está asignado a "Graduación" y "Examen Profesional" al mismo tiempo.

**Validar**:
- [ ] Sistema alerta al admin: "Conflicto de horario"
- [ ] Samuel ve ambos eventos en su agenda
- [ ] Puede hacer check-in en cualquiera
- [ ] Reporte muestra el conflicto

---

## Caso 13: Evento cancelado después de check-in

**Escenario**: Samuel hizo check-in en evento, pero el evento se cancela.

**Validar**:
- [ ] Evento aparece como "Cancelado"
- [ ] Check-in de Samuel se conserva (historial)
- [ ] Se registra en auditoría: "Evento cancelado"
- [ ] Participantes reciben notificación

---

## Caso 14: Evento recurrente (semanal)

**Escenario**: Admin crea "Junta semanal" cada lunes.

**Validar**:
- [ ] Formulario permite seleccionar recurrencia
- [ ] Se crean múltiples instancias del evento
- [ ] Cada instancia es independiente
- [ ] Se puede cancelar una instancia sin afectar las demás
- [ ] Participantes reciben notificación de cada instancia

---

## Caso 15: Plantilla de evento

**Escenario**: Admin crea plantilla "Graduación" con campos prellenados.

**Validar**:
- [ ] Admin puede guardar evento como plantilla
- [ ] Al crear nuevo evento, puede seleccionar plantilla
- [ ] Campos se prellenan (cliente, ubicación, equipo)
- [ ] Solo cambia fecha/hora
- [ ] Plantillas se pueden editar/eliminar

---

## Checklist de Auditoría

Antes de mergear cambios en calendario/eventos:

- [ ] Eventos tienen hora inicio/fin
- [ ] Eventos tienen cliente y departamento
- [ ] Eventos tienen responsable y participantes
- [ ] Eventos pueden ser internos o externos
- [ ] Eventos externos tienen ubicación completa
- [ ] Eventos tienen estado (pendiente/confirmado/cancelado)
- [ ] Eventos tienen prioridad (alta/media/baja)
- [ ] Check-in en evento valida GPS contra ubicación del evento
- [ ] Check-in se registra en `event_attendance`
- [ ] Sincronización con Google Calendar funciona
- [ ] Eventos de Google son solo lectura en Emet
- [ ] Conflictos de horario se alertan
- [ ] Eventos nocturnos cruzan medianoche correctamente
- [ ] Eventos recurrentes funcionan
- [ ] Plantillas de eventos funcionan
