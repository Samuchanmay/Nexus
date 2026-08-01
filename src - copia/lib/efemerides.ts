// NEXUS · Lee el feed ICS público del calendario de Efemérides y devuelve
// los eventos de hoy. No requiere OAuth: el calendario debe estar compartido
// como "Disponibilidad pública" en Google Calendar (Ajustes → Acceso a eventos).
export type Efemeride = { title: string };

function unfoldIcs(raw: string): string[] {
  // Las líneas ICS se "pliegan": una línea que empieza con espacio es
  // continuación de la anterior. Las desplegamos antes de parsear.
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseDate(value: string): { y: number; m: number; d: number } | null {
  // Formatos típicos: "20260710" o "20260710T090000Z" o con TZID antes de ":"
  const m = value.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export async function getTodayEfemerides(calendarId: string, today: Date = new Date()): Promise<Efemeride[]> {
  const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
  let text: string;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } } as RequestInit);
    if (!res.ok) return [];
    text = await res.text();
  } catch {
    return [];
  }

  const lines = unfoldIcs(text);
  const todayY = today.getFullYear(), todayM = today.getMonth() + 1, todayD = today.getDate();

  const results: Efemeride[] = [];
  let inEvent = false;
  let summary = "";
  let dtstart: { y: number; m: number; d: number } | null = null;
  let isYearly = false;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      inEvent = true; summary = ""; dtstart = null; isYearly = false;
      continue;
    }
    if (line.startsWith("END:VEVENT")) {
      if (inEvent && dtstart && summary) {
        const monthDayMatch = dtstart.m === todayM && dtstart.d === todayD;
        const exactMatch = dtstart.y === todayY && monthDayMatch;
        if (isYearly ? monthDayMatch : exactMatch) {
          results.push({ title: summary });
        }
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    if (line.startsWith("SUMMARY:")) {
      summary = line.slice("SUMMARY:".length).replace(/\\,/g, ",").replace(/\\n/gi, " ").trim();
    } else if (line.startsWith("DTSTART")) {
      const idx = line.indexOf(":");
      if (idx !== -1) dtstart = parseDate(line.slice(idx + 1));
    } else if (line.startsWith("RRULE") && /FREQ=YEARLY/i.test(line)) {
      isYearly = true;
    }
  }

  return results;
}
