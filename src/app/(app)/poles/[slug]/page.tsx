import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardTitle, EmptyState, LateBadge, PageHeader, PriorityBadge, TaskStatusBadge } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { getPoleTasks, listPoles } from '@/lib/data/people';
import { listProjects } from '@/lib/data/projects';
import { isLate } from '@/lib/data/tasks';
import { LABELS } from '@/lib/domain/constants';
import { formatDate } from '@/lib/domain/format';

export const metadata: Metadata = { title: 'Pôle' };

export default async function PolePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireSession();
  const { slug } = await params;
  const poles = await listPoles();
  const pole = poles.find((p) => p.slug === slug);
  if (!pole) {
    notFound();
  }
  const [tasks, projects] = await Promise.all([getPoleTasks(pole.id), listProjects()]);
  const poleProjects = projects.filter((p) => p.project_poles.some((pp) => pp.pole.id === pole.id) && p.status !== 'archive');
  const open = tasks.filter((t) => t.status !== 'terminee');
  const upcoming = open.filter((t) => t.due_date).slice(0, 8);
  const responsables = pole.pole_memberships.filter((m) => m.role === 'responsable');
  const membres = pole.pole_memberships.filter((m) => m.role === 'membre');
  const canEdit = session.viewer.isBureau;

  return (
    <>
      <nav className="mb-3 text-sm text-[var(--c-ink-faint)]">
        <Link href="/poles" className="hover:underline">Pôles et membres</Link>
      </nav>
      <PageHeader
        title={pole.name}
        description={pole.description || 'Pas encore de description.'}
        actions={canEdit ? <Link href="/parametres/membres" className="text-sm text-[var(--c-accent)]">Gérer le pôle</Link> : null}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardTitle>Tâches du pôle ({open.length} ouverte{open.length > 1 ? 's' : ''})</CardTitle>
            {open.length === 0 ? (
              <EmptyState title="Aucune tâche ouverte" text="Les tâches du pôle apparaissent ici dès qu'elles sont créées." />
            ) : (
              <ul className="divide-y divide-[var(--c-line)]">
                {open.slice(0, 30).map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <Link href={`/taches/${t.id}`} className="hover:underline">{t.title}</Link>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <PriorityBadge priority={t.priority} />
                      <TaskStatusBadge status={t.status} />
                      {isLate(t) ? <LateBadge /> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Projets du pôle</CardTitle>
            {poleProjects.length === 0 ? (
              <p className="text-sm text-[var(--c-ink-faint)]">Aucun projet rattaché à ce pôle.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {poleProjects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <Link href={`/projets/${p.id}`} className="hover:underline">{p.title}</Link>
                    <span className="text-xs text-[var(--c-ink-faint)]">{p.progress} % · {LABELS.projectStatus[p.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardTitle>Responsables</CardTitle>
            <ul className="flex flex-col gap-2 text-sm">
              {responsables.length === 0 ? <li className="text-[var(--c-ink-faint)]">À désigner par le bureau.</li> : null}
              {responsables.map((m) => (
                <li key={m.profile?.id}>{m.profile?.full_name}</li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardTitle>Membres</CardTitle>
            <ul className="flex flex-col gap-2 text-sm">
              {membres.length === 0 ? <li className="text-[var(--c-ink-faint)]">Aucun membre simple.</li> : null}
              {membres.map((m) => (
                <li key={m.profile?.id}>{m.profile?.full_name}</li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardTitle>Prochaines échéances</CardTitle>
            {upcoming.length === 0 ? (
              <p className="text-sm text-[var(--c-ink-faint)]">Aucune échéance à venir.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {upcoming.map((t) => (
                  <li key={t.id} className="flex justify-between gap-2">
                    <Link href={`/taches/${t.id}`} className="truncate hover:underline">{t.title}</Link>
                    <span className="shrink-0 text-xs text-[var(--c-ink-faint)]">{formatDate(t.due_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
