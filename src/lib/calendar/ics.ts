// Génération d'un calendrier iCalendar (.ics) : abonnement depuis Google Agenda, Outlook ou Apple Agenda.
export type IcsEvent = {
  uid: string;
  summary: string;
  description?: string;
  // Événement sur une journée (échéance de tâche) ou avec heures de début et de fin.
  allDay: boolean;
  start: string; // AAAA-MM-JJ si allDay, sinon ISO 8601
  end?: string; // idem
  url?: string;
};

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Lignes de 75 caractères au plus, suite sur la ligne suivante préfixée d'une espace (RFC 5545).
function fold(line: string): string {
  if (line.length <= 75) {
    return line;
  }
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
}

function dateOnly(value: string): string {
  return value.replace(/-/g, '');
}

function dateTime(value: string): string {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function nextDay(value: string): string {
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildIcs(calendarName: string, events: IcsEvent[], stamp: Date = new Date()): string {
  const now = dateTime(stamp.toISOString());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//skAI Workspace//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@skai-workspace`, `DTSTAMP:${now}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.start)}`, `DTEND;VALUE=DATE:${dateOnly(nextDay(e.start))}`);
    } else {
      lines.push(`DTSTART:${dateTime(e.start)}`);
      lines.push(`DTEND:${dateTime(e.end ?? e.start)}`);
    }
    lines.push(`SUMMARY:${escapeText(e.summary)}`);
    if (e.description) {
      lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    }
    if (e.url) {
      lines.push(`URL:${e.url}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
