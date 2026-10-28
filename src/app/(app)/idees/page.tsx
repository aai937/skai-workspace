import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, LinkButton, PageHeader, Badge } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listIdeas } from '@/lib/data/ideas';
import { IDEA_STATUSES, LABELS, type IdeaStatus } from '@/lib/domain/constants';

export const metadata: Metadata = { title: 'Idées' };

const STATUS_TONE = {
  nouvelle: 'accent',
  a_etudier: 'neutral',
  en_discussion: 'warning',
  approuvee: 'success',
  refusee: 'danger',
  en_pause: 'neutral',
  convertie: 'success',
} as const;

export default async function IdeesPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  const filter = IDEA_STATUSES.includes(params.statut as IdeaStatus) ? (params.statut as IdeaStatus) : undefined;
  const ideas = await listIdeas(session.viewer.id, filter);

  return (
    <>
      <PageHeader
        title="Idées et innovation"
        description="Chaque membre peut proposer une idée sans passer par un responsable. Le bureau l'examine et explique sa décision."
        actions={<LinkButton href="/idees/nouvelle">Proposer une idée</LinkButton>}
      />

      <nav aria-label="Filtrer par statut" className="mb-6 flex flex-wrap gap-2">
        <Link href="/idees" className={`rounded-full px-3 py-1.5 text-sm ${!filter ? 'bg-[var(--c-ink)] text-[var(--c-canvas)]' : 'border border-[var(--c-line)] text-[var(--c-ink-soft)]'}`}>
          Toutes
        </Link>
        {IDEA_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/idees?statut=${s}`}
            className={`rounded-full px-3 py-1.5 text-sm ${filter === s ? 'bg-[var(--c-ink)] text-[var(--c-canvas)]' : 'border border-[var(--c-line)] text-[var(--c-ink-soft)]'}`}
          >
            {LABELS.ideaStatus[s]}
          </Link>
        ))}
      </nav>

      {ideas.length === 0 ? (
        <EmptyState title="Aucune idée pour le moment" text="Une bonne idée commence souvent par un problème observé. Décrivez le vôtre." action={<LinkButton href="/idees/nouvelle">Proposer une idée</LinkButton>} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {ideas.map((idea) => (
            <li key={idea.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)] p-5">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/idees/${idea.id}`} className="font-semibold tracking-tight hover:underline">
                  {idea.title}
                </Link>
                <Badge tone={STATUS_TONE[idea.status]}>{LABELS.ideaStatus[idea.status]}</Badge>
              </div>
              <p className="line-clamp-3 text-sm text-[var(--c-ink-soft)]">{idea.problem}</p>
              <p className="mt-auto text-xs text-[var(--c-ink-faint)]">
                {idea.author?.full_name ?? 'Membre supprimé'}
                {idea.pole ? ` · ${idea.pole.name}` : ''} · Effort {LABELS.ideaEffort[idea.effort].toLowerCase()} · {idea.votes} vote(s)
                {idea.hasVoted ? ' · vous avez voté' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
