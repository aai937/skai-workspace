import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { archiveTaskAction, createTaskAction, deleteTaskAction, toggleCollaboratorAction, updateTaskAction, updateTaskProgressAction } from '@/app/actions/tasks';
import { ActionButton, ActionForm, ConfirmButton, SelectField, SubmitButton, TextAreaField } from '@/components/forms';
import { CommentsSection } from '@/components/CommentsSection';
import { TaskForm } from '@/components/tasks/TaskForm';
import { Card, CardTitle, LateBadge, LinkButton, PageHeader, PriorityBadge, TaskStatusBadge } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { getFormOptions } from '@/lib/data/options';
import { getTask, isLate } from '@/lib/data/tasks';
import { LABELS, TASK_STATUSES } from '@/lib/domain/constants';
import { formatDate, formatDateTime } from '@/lib/domain/format';
import { canManageTask, canUpdateTaskProgress, canDeleteTask } from '@/lib/domain/permissions';

export const metadata: Metadata = { title: 'Tâche' };

export default async function TacheDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const task = await getTask(id);
  if (!task) {
    notFound();
  }

  const scope = { poleId: task.pole?.id ?? '', creatorId: task.creator_id, assigneeId: task.assignee?.id ?? null };
  const canManage = canManageTask(session.viewer, scope);
  const canProgress = canUpdateTaskProgress(session.viewer, scope);
  const options = await getFormOptions();

  return (
    <>
      <nav className="mb-3 text-sm text-[var(--c-ink-faint)]">
        <Link href="/taches" className="hover:underline">Tâches</Link>
        {task.pole ? <> · {task.pole.name}</> : null}
      </nav>
      <PageHeader
        title={task.title}
        description={[
          task.project ? `Projet : ${task.project.title}` : null,
          task.event ? `Événement : ${task.event.title}` : null,
          task.creator ? `Créée par ${task.creator.full_name} le ${formatDate(task.created_at)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={task.priority} />
            <TaskStatusBadge status={task.status} />
            {isLate(task) ? <LateBadge /> : null}
          </div>
        }
      />

      {task.status === 'bloquee' && task.blocked_reason ? (
        <div className="mb-6 rounded-2xl border border-[var(--c-danger)]/40 bg-[var(--c-danger-soft)] p-4 text-sm">
          <p className="font-medium text-[var(--c-danger)]">Tâche bloquée</p>
          <p className="mt-1 text-[var(--c-ink)]">{task.blocked_reason}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardTitle>Description</CardTitle>
            <p className="whitespace-pre-wrap text-sm text-[var(--c-ink-soft)]">{task.description || 'Aucune description.'}</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Responsable</dt><dd>{task.assignee?.full_name ?? 'Non attribuée'}</dd></div>
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Échéance</dt><dd>{formatDate(task.due_date)}</dd></div>
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Terminée le</dt><dd>{task.completed_at ? formatDateTime(task.completed_at) : '—'}</dd></div>
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Étiquettes</dt><dd>{task.labels.length ? task.labels.join(', ') : '—'}</dd></div>
              <div><dt className="text-xs text-[var(--c-ink-faint)]">Collaborateurs</dt><dd>{task.collaborators.map((c) => c.full_name).join(', ') || '—'}</dd></div>
            </dl>
          </Card>

          {canProgress ? (
            <Card>
              <CardTitle>Avancement</CardTitle>
              <ActionForm action={updateTaskProgressAction.bind(null, task.id)} className="grid gap-4 md:grid-cols-2">
                <SelectField
                  name="status"
                  label="Statut"
                  options={TASK_STATUSES.map((s) => ({ value: s, label: LABELS.taskStatus[s] }))}
                  defaultValue={task.status}
                />
                <div className="flex items-end">
                  <SubmitButton>Mettre à jour</SubmitButton>
                </div>
                <div className="md:col-span-2">
                  <TextAreaField
                    name="blockedReason"
                    label="Signaler un blocage"
                    hint="Expliquez le blocage si vous passez la tâche en « Bloquée »."
                    defaultValue={task.blocked_reason ?? ''}
                    maxLength={1000}
                  />
                </div>
              </ActionForm>
            </Card>
          ) : null}

          <Card>
            <CardTitle>Sous-tâches</CardTitle>
            {task.subtasks.length === 0 ? (
              <p className="mb-4 text-sm text-[var(--c-ink-faint)]">Aucune sous-tâche.</p>
            ) : (
              <ul className="mb-5 divide-y divide-[var(--c-line)]">
                {task.subtasks.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <Link href={`/taches/${s.id}`} className="hover:underline">{s.title}</Link>
                    <TaskStatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
            {canManage ? (
              <details>
                <summary className="cursor-pointer text-sm text-[var(--c-accent)]">Ajouter une sous-tâche</summary>
                <div className="mt-4">
                  <TaskForm
                    action={createTaskAction}
                    submitLabel="Ajouter la sous-tâche"
                    poles={options.poles.filter((p) => p.value === task.pole?.id)}
                    projects={options.projects}
                    events={options.events}
                    members={options.members}
                    values={{ poleId: task.pole?.id, projectId: task.project?.id ?? null, eventId: task.event?.id ?? null }}
                  />
                </div>
              </details>
            ) : null}
          </Card>

          <CommentsSection
            targetType="task"
            targetId={task.id}
            comments={task.comments}
            members={options.memberRows}
            viewerId={session.viewer.id}
            isBureau={session.viewer.isBureau}
          />

          <Card>
            <CardTitle>Historique des modifications</CardTitle>
            {task.history.length === 0 ? (
              <p className="text-sm text-[var(--c-ink-faint)]">Aucune modification enregistrée.</p>
            ) : (
              <ol className="flex flex-col gap-3 text-sm">
                {task.history.map((h) => (
                  <li key={h.id} className="text-[var(--c-ink-soft)]">
                    <span className="text-[var(--c-ink)]">{h.actor?.full_name ?? 'Système'}</span> · {h.summary}
                    <span className="block text-xs text-[var(--c-ink-faint)]">{formatDateTime(h.created_at)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          {canManage ? (
            <Card>
              <CardTitle>Modifier la tâche</CardTitle>
              <TaskForm
                action={updateTaskAction.bind(null, task.id)}
                submitLabel="Enregistrer"
                poles={options.poles}
                projects={options.projects}
                events={options.events}
                members={options.members}
                values={{
                  title: task.title,
                  description: task.description,
                  poleId: task.pole?.id,
                  projectId: task.project?.id ?? null,
                  eventId: task.event?.id ?? null,
                  assigneeId: task.assignee?.id ?? null,
                  priority: task.priority,
                  status: task.status,
                  dueDate: task.due_date,
                  labels: task.labels,
                  blockedReason: task.blocked_reason,
                }}
              />
            </Card>
          ) : null}

          {canManage ? (
            <Card>
              <CardTitle>Collaborateurs</CardTitle>
              <ul className="flex flex-col gap-2 text-sm">
                {task.collaborators.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span>{c.full_name}</span>
                    <ActionButton action={toggleCollaboratorAction.bind(null, task.id, c.id, false)}>Retirer</ActionButton>
                  </li>
                ))}
                {options.memberRows
                  .filter((m) => m.id !== task.assignee?.id && !task.collaborators.some((c) => c.id === m.id))
                  .slice(0, 12)
                  .map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <span className="text-[var(--c-ink-soft)]">{m.full_name}</span>
                      <ActionButton action={toggleCollaboratorAction.bind(null, task.id, m.id, true)}>Ajouter</ActionButton>
                    </li>
                  ))}
              </ul>
            </Card>
          ) : null}

          {canManage || canDeleteTask(session.viewer) ? (
            <Card>
              <CardTitle>Actions</CardTitle>
              <div className="flex flex-wrap gap-2">
                {canManage ? (
                  <ConfirmButton message="Archiver cette tâche ? Elle restera consultable dans l'historique." action={archiveTaskAction.bind(null, task.id)}>
                    Archiver
                  </ConfirmButton>
                ) : null}
                {canDeleteTask(session.viewer) ? (
                  <ConfirmButton variant="danger" message="Supprimer définitivement cette tâche ? Cette action est irréversible." action={deleteTaskAction.bind(null, task.id)}>
                    Supprimer
                  </ConfirmButton>
                ) : null}
              </div>
            </Card>
          ) : null}

          {task.event ? (
            <LinkButton href={`/evenements/${task.event.id}`} variant="secondary">Voir l’événement lié</LinkButton>
          ) : null}
        </aside>
      </div>
    </>
  );
}
