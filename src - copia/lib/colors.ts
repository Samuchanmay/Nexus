/**
 * lib/colors.ts — Paleta de colores por grupo (áreas + RH), compartida entre
 * Configuración → Colores de equipo y el formulario de alta en Equipo.
 *
 * Regla de negocio: cada área (coordinación/departamento) y el grupo de RH
 * tienen UN color fijo y BLOQUEADO — una vez usado, no se puede volver a
 * elegir para otra área/persona nueva. `nextAvailableColor` siempre entrega
 * el primer color de la paleta que nadie esté usando todavía, para que
 * agregar un grupo nuevo nunca choque con uno existente.
 */

export const PALETTE: string[] = [
  "#2FB344", "#AF52DE", "#FF2D55", "#00C7BE", "#32ADE6", "#FF9F0A",
  "#BF5AF2", "#FF6482", "#30B0C7", "#A2845E", "#D65DB1", "#845EC2",
  "#C34A36", "#4E8397", "#FF9671", "#2C73D2", "#008F7A", "#E4572E",
  "#6A4C93", "#1B998B", "#EF6461", "#3D5A80", "#5856D6", "#FF3B30",
  "#FF8A00", "#0066FF",
];

/** El primer color de la paleta que no aparece en `used` (case-insensitive). */
export function nextAvailableColor(used: (string | null | undefined)[]): string {
  const taken = new Set(used.filter((c): c is string => !!c).map((c) => c.toUpperCase()));
  return PALETTE.find((c) => !taken.has(c.toUpperCase())) ?? PALETTE[0];
}
