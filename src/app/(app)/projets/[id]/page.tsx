import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  addMilestoneAction,
  addProjectMemberAction,
  archiveProjectAction,
  deleteProjectAction,
  unarchiveProjectAction,
  removeProjectMemberAction,
  toggleMilestoneAction,
  updateProjectAction,
} from '@/app/actions/projects';
import { CommentsSection } from '@/components/CommentsSection';
import { ActionButton, ActionForm, ConfirmButton, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { Card, CardTitle, EmptyState, LateBadge, PageHeader, PriorityBadge, ProgressBar, TaskStatusBadge } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { getFormOptions } from '@/lib/data/options';
import { getProject } from '@/lib/data/projects';
import { isLate } from '@/lib/data/tasks';
import { LABELS, PROJECT_STATUSES, TASK_PRIORITIES } from '@/lib/domain/constants';
import { formatDate } from '@/lib/domain/format';
import { canManageProject } from '@/lib/domain/permissions';

export const metadata: Metadata = { title: 'Projet' };

export default async function ProjetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    notFound();
  }
  const canManage = canManageProject(session.viewer, {
    leadId: project.lead?.id ?? null,
    createdBy: null,
    poleIds: project.project_poles.map((pp) => pp.pole.id),
  });
  const options = await getFormOptions();
  const memberIds = new Set(project.members.map((m) => m.id));

  return (
    <>
      <nav className="mb-3 text-sm text-[var(--c-ink-faint)]">
        <Link href="/projets" className="hover:underline">Projets</Link>
      </nav>
      <PageHeader
        title={project.title}
        description={`${LABELS.projectStatus[project.status]} · ${project.project_poles.map((pp) => pp.pole.name).join(' · ') || 'Aucune équipe'}${project.lead ? ` · Responsable : ${project.lead.full_name}` : ''}`}
        actions={<PriorityBadge priority={project.priority} />}
      />

      <Card className="mb-6">
        <CardTitle>Avancement</CardTitle>
        <ProgressBar value={project.progress} label="Avancement du projet" />
        <p className="mt-2 text-xs text-[var(--c-ink-faint)]">
          {project.doneCount} tâche(s) terminée(s) sur {project.taskCount} · {project.milestonesDetail.filter((m) => m.completed_at).length} jalon(s) atteint(s) sur {project.milestonesDetail.length}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardTitle>Présentation</CardTitle>
            <dl className="flex flex-col gap-4 text-sm">
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Description</dt><dd className="whitespace-pre-wrap text-[var(--c-ink-soft)]">{project.description || '—'}</dd></div>
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Objectifs</dt><dd className="whitespace-pre-wrap text-[var(--c-ink-soft)]">{project.objectives || '—'}</dd></div>
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Livrables attendus</dt><dd className="whitespace-pre-wrap text-[var(--c-ink-soft)]">{project.deliverables || '—'}</dd></div>
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Dates</dt><dd>Début {formatDate(project.start_date)} · Fin prévue {formatDate(project.due_date)}</dd></div>
            </dl>
          </Card>

          <Card>
            <CardTitle>Jalons</CardTitle>
            {project.milestonesDetail.length === 0 ? (
              <p className="text-sm text-[var(--c-ink-faint)]">Aucun jalon défini.</p>
            ) : (
              <ul className="divide-y divide-[var(--c-line)]">
                {project.milestonesDetail.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <span className={m.completed_at ? 'text-[var(--c-ink-faint)] line-through' : ''}>
                      {m.title} · {formatDate(m.due_date)}
                    </span>
                    {canManage ? (
                      <ActionButton action={toggleMilestoneAction.bind(null, m.id, project.id, !m.completed_at)}>
                        {m.completed_at ? 'Rouvrir' : 'Marquer atteint'}
                      </ActionButton>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canManage ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-[var(--c-accent)]">Ajouter un jalon</summary>
                <ActionForm action={addMilestoneAction} resetOnSuccess className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                  <input type="hidden" name="projectId" value={project.id} />
                  <TextField name="title" label="Intitulé" required minLength={2} />
                  <TextField name="dueDate" label="Date" type="date" required />
                  <SubmitButton>Ajouter</SubmitButton>
                </ActionForm>
              </details>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Tâches liées</CardTitle>
            {project.taskItems.length === 0 ? (
              <EmptyState title="Aucune tâche liée" text="Les tâches rattachées à ce projet apparaissent ici et dans la liste des tâches." />
            ) : (
              <ul className="divide-y divide-[var(--c-line)]">
                {project.taskItems.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <Link href={`/taches/${t.id}`} className="hover:underline">{t.title}</Link>
                    <span className="flex items-center gap-1.5">
                      <TaskStatusBadge status={t.status} />
                      {isLate(t) ? <LateBadge /> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <CommentsSection
            targetType="project"
            targetId={project.id}
            comments={project.comments}
            members={options.memberRows}
            viewerId={session.viewer.id}
            isBureau={session.viewer.isBureau}
          />
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardTitle>Membres participants</CardTitle>
            <ul className="flex flex-col gap-2 text-sm">
              {project.members.length === 0 ? <li className="text-[var(--c-ink-faint)]">Aucun membre ajouté.</li> : null}
              {project.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span>{m.full_name}</span>
                  {canManage ? <ActionButton action={removeProjectMemberAction.bind(null, project.id, m.id)}>Retirer</ActionButton> : null}
                </li>
              ))}
            </ul>
            {canManage ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-[var(--c-accent)]">Ajouter un membre</summary>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {options.memberRows.filter((m) => !memberIds.has(m.id)).map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <span>{m.full_name}</span>
                      <ActionButton action={addProjectMemberAction.bind(null, project.id, m.id)}>Ajouter</ActionButton>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Documents</CardTitle>
            {project.documents.length === 0 ? (
              <p className="text-sm text-[var(--c-ink-faint)]">Aucun document lié.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {project.documents.map((d) => (
                  <li key={d.id}>
                    <a href={`/documents/${d.id}`} className="hover:underline">{d.title}</a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canManage ? (
            <Card>
              <CardTitle>Modifier le projet</CardTitle>
              <ActionForm action={updateProjectAction.bind(null, project.id)} className="grid gap-3">
                <TextField name="title" label="Nom" required minLength={2} defaultValue={project.title} />
                <TextAreaField name="description" label="Description" defaultValue={project.description} />
                <TextAreaField name="objectives" label="Objectifs" defaultValue={project.objectives} />
                <TextAreaField name="deliverables" label="Livrables" defaultValue={project.deliverables} />
                <fieldset>
                  <legend className="text-sm font-medium">Équipes impliqués</legend>
                  <div className="mt-2 flex flex-col gap-2">
                    {options.poles.map((p) => (
                      <label key={p.value} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="poleIds"
                          value={p.value}
                          defaultChecked={project.project_poles.some((pp) => pp.pole.id === p.value)}
                          className="size-4"
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <SelectField name="leadId" label="Responsable" options={options.members} placeholder="À définir" defaultValue={project.lead?.id ?? ''} />
                <SelectField
                  name="status"
                  label="Statut"
                  options={PROJECT_STATUSES.map((s) => ({ value: s, label: LABELS.projectStatus[s] }))}
                  defaultValue={project.status}
                />
                <SelectField
                  name="priority"
                  label="Priorité"
                  options={TASK_PRIORITIES.map((p) => ({ value: p, label: LABELS.taskPriority[p] }))}
                  defaultValue={project.priority}
                />
                <TextField name="startDate" label="Début" type="date" defaultValue={project.start_date ?? ''} />
                <TextField name="dueDate" label="Fin prévue" type="date" defaultValue={project.due_date ?? ''} />
                <SubmitButton>Enregistrer</SubmitButton>
              </ActionForm>
              <div className="mt-4 flex flex-col items-start gap-2">
                {project.archived_at ? (
                  <ActionButton action={unarchiveProjectAction.bind(null, project.id)}>Réactiver le projet</ActionButton>
                ) : (
                  <ConfirmButton message="Archiver ce projet ? Son canal de discussion sera fermé." action={archiveProjectAction.bind(null, project.id)}>
                    Archiver le projet
                  </ConfirmButton>
                )}
                {session.viewer.isBureau ? (
                  <ConfirmButton
                    variant="danger"
                    message="Supprimer définitivement ce projet ? Ses membres, jalons et son canal seront supprimés. Les tâches liées restent dans la liste."
                    action={deleteProjectAction.bind(null, project.id)}
                  >
                    Supprimer définitivement
                  </ConfirmButton>
                ) : null}
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
