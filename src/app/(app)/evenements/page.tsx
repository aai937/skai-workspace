import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listEvents } from '@/lib/data/events';
import { LABELS, type EventStatus } from '@/lib/domain/constants';
import { formatDateTime } from '@/lib/domain/format';
import { canCreateEvent } from '@/lib/domain/permissions';

export const metadata: Metadata = { title: 'Événements' };

const TONE: Record<EventStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  preparation: 'warning',
  pret: 'success',
  en_cours: 'accent',
  termine: 'neutral',
  annule: 'danger',
};

export default async function EvenementsPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const session = await requireSession();
  const { vue } = await searchParams;
  const events = await listEvents();
  const view = vue === 'calendrier' ? 'calendrier' : 'liste';

  const byMonth = new Map<string, typeof events>();
  if (view === 'calendrier') {
    for (const e of events) {
      const key = new Date(e.starts_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
      byMonth.set(key, [...(byMonth.get(key) ?? []), e]);
    }
  }

  return (
    <>
      <PageHeader
        title="Événements"
        description="Conférences, ateliers, rencontres avec des entreprises et certifications : préparation, logistique et suivi."
        actions={canCreateEvent(session.viewer) ? <LinkButton href="/evenements/nouveau">Nouvel événement</LinkButton> : null}
      />
      <nav aria-label="Vues" className="mb-6 flex gap-2">
        <Link href="/evenements" aria-current={view === 'liste' ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-sm ${view === 'liste' ? 'bg-[var(--c-ink)] text-[var(--c-canvas)]' : 'border border-[var(--c-line)]'}`}>Liste</Link>
        <Link href="/evenements?vue=calendrier" aria-current={view === 'calendrier' ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-sm ${view === 'calendrier' ? 'bg-[var(--c-ink)] text-[var(--c-canvas)]' : 'border border-[var(--c-line)]'}`}>Calendrier</Link>
      </nav>

      {events.length === 0 ? (
        <EmptyState title="Aucun événement programmé" text="Créez le premier événement pour y associer une checklist logistique." />
      ) : view === 'calendrier' ? (
        <div className="flex flex-col gap-6">
          {[...byMonth.entries()].map(([month, list]) => (
            <section key={month}>
              <h2 className="mb-3 text-sm font-semibold capitalize">{month}</h2>
              <ul className="flex flex-col gap-2">
                {list.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--c-line)] bg-[var(--c-surface)] p-4 text-sm">
                    <Link href={`/evenements/${e.id}`} className="font-medium hover:underline">{e.title}</Link>
                    <span className="text-[var(--c-ink-faint)]">{formatDateTime(e.starts_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)] p-5">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/evenements/${e.id}`} className="font-semibold tracking-tight hover:underline">{e.title}</Link>
                <Badge tone={TONE[e.status]}>{LABELS.eventStatus[e.status]}</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--c-ink-soft)]">{formatDateTime(e.starts_at)}{e.location ? ` · ${e.location}` : ''}</p>
              <p className="mt-2 text-xs text-[var(--c-ink-faint)]">
                {e.event_poles.map((p) => p.pole.name).join(' · ') || 'Aucun pôle'}
                {e.lead ? ` · Responsable : ${e.lead.full_name}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
