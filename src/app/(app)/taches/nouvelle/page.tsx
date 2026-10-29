import type { Metadata } from 'next';
import { createTaskAction } from '@/app/actions/tasks';
import { PageHeader } from '@/components/ui';
import { TaskForm } from '@/components/tasks/TaskForm';
import { requireSession } from '@/lib/auth';
import { canCreateTask } from '@/lib/domain/permissions';
import { getFormOptions } from '@/lib/data/options';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Nouvelle tâche' };

export default async function NouvelleTachePage({ searchParams }: { searchParams: Promise<{ pole?: string; evenement?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  if (!canCreateTask(session.viewer)) {
    redirect('/acces-refuse');
  }

  const options = await getFormOptions();
  const poles = options.poles;

  return (
    <>
      <PageHeader title="Nouvelle tâche" description="Attribuez-la à un membre, fixez une échéance et, si besoin, rattachez-la à un projet ou un événement." />
      <div className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)] p-5">
        <TaskForm
          action={createTaskAction}
          submitLabel="Créer la tâche"
          poles={poles}
          projects={options.projects}
          events={options.events}
          members={options.members}
          values={{ poleId: params.pole ?? poles[0]?.value, eventId: params.evenement ?? null }}
        />
      </div>
    </>
  );
}
