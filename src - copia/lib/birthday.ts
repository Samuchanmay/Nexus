/** Fecha de hoy en formato ISO (aaaa-mm-dd), consistente con el resto de la app. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * true si el mes-día de birthDate coincide con el mes-día de `today` (ambos
 * en formato aaaa-mm-dd). Se usa tanto para el mensaje del Asistente como
 * para el badge 🎉 discreto en el Avatar de la persona, en toda la app.
 */
export function isBirthdayToday(birthDate: string | null | undefined, today: string): boolean {
  if (!birthDate) return false;
  return birthDate.slice(5) === today.slice(5);
}
