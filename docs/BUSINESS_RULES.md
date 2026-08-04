# Reglas de Negocio — EMET

> Fuente de verdad para todas las reglas de negocio del sistema.  
> Última actualización: 04 Ago 2026  
> Status: Vivo — se actualiza con cada decisión de negocio.

---

## Principios Fundamentales

1. **Nunca perder datos**: toda edición queda registrada, nunca se sobrescribe.
2. **Jerarquía clara**: empleado < supervisor < administrador < sistema.
3. **Consistencia temporal**: todo en zona horaria America/Merida, formato 24h interno, 12h UI.
4. **Transparencia**: todo cambio es auditable (quién, cuándo, qué, por qué).

---

## Asistencia

### Regla 1: Vacaciones nunca generan falta
Un empleado con vacaciones aprobadas **nunca** puede aparecer como "falta injustificada".

**Prioridad**: `vacaciones` > `permiso` > `incapacidad` > `día inhábil` > `evento externo` > `home office` > `oficina` > `ausencia`.

### Regla 2: Día inhábil nunca genera retardo
Si el día es feriado oficial o día de descanso, no hay penalización por no fichar.

### Regla 3: Evento externo permite check-in fuera de oficina
Si existe un evento externo asignado al empleado, el GPS valida contra la ubicación del evento (radio 150m), no contra la oficina.

### Regla 4: Administrador puede modificar cualquier movimiento
El admin puede editar entrada/salida/comida de cualquier empleado, cualquier día.

### Regla 5: Empleado nunca puede modificar movimientos históricos
El empleado solo puede fichar en tiempo real. No puede editar fichajes pasados.

### Regla 6: Toda edición queda registrada
Cada corrección se guarda en `attendance_corrections` con: admin_id, fecha, acción, detalles, motivo, timestamp.

### Regla 7: Salida anterior a entrada es error
Si la hora de salida es menor que la hora de entrada, el sistema debe alertar y sugerir corrección (AM/PM).

### Regla 8: Jornada mayor a 16 horas es sospechosa
Si la duración calculada >16h, el sistema debe alertar antes de guardar.

### Regla 9: No registrar salida = estado crítico
Si un empleado fichó entrada pero no salida al final del día, el estado es `no_registro_salida` (prioridad 100, la más alta).

---

## Eventos

### Regla 10: Evento tiene hora, no solo fecha
Todo evento debe tener `start_time` y `end_time`, no solo fechas.

### Regla 11: Evento tiene responsable y participantes
Todo evento tiene:
- **Responsable principal** (1 persona, obligatoria)
- **Equipo asignado** (N personas, opcional)

### Regla 12: Evento tiene departamento solicitante
Todo evento debe identificar qué departamento lo solicitó (Dirección, Comunicación, Enfermería, etc.).

### Regla 13: Evento puede ser interno o externo
- **Interno**: dentro del CERT, GPS valida contra oficina.
- **Externo**: fuera del CERT, GPS valida contra ubicación del evento.

### Regla 14: Evento externo tiene ubicación completa
Si es externo, debe tener: nombre del lugar, dirección, coordenadas GPS (lat/lng).

### Regla 15: Evento tiene estado
Todo evento tiene estado: `pendiente` | `confirmado` | `cancelado`.

### Regla 16: Evento tiene prioridad
Todo evento tiene prioridad: `alta` | `media` | `baja`.

### Regla 17: Participante recibe notificación
Cuando se asigna un participante a un evento, recibe notificación push.

### Regla 18: Check-in de evento vincula asistencia
Cuando un participante hace check-in en un evento, se registra en `event_attendance`, no en `attendance` (oficina).

---

## Vacaciones

### Regla 19: Vacaciones deben ser aprobadas
Vacaciones en estado `Pendiente` no cuentan como aprobadas. Solo `Aprobada` bloquea falta.

### Regla 20: Vacaciones no se pueden editar por empleado
Una vez solicitadas, solo el admin puede aprobar/rechazar/editar.

### Regla 21: Vacaciones generan notificación al equipo
Cuando se aprueban vacaciones, el equipo ve "Vacaciones" en el calendario.

---

## Permisos

### Regla 22: Permiso autorizado no genera falta
Si el permiso está en estado `Autorizado`, no genera falta injustificada.

### Regla 23: Permiso tiene tipo
Tipos: `permiso`, `incapacidad`, `comision`, `home_office`, `falta_justificada`.

---

## Chat

### Regla 24: Empleado puede editar sus mensajes (solo propios)
El empleado solo puede editar mensajes que él envió, dentro de los primeros 15 minutos.

### Regla 25: Administrador puede eliminar cualquier mensaje
El admin puede eliminar cualquier mensaje de cualquier conversación (moderación).

### Regla 26: Mensaje eliminado queda registrado
No se borra físicamente, se marca `deleted_at` y se muestra "Mensaje eliminado".

### Regla 27: Chat en tiempo real
Los mensajes deben llegar en tiempo real vía Supabase Realtime. Si falla, se recarga al entrar.

---

## Google Calendar

### Regla 28: Sincronización bidireccional (pendiente)
Si el usuario vinculó Google Calendar, los eventos se sincronizan en ambas direcciones.

### Regla 29: Evento de Google no se puede editar en Emet
Si el evento viene de Google Calendar, es de solo lectura en Emet.

### Regla 30: Evento de Emet se puede exportar a Google
Si el usuario activa "Sincronizar con Google", el evento se crea en Google Calendar.

---

## Usuarios

### Regla 31: Usuario eliminado conserva historial
Si un empleado renuncia, sus datos históricos (asistencia, chats, proyectos) se conservan pero se marca `active = false`.

### Regla 32: Usuario eliminado no puede acceder
Si `active = false`, no puede iniciar sesión ni ver datos.

### Regla 33: Cambio de departamento no borra datos
Si un empleado cambia de departamento, su historial se mantiene, solo cambia el departamento actual.

---

## Proyectos

### Regla 34: Proyecto tiene responsable y equipo
Todo proyecto tiene:
- **Responsable** (1 persona)
- **Equipo** (N personas)

### Regla 35: Proyecto tiene fechas
Todo proyecto tiene `start_date` y `deadline`.

### Regla 36: Proyecto terminado no se puede editar
Si `status = completado`, no se puede editar (solo leer).

---

## Auditoría

### Regla 37: Todo cambio crítico se registra
Acciones que se registran en `admin_logs`:
- Editar asistencia
- Aprobar/rechazar vacaciones
- Crear/editar/eliminar eventos
- Eliminar mensajes
- Cambiar roles

### Regla 38: Log incluye quién, cuándo, qué, por qué
Cada log tiene: `admin_id`, `action`, `details`, `created_at`.

---

## Transiciones de Estado

### Asistencia
```
sin_iniciar → trabajando (fichar entrada)
trabajando → pausa (fichar pausa)
pausa → trabajando (fichar regreso)
trabajando → jornada_terminada (fichar salida)
trabajando → no_registro_salida (si pasa fin del día sin salida)
```

**Transiciones prohibidas**:
- `vacaciones` → `trabajando` (no puede fichar si está de vacaciones)
- `incapacidad` → `trabajando` (no puede fichar si está incapacitado)
- `sin_iniciar` → `jornada_terminada` (debe pasar por `trabajando`)

### Eventos
```
pendiente → confirmado (admin confirma)
pendiente → cancelado (admin cancela)
confirmado → cancelado (admin cancela)
```

**Transiciones prohibidas**:
- `cancelado` → `confirmado` (una vez cancelado, no se reactiva)

### Vacaciones
```
Pendiente → Aprobada (admin aprueba)
Pendiente → Rechazada (admin rechaza)
Aprobada → Cancelada (admin o empleado cancela)
```

---

## Casos Extremos

### Caso 1: Empleado olvida fichar salida
**Solución**: Admin corrige desde `/admin/asistencia` con botón "Corregir". Se registra en `attendance_corrections`.

### Caso 2: Evento nocturno cruza medianoche
**Solución**: El evento tiene `start_time = 18:00` y `end_time = 02:00`. El sistema calcula duración considerando cruce de día.

### Caso 3: Empleado en vacaciones y evento
**Solución**: Si tiene vacaciones aprobadas, no puede ser asignado a evento. El sistema bloquea la asignación.

### Caso 4: Dos admins editan al mismo tiempo
**Solución**: Supabase usa transacciones. El último en guardar gana, pero ambos ven el cambio en tiempo real.

### Caso 5: Empleado renuncia
**Solución**: Se marca `active = false`. Conserva historial pero no puede acceder. Sus chats quedan visibles para el equipo.

---

## Checklist de Auditoría

Antes de mergear cualquier cambio, verificar:

- [ ] ¿Respeta las 38 reglas de negocio?
- [ ] ¿Hay transiciones de estado imposibles?
- [ ] ¿Los permisos son correctos (empleado/supervisor/admin)?
- [ ] ¿Qué pasa si no hay internet?
- [ ] ¿Qué pasa si el usuario cierra el navegador?
- [ ] ¿Qué pasa si hay dos admins editando?
- [ ] ¿Qué pasa si el empleado olvida fichar?
- [ ] ¿Qué pasa si se elimina un usuario?
- [ ] ¿Qué pasa si cambia de departamento?
- [ ] ¿Zona horaria correcta (America/Merida)?
- [ ] ¿Formato de fecha correcto (dd/mm/aaaa)?
- [ ] ¿Se registra en auditoría si es crítico?
- [ ] ¿Afecta otros módulos? (ver DEPENDENCIAS.md)

---

## Decisiones de Arquitectura (ADR)

### ADR-001: Fuente de verdad de estados
**Decisión**: `src/lib/domain/attendance/status.ts` es la única fuente de verdad para estados de asistencia.  
**Motivo**: Evita duplicación de lógica.  
**Impacto**: Asistencia, Equipo, Directorio, Hoy, Reportes.

### ADR-002: Eventos ampliado
**Decisión**: Ampliar `institutional_events` con hora, cliente, departamento, ubicación, responsable, participantes.  
**Motivo**: Cubrir caso de uso de eventos externos con asistencia.  
**Impacto**: Calendario, Asistencia, Notificaciones, Reportes.

### ADR-003: Check-in en eventos
**Decisión**: Crear tabla `event_attendance` separada de `attendance`.  
**Motivo**: La asistencia en evento externo no debe mezclarse con la asistencia de oficina.  
**Impacto**: Asistencia, GPS, Reportes.

---

## Versión

- **v1.0** — 04 Ago 2026 — Initial commit (38 reglas, transiciones, casos extremos, checklist)
