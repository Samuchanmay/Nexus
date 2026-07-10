// ═══════════════════════════════════════════════════════════════
//  NEXUS · Días inhábiles oficiales de México (Art. 74 LFT)
//  Portado del checador legado (feriadosMexicanos). Fechas fijas +
//  lunes rotativos para Constitución/Juárez/Revolución, más la
//  transmisión del Poder Ejecutivo Federal cada 6 años (desde 2024).
// ═══════════════════════════════════════════════════════════════

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Primer lunes de un mes dado (mes: 0-indexado). */
function firstMondayOf(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  const day = d.getDay(); // 0=Dom, 1=Lun...
  const diff = (1 - day + 7) % 7;
  return new Date(year, month, 1 + diff);
}

/** Tercer lunes de un mes dado. */
function thirdMondayOf(year: number, month: number): Date {
  const fm = firstMondayOf(year, month);
  return new Date(fm.getFullYear(), fm.getMonth(), fm.getDate() + 14);
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export interface OfficialHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

/** Días inhábiles oficiales de México para un año dado (Art. 74 LFT). */
export function mexicanHolidays(year: number): OfficialHoliday[] {
  const days: OfficialHoliday[] = [
    { date: `${year}-01-01`, name: "Año Nuevo" },
    { date: iso(firstMondayOf(year, 1)), name: "Día de la Constitución (Art. 74 LFT)" },
    { date: iso(thirdMondayOf(year, 2)), name: "Natalicio de Benito Juárez (Art. 74 LFT)" },
    { date: `${year}-05-01`, name: "Día del Trabajo" },
    { date: `${year}-09-16`, name: "Independencia de México" },
    { date: iso(thirdMondayOf(year, 10)), name: "Día de la Revolución (Art. 74 LFT)" },
    { date: `${year}-12-25`, name: "Navidad" },
  ];
  if ((year - 2024) % 6 === 0) {
    days.push({ date: `${year}-12-01`, name: "Transmisión del Poder Ejecutivo Federal" });
  }
  return days;
}
