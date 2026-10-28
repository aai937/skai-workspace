import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { convertIdeaToProjectAction, convertIdeaToTaskAction, decideIdeaAction, toggleVoteAction, updateIdeaAction } from '@/app/actions/ideas';
import { CommentsSection } from '@/components/CommentsSection';
import { ActionButton, ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { Badge, Card, CardTitle, PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { getIdea } from '@/lib/data/ideas';
import { getFormOptions } from '@/lib/data/options';
import { IDEA_EFFORTS, IDEA_STATUSES, LABELS } from '@/lib/domain/constants';
import { formatDateTime } from '@/lib/domain/format';
import { canDecideIdea, canEditIdea, canVoteIdea } from '@/lib/domain/permissions';

export const metadata: Metadata = { title: 'Idée' };

export default async function IdeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const idea = await getIdea(id, session.viewer.id);
  if (!idea) {
    notFound();
  }
  const isBureau = canDecideIdea(session.viewer);
  const canEdit = canEditIdea(session.viewer, { authorId: idea.author?.id ?? null, status: idea.status });
  const canVote = canVoteIdea({ status: idea.status }) && idea.author?.id !== session.viewer.id;
  const options = await getFormOptions();

  return (
    <>
      <nav className="mb-3 text-sm text-[var(--c-ink-faint)]">
        <Link href="/idees" className="hover:underline">Idées</Link>
      </nav>
      <PageHeader
        title={idea.title}
        description={`Proposée par ${idea.author?.full_name ?? 'un membre supprimé'} le ${formatDateTime(idea.created_at)}${idea.pole ? ` · ${idea.pole.name}` : ''}`}
        actions={<Badge tone="accent">{LABELS.ideaStatus[idea.status]}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <dl className="flex flex-col gap-5 text-sm">
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Problème identifié</dt><dd className="mt-1 whitespace-pre-wrap">{idea.problem}</dd></div>
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Solution proposée</dt><dd className="mt-1 whitespace-pre-wrap">{idea.solution}</dd></div>
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Bénéfices attendus</dt><dd className="mt-1 whitespace-pre-wrap">{idea.benefits || '—'}</dd></div>
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Effort estimé</dt><dd className="mt-1">{LABELS.ideaEffort[idea.effort]}</dd></div>
            </dl>
          </Card>

          {idea.decision_note ? (
            <Card>
              <CardTitle>Décision du bureau</CardTitle>
              <p className="text-sm">
                <span className="font-medium">{LABELS.ideaStatus[idea.status]}</span>
                {idea.decider ? ` · par ${idea.decider.full_name}` : ''}
                {idea.decided_at ? ` · ${formatDateTime(idea.decided_at)}` : ''}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--c-ink-soft)]">{idea.decision_note}</p>
            </Card>
          ) : null}

          <CommentsSection
            targetType="idea"
            targetId={idea.id}
            comments={idea.comments}
            members={options.memberRows}
            viewerId={session.viewer.id}
            isBureau={isBureau}
          />
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardTitle>Soutien</CardTitle>
            <p className="mb-4 text-3xl font-semibold tabular-nums">{idea.votes}</p>
            {canVote ? (
              <ActionButton action={toggleVoteAction.bind(null, idea.id, !idea.hasVoted)}>
                {idea.hasVoted ? 'Retirer mon vote' : 'Voter pour cette idée'}
              </ActionButton>
            ) : (
              <p className="text-sm text-[var(--c-ink-faint)]">Les votes sont ouverts sur les idées en cours d’examen.</p>
            )}
          </Card>

          {isBureau ? (
            <Card>
              <CardTitle>Décision</CardTitle>
              <ActionForm action={decideIdeaAction} className="grid gap-3">
                <input type="hidden" name="ideaId" value={idea.id} />
                <SelectField
                  name="status"
                  label="Nouveau statut"
                  options={IDEA_STATUSES.filter((s) => s !== 'convertie').map((s) => ({ value: s, label: LABELS.ideaStatus[s] }))}
                  defaultValue={idea.status}
                />
                <TextAreaField name="decisionNote" label="Explication" hint="Obligatoire pour approuver ou refuser." maxLength={2000} defaultValue={idea.decision_note} />
                <SubmitButton>Enregistrer la décision</SubmitButton>
              </ActionForm>
              {idea.status === 'approuvee' ? (
                <div className="mt-4 flex flex-col gap-2">
                  <ActionButton action={convertIdeaToProjectAction.bind(null, idea.id)}>Convertir en projet</ActionButton>
                  <ActionButton action={convertIdeaToTaskAction.bind(null, idea.id)}>Convertir en tâche</ActionButton>
                </div>
              ) : null}
              {idea.project_id ? <Link href={`/projets/${idea.project_id}`} className="mt-4 block text-sm text-[var(--c-accent)]">Voir le projet créé</Link> : null}
              {idea.task_id ? <Link href={`/taches/${idea.task_id}`} className="mt-4 block text-sm text-[var(--c-accent)]">Voir la tâche créée</Link> : null}
            </Card>
          ) : null}

          {canEdit ? (
            <Card>
              <CardTitle>Modifier mon idée</CardTitle>
              <ActionForm action={updateIdeaAction.bind(null, idea.id)} className="grid gap-3">
                <TextField name="title" label="Titre" required defaultValue={idea.title} />
                <TextAreaField name="problem" label="Problème" required defaultValue={idea.problem} />
                <TextAreaField name="solution" label="Solution" required defaultValue={idea.solution} />
                <TextAreaField name="benefits" label="Bénéfices" defaultValue={idea.benefits} />
                <SelectField name="poleId" label="Pôle" options={options.poles} placeholder="Aucun" defaultValue={idea.pole?.id ?? ''} />
                <SelectField
                  name="effort"
                  label="Effort"
                  options={IDEA_EFFORTS.map((e) => ({ value: e, label: LABELS.ideaEffort[e] }))}
                  defaultValue={idea.effort}
                />
                <SubmitButton>Enregistrer</SubmitButton>
              </ActionForm>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
