// Fonctions pures : dates en français, avancement, retards. Le fuseau de référence est celui de l'association.

export const TIME_ZONE = 'Europe/Paris';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE });
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = typeof value === 'string' ? (value.length > 10 ? new Date(value) : parseDateOnly(value)) : value;
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return '—';
  }
  return dateTimeFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

// « 2026-11-03 » -> Date à midi UTC : évite tout décalage de jour selon le fuseau.
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
}

// Décalage (en minutes) du fuseau de Paris à un instant donné.
function parisOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

// « 2026-11-03T18:30 » saisi à Paris -> instant ISO UTC. Une chaîne déjà munie d'un fuseau est conservée.
export function parisLocalToIso(value: string): string {
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) {
    return new Date(value).toISOString();
  }
  const naive = new Date(`${value}:00Z`);
  let instant = new Date(naive.getTime() - parisOffsetMinutes(naive) * 60000);
  instant = new Date(naive.getTime() - parisOffsetMinutes(instant) * 60000);
  return instant.toISOString();
}

export function isOverdue(dueDate: string | null, status: string, today: Date = new Date()): boolean {
  if (!dueDate || status === 'terminee') {
    return false;
  }
  const todayKey = today.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
  return dueDate < todayKey;
}

export function daysUntil(dueDate: string, today: Date = new Date()): number {
  const todayKey = today.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
  const diff = parseDateOnly(dueDate).getTime() - parseDateOnly(todayKey).getTime();
  return Math.round(diff / 86_400_000);
}

// Avancement d'un ensemble d'éléments : tâches terminées et jalons atteints, en pourcentage.
export function progressPercent(done: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((done / total) * 100);
}

export function centsToEuros(cents: number | null): string {
  if (cents === null) {
    return '—';
  }
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
