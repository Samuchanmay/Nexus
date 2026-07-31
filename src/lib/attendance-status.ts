// Re-export de compatibilidad — la lógica real vive ahora en
// src/lib/domain/attendance/status.ts (reorganización del 2026-07-31: de
// "resolver" suelto a dominio de asistencia). Todo el código nuevo debe
// importar directo desde "@/lib/domain/attendance"; este archivo solo existe
// como red de seguridad por si algún import viejo quedó sin migrar — no se
// pudo correr `tsc` en este entorno para confirmarlo con certeza absoluta.
export * from "./domain/attendance/status";
export { getAttendanceStatus as resolveAttendanceStatus } from "./domain/attendance/status";
