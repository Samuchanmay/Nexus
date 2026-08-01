// src/lib/status.ts
// Ya no queda ningún caller de resolvePresence (Task 6 migró los 5 call
// sites a getAttendanceStatus — ver src/lib/domain/attendance/status.ts).
// Solo sobrevive WORK_STATUS_LABEL, que admin/page.tsx sigue usando para
// comparar contra "Sin iniciar" en el matiz de "vacaciones próximas".
export const WORK_STATUS_LABEL: Record<string, string> = {
  trabajando: "Trabajando", vacaciones: "Vacaciones", incidencia: "Incidencia",
  pausa: "Pausa", sin_iniciar: "Sin iniciar", no_registro_salida: "No registró salida",
  pendiente_confirmar_salida: "Pendiente de confirmar salida", fuera_horario: "Fuera de horario",
  jornada_terminada: "Jornada terminada",
};
