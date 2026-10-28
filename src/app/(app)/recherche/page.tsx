import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { searchAll } from '@/lib/data/activity';
import { LABELS, type DocumentCategory, type IdeaStatus, type ProjectStatus, type TaskStatus } from '@/lib/domain/constants';
import { formatDate } from '@/lib/domain/format';

export const metadata: Metadata = { title: 'Recherche' };

export default async function RecherchePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSession();
  const { q = '' } = await searchParams;
  const results = await searchAll(q);
  const total = results.tasks.length + results.projects.length + results.ideas.length + results.events.length + results.documents.length;

  return (
    <>
      <PageHeader title="Recherche" description={q ? `${total} résultat(s) pour « ${q} »` : 'Tapez au moins deux caractères dans la barre de recherche.'} />
      {q.trim().length >= 2 && total === 0 ? <EmptyState title="Aucun résultat" text="Essayez un autre mot, ou une partie du titre." /> : null}

      <div className="grid gap-6 md:grid-cols-2">
        {results.tasks.length > 0 ? (
          <section aria-label="Tâches">
            <h2 className="mb-2 text-sm font-semibold">Tâches</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {results.tasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/taches/${t.id}`} className="hover:underline">{t.title}</Link>
                  <span className="text-xs text-[var(--c-ink-faint)]"> · {LABELS.taskStatus[t.status as TaskStatus]}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {results.projects.length > 0 ? (
          <section aria-label="Projets">
            <h2 className="mb-2 text-sm font-semibold">Projets</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {results.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projets/${p.id}`} className="hover:underline">{p.title}</Link>
                  <span className="text-xs text-[var(--c-ink-faint)]"> · {LABELS.projectStatus[p.status as ProjectStatus]}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {results.ideas.length > 0 ? (
          <section aria-label="Idées">
            <h2 className="mb-2 text-sm font-semibold">Idées</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {results.ideas.map((i) => (
                <li key={i.id}>
                  <Link href={`/idees/${i.id}`} className="hover:underline">{i.title}</Link>
                  <span className="text-xs text-[var(--c-ink-faint)]"> · {LABELS.ideaStatus[i.status as IdeaStatus]}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {results.events.length > 0 ? (
          <section aria-label="Événements">
            <h2 className="mb-2 text-sm font-semibold">Événements</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {results.events.map((e) => (
                <li key={e.id}>
                  <Link href={`/evenements/${e.id}`} className="hover:underline">{e.title}</Link>
                  <span className="text-xs text-[var(--c-ink-faint)]"> · {formatDate(e.starts_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {results.documents.length > 0 ? (
          <section aria-label="Documents">
            <h2 className="mb-2 text-sm font-semibold">Documents</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {results.documents.map((d) => (
                <li key={d.id}>
                  <a href={`/documents/${d.id}`} className="hover:underline">{d.title}</a>
                  <span className="text-xs text-[var(--c-ink-faint)]"> · {LABELS.documentCategory[d.category as DocumentCategory]}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
