import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listActivity } from '@/lib/data/activity';
import { formatDateTime } from '@/lib/domain/format';

export const metadata: Metadata = { title: 'Activité' };

const ENTITY_LABELS: Record<string, string> = {
  tasks: 'Tâche',
  projects: 'Projet',
  events: 'Événement',
  ideas: 'Idée',
  documents: 'Document',
  comments: 'Commentaire',
  pole_memberships: 'Équipe',
  profiles: 'Profil',
};

export default async function ActivitePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireSession();
  const { type } = await searchParams;
  const activity = await listActivity({ entityType: type && ENTITY_LABELS[type] ? type : undefined, limit: 100 });

  return (
    <>
      <PageHeader title="Activité" description="Journal des changements importants : qui, quand, et quoi. Le contenu des commentaires et les données personnelles n'y figurent pas." />
      <nav aria-label="Filtrer par type" className="mb-6 flex flex-wrap gap-2 text-sm">
        <a href="/activite" className={`rounded-full px-3 py-1.5 ${!type ? 'bg-[var(--c-ink)] text-[var(--c-canvas)]' : 'border border-[var(--c-line)]'}`}>Tout</a>
        {Object.entries(ENTITY_LABELS).map(([key, label]) => (
          <a key={key} href={`/activite?type=${key}`} className={`rounded-full px-3 py-1.5 ${type === key ? 'bg-[var(--c-ink)] text-[var(--c-canvas)]' : 'border border-[var(--c-line)]'}`}>
            {label}
          </a>
        ))}
      </nav>
      {activity.length === 0 ? (
        <EmptyState title="Aucune activité" text="Les créations, modifications et décisions apparaîtront ici." />
      ) : (
        <ol className="flex flex-col divide-y divide-[var(--c-line)] rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)]">
          {activity.map((a) => (
            <li key={a.id} className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-baseline sm:justify-between">
              <span className="min-w-0">
                <span className="font-medium">{a.actor?.full_name ?? 'Système'}</span>
                <span className="text-[var(--c-ink-soft)]"> · {a.summary}</span>
              </span>
              <time className="shrink-0 text-xs text-[var(--c-ink-faint)]" dateTime={a.created_at}>{formatDateTime(a.created_at)}</time>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
