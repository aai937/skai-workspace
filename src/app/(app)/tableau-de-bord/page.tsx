import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardTitle, EmptyState, LateBadge, LinkButton, PageHeader, PriorityBadge, ProgressBar, Stat, TaskStatusBadge } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listAnnouncements } from '@/lib/data/messaging';
import { LABELS } from '@/lib/domain/constants';
import { formatDate, formatDateTime } from '@/lib/domain/format';
import { getBureauDashboard, getMemberDashboard, getResponsableDashboard } from '@/lib/data/dashboard';
import type { TaskListItem } from '@/lib/data/tasks';

export const metadata: Metadata = { title: "Vue d'ensemble" };

function TaskRow({ task }: { task: TaskListItem }) {
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <Link href={`/taches/${task.id}`} className="block truncate font-medium hover:underline">
          {task.title}
        </Link>
        <p className="mt-0.5 text-xs text-[var(--c-ink-faint)]">
          {task.pole?.name ?? 'Sans pôle'}
          {task.due_date ? ` · échéance ${formatDate(task.due_date)}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
        <PriorityBadge priority={task.priority} />
        <TaskStatusBadge status={task.status} />
      </div>
    </li>
  );
}

function TaskList({ tasks, empty }: { tasks: TaskListItem[]; empty: string }) {
  if (tasks.length === 0) {
    return <p className="py-4 text-sm text-[var(--c-ink-faint)]">{empty}</p>;
  }
  return <ul className="divide-y divide-[var(--c-line)]">{tasks.map((t) => <TaskRow key={t.id} task={t} />)}</ul>;
}

export default async function TableauDeBordPage() {
  const session = await requireSession();
  const greeting = session.profile.full_name.split(' ')[0];
  const isBureau = session.viewer.isBureau;
  const isResponsable = session.poles.some((p) => p.role === 'responsable');

  const member = await getMemberDashboard(session);
  const responsable = isResponsable && !isBureau ? await getResponsableDashboard(session) : null;
  const bureau = isBureau ? await getBureauDashboard() : null;
  const announcements = (await listAnnouncements(session.viewer.id)).slice(0, 3);

  return (
    <>
      <PageHeader
        title={`Bonjour ${greeting}`}
        description={
          isBureau
            ? 'Vue globale de l’association : ce qui avance, ce qui bloque et ce qui attend une décision.'
            : isResponsable
              ? 'Vos priorités, et l’avancement des pôles dont vous êtes responsable.'
              : 'Vos priorités, vos échéances et les événements à venir.'
        }
        actions={<LinkButton href="/taches?vue=mes-taches" variant="secondary">Mes tâches</LinkButton>}
      />

      <section aria-label="Indicateurs" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="En retard" value={member.late.length} href="/taches?echeance=retard" tone={member.late.length > 0 ? 'danger' : undefined} />
        <Stat label="Bloquées" value={member.blocked.length} href="/taches?vue=mes-taches" tone={member.blocked.length > 0 ? 'warning' : undefined} />
        <Stat label="Échéances 14 j" value={member.upcoming.length} href="/taches?echeance=semaine" />
        <Stat label="Projets actifs" value={member.projects.length} href="/projets" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardTitle action={<Link href="/taches?vue=mes-taches" className="text-sm text-[var(--c-accent)]">Tout voir</Link>}>Mes priorités</CardTitle>
            <TaskList tasks={member.priorities} empty="Rien d'urgent pour l'instant. Profitez-en." />
          </Card>

          {member.late.length > 0 ? (
            <Card className="border-[var(--c-danger)]/40">
              <CardTitle>Tâches en retard <LateBadge /></CardTitle>
              <TaskList tasks={member.late} empty="" />
            </Card>
          ) : null}

          <Card>
            <CardTitle>Prochaines échéances</CardTitle>
            <TaskList tasks={member.upcoming} empty="Aucune échéance dans les 14 prochains jours." />
          </Card>

          {responsable ? (
            <Card>
              <CardTitle>Mon périmètre</CardTitle>
              <div className="flex flex-col gap-5">
                {responsable.poles.length === 0 ? (
                  <p className="text-sm text-[var(--c-ink-faint)]">Aucune tâche dans vos pôles pour le moment.</p>
                ) : (
                  responsable.poles.map((p) => (
                    <div key={p.id}>
                      <p className="mb-2 text-sm font-medium">{p.name}</p>
                      <ProgressBar value={p.progress} label={`Avancement de ${p.name}`} />
                    </div>
                  ))
                )}
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm font-medium">Blocages</p>
                  <TaskList tasks={responsable.blocked} empty="Aucun blocage signalé." />
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium">Missions à attribuer</p>
                  <TaskList tasks={responsable.toAssign.slice(0, 6)} empty="Toutes les tâches ont un responsable." />
                </div>
              </div>
              <p className="mt-4 text-xs text-[var(--c-ink-faint)]">
                Répartition : {Object.entries(responsable.statusCounts).map(([s, n]) => `${LABELS.taskStatus[s as keyof typeof LABELS.taskStatus]} ${n}`).join(' · ')}
              </p>
            </Card>
          ) : null}

          {bureau ? (
            <Card>
              <CardTitle>Vue du bureau</CardTitle>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Object.entries(bureau.statusCounts).map(([status, n]) => (
                  <Stat key={status} label={LABELS.taskStatus[status as keyof typeof LABELS.taskStatus]} value={n} href={`/taches?statut=${status}`} />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Tâches en retard" value={bureau.lateCount} tone={bureau.lateCount > 0 ? 'danger' : undefined} href="/taches?echeance=retard" />
                <Stat label="Projets actifs" value={bureau.activeProjects} href="/projets" />
                <Stat label="Événements à préparer" value={bureau.eventsToPrepare.length} href="/evenements" />
                <Stat label="Idées à examiner" value={bureau.ideasToReview} href="/idees?statut=nouvelle" />
              </div>
              {bureau.decisions.length > 0 ? (
                <div className="mt-6">
                  <p className="mb-2 text-sm font-medium">Points nécessitant une décision</p>
                  <ul className="flex flex-col gap-2">
                    {bureau.decisions.map((d) => (
                      <li key={d.label}>
                        <Link href={d.href} className="text-sm text-[var(--c-accent)] hover:underline">
                          {d.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium">Activité récente</p>
                {bureau.recentActivity.length === 0 ? (
                  <p className="text-sm text-[var(--c-ink-faint)]">Aucune activité pour le moment.</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {bureau.recentActivity.map((a) => (
                      <li key={a.id} className="text-[var(--c-ink-soft)]">
                        <span className="text-[var(--c-ink)]">{a.actor?.full_name ?? 'Système'}</span> · {a.summary}{' '}
                        <span className="text-xs text-[var(--c-ink-faint)]">{formatDateTime(a.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle action={<Link href="/annonces" className="text-sm text-[var(--c-accent)]">Tout voir</Link>}>Annonces</CardTitle>
            {announcements.length === 0 ? (
              <p className="text-sm text-[var(--c-ink-faint)]">Aucune annonce pour le moment.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {announcements.map((a) => (
                  <li key={a.id}>
                    <Link href="/annonces" className="text-sm font-medium hover:underline">
                      {a.pinned ? '📌 ' : ''}{a.title}
                    </Link>
                    <p className="text-xs text-[var(--c-ink-faint)]">
                      {formatDateTime(a.created_at)}{a.read ? '' : ' · nouvelle'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Mes projets actifs</CardTitle>
            {member.projects.length === 0 ? (
              <EmptyState title="Aucun projet actif" text="Vous serez ajouté à un projet par son responsable." />
            ) : (
              <ul className="flex flex-col gap-4">
                {member.projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projets/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    <div className="mt-2">
                      <ProgressBar value={p.progress} label={`Avancement de ${p.title}`} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Prochains événements</CardTitle>
            {member.events.length === 0 ? (
              <p className="text-sm text-[var(--c-ink-faint)]">Aucun événement programmé.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {member.events.map((e) => (
                  <li key={e.id}>
                    <Link href={`/evenements/${e.id}`} className="font-medium hover:underline">
                      {e.title}
                    </Link>
                    <p className="text-xs text-[var(--c-ink-faint)]">
                      {formatDateTime(e.starts_at)}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle action={<Link href="/notifications" className="text-sm text-[var(--c-accent)]">Tout voir</Link>}>Notifications</CardTitle>
            {member.notifications.length === 0 ? (
              <p className="text-sm text-[var(--c-ink-faint)]">Aucune notification.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {member.notifications.map((n) => (
                  <li key={n.id} className={n.read_at ? 'text-[var(--c-ink-soft)]' : ''}>
                    <Link href={n.link} className="text-sm hover:underline">
                      {n.title}
                    </Link>
                    <p className="text-xs text-[var(--c-ink-faint)]">{formatDateTime(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
