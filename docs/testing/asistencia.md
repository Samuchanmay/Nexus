# Casos de Prueba — Asistencia

> Casos extremos para validar la lógica de asistencia.  
> Última actualización: 04 Ago 2026

---

## Caso 1: Angélica en vacaciones 3 días

**Escenario**: Angélica tiene vacaciones aprobadas del 5 al 7 de agosto.

**Validar**:
- [ ] No aparece como "falta injustificada" en esos días
- [ ] Estado muestra "Vacaciones" (badge morado)
- [ ] No puede fichar entrada/salida en esos días
- [ ] Aparece en calendario como "Vacaciones"
- [ ] Reporte semanal muestra "VACACIONES" como motivo

---

## Caso 2: Samuel en evento nocturno

**Escenario**: Samuel tiene evento "Graduación Enfermería" de 6pm a 2am en Hotel Fiesta.

**Validar**:
- [ ] Evento muestra hora inicio (18:00) y hora fin (02:00)
- [ ] GPS valida contra ubicación del hotel, no de la oficina
- [ ] Check-in registra "Iniciar cobertura" a las 18:01
- [ ] Check-out registra "Finalizar cobertura" a las 02:00
- [ ] Duración calculada: 8 horas (cruce de medianoche)
- [ ] No genera "falta injustificada" al día siguiente

---

## Caso 3: Citlaly olvida salida, admin corrige

**Escenario**: Citlaly fichó entrada a las 8:00 pero olvidó fichar salida. Al día siguiente, el admin corrige.

**Validar**:
- [ ] Estado muestra "No registró salida" (badge rojo)
- [ ] Admin ve botón "Corregir" en la tarjeta de Citlaly
- [ ] Admin selecciona fecha del día anterior
- [ ] Admin ingresa hora de salida: 17:30
- [ ] Admin guarda con motivo "Olvidó registrar"
- [ ] Se registra en `attendance_corrections`:
  - admin_id: ID del admin
  - action: "Agregó salida: 17:30"
  - details: "Motivo: Olvidó registrar"
  - created_at: timestamp
- [ ] Estado cambia a "Jornada terminada"
- [ ] Citlaly ve la corrección en su historial

---

## Caso 4: Jorge renuncia

**Escenario**: Jorge renuncia el 10 de agosto.

**Validar**:
- [ ] Se marca `active = false` en tabla `users`
- [ ] No puede iniciar sesión
- [ ] Sus chats quedan visibles para el equipo (no se eliminan)
- [ ] Sus proyectos muestran "Jorge (inactivo)"
- [ ] Su asistencia histórica se conserva
- [ ] No aparece en lista de empleados activos
- [ ] Reportes históricos lo incluyen, reportes futuros no

---

## Caso 5: Dos admins editan al mismo tiempo

**Escenario**: Admin A y Admin B editan la asistencia de Samuel al mismo tiempo.

**Validar**:
- [ ] Admin A abre modal de edición, cambia entrada a 8:15
- [ ] Admin B abre modal de edición, cambia entrada a 8:20
- [ ] Admin A guarda primero → éxito
- [ ] Admin B guarda después → éxito (sobrescribe)
- [ ] Se registran DOS entradas en `attendance_corrections`
- [ ] Valor final es el de Admin B (8:20)
- [ ] Ambos logs muestran quién cambió qué

---

## Caso 6: Empleado pierde internet al fichar

**Escenario**: Samuel está fichando entrada y pierde internet.

**Validar**:
- [ ] UI muestra "Sin conexión" (pill rojo)
- [ ] Fichaje se guarda en `use-outbox` (IndexedDB)
- [ ] Cuando recupera internet, se sincroniza automáticamente
- [ ] Se muestra confirmación "Entrada registrada"
- [ ] Si no recupera internet en 5 min, se muestra "Pendiente de sincronizar"

---

## Caso 7: Jornada cruza medianoche

**Escenario**: Evento de 10pm a 3am.

**Validar**:
- [ ] Entrada: 22:00 (día 1)
- [ ] Salida: 03:00 (día 2)
- [ ] Duración: 5 horas
- [ ] No genera "falta injustificada" al día siguiente
- [ ] Reporte muestra las horas correctas en el día del evento

---

## Caso 8: Permiso de medio día

**Escenario**: Samuel tiene permiso de 1pm a 5pm.

**Validar**:
- [ ] Mañana: puede fichar entrada normalmente
- [ ] Tarde: estado muestra "Permiso" (badge amarillo)
- [ ] No genera "falta injustificada" por no fichar salida
- [ ] Reporte muestra "PERMISO" como motivo

---

## Caso 9: Día inhábil + evento

**Escenario**: 15 de septiembre es feriado, pero hay evento "Ceremonia patria".

**Validar**:
- [ ] Día inhábil tiene prioridad sobre evento
- [ ] Estado muestra "Día inhábil" (badge gris)
- [ ] Participantes del evento pueden fichar si trabajan
- [ ] No participantes ven "Día inhábil"

---

## Caso 10: Empleado olvida fichar entrada

**Escenario**: Citlaly llega tarde y olvida fichar entrada, pero sí ficha salida.

**Validar**:
- [ ] Sistema detecta: hay salida pero no entrada
- [ ] Estado muestra "Sin iniciar" (no "falta injustificada")
- [ ] Admin puede corregir y agregar entrada manualmente
- [ ] Se registra en `attendance_corrections`

---

## Caso 11: Jornada mayor a 16 horas

**Escenario**: Admin intenta corregir salida a las 2am del día siguiente (entrada fue a las 8am).

**Validar**:
- [ ] Sistema calcula: 18 horas
- [ ] Muestra alerta: "Jornada mayor a 16 horas"
- [ ] Pide confirmación: "¿Es correcto?"
- [ ] Si confirma, guarda con nota "Jornada extendida"
- [ ] Se registra en `attendance_corrections` con detalles

---

## Caso 12: Salida anterior a entrada

**Escenario**: Admin ingresa entrada 8:00 AM, salida 1:30 AM (error de AM/PM).

**Validar**:
- [ ] Sistema detecta: salida (01:30) < entrada (08:00)
- [ ] Muestra alerta: "La salida es anterior a la entrada"
- [ ] Sugiere: "¿Querías decir 1:30 PM?"
- [ ] Botones: "Cambiar a PM" | "Mantener AM"
- [ ] Si cambia a PM, guarda 13:30
- [ ] Si mantiene AM, bloquea el guardado

---

## Caso 13: Empleado en home office

**Escenario**: Samuel tiene incidencia "home_office" aprobada.

**Validar**:
- [ ] Estado muestra "Home office" (badge azul)
- [ ] No requiere GPS (puede fichar desde cualquier ubicación)
- [ ] No genera "falta injustificada"
- [ ] Reporte muestra "HOME OFFICE"

---

## Caso 14: Evento externo sin GPS

**Escenario**: Evento en lugar sin señal GPS.

**Validar**:
- [ ] Admin puede activar "Permitir check-in sin GPS" para ese evento
- [ ] Participantes pueden fichar sin validar ubicación
- [ ] Se registra nota: "Check-in sin validación GPS"

---

## Caso 15: Empleado cambia de departamento

**Escenario**: Angélica cambia de "Enfermería" a "Comunicación".

**Validar**:
- [ ] Historial de asistencia se conserva
- [ ] Nuevos registros muestran departamento "Comunicación"
- [ ] Reportes históricos muestran ambos departamentos
- [ ] Calendario muestra el cambio

---

## Checklist de Auditoría

Antes de mergear cambios en asistencia:

- [ ] Vacaciones no generan falta
- [ ] Permisos no generan falta
- [ ] Días inhábiles no generan falta
- [ ] Eventos externos permiten check-in fuera de oficina
- [ ] Admin puede editar cualquier día
- [ ] Empleado no puede editar historial
- [ ] Toda edición se registra en `attendance_corrections`
- [ ] Zona horaria America/Merida
- [ ] Formato dd/mm/aaaa en UI
- [ ] Formato 24h en BD
- [ ] Cruce de medianoche funciona
- [ ] Jornada >16h alerta
- [ ] Salida < entrada alerta
- [ ] Renuncia conserva historial
- [ ] Cambio de departamento conserva historial
