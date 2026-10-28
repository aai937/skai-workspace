import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardTitle, EmptyState, LateBadge, LinkButton, PageHeader, PriorityBadge, ProgressBar, Stat, TaskStatusBadge } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listAnnouncements } from '@/lib/data/messaging';
import { LABELS } from '@/lib/domain/constants';
import { TIME_ZONE, formatDate, formatDateTime } from '@/lib/domain/format';
import { getBureauDashboard, getMemberDashboard } from '@/lib/data/dashboard';
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
          {task.pole?.name ?? 'Sans équipe'}
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

// Répartition des tâches par statut : une barre et une légende, au lieu d'une case par statut.
function StatusBar({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="flex flex-col gap-3">
      {total > 0 ? (
        <div className="flex h-2 overflow-hidden rounded-full bg-[var(--c-surface-muted)]" role="img" aria-label="Répartition des tâches par statut">
          {Object.entries(counts).map(([status, n]) =>
            n > 0 ? (
              <span key={status} className={STATUS_BAR[status] ?? 'bg-[var(--c-line-strong)]'} style={{ width: `${(n / total) * 100}%` }} />
            ) : null,
          )}
        </div>
      ) : null}
      <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {Object.entries(counts).map(([status, n]) => (
          <li key={status}>
            <Link href={`/taches?statut=${status}`} className="flex items-center justify-between gap-2 rounded-md py-1 hover:text-[var(--c-accent)]">
              <span className="flex items-center gap-2 text-[var(--c-ink-soft)]">
                <span className={`size-2 rounded-full ${STATUS_BAR[status] ?? 'bg-[var(--c-line-strong)]'}`} aria-hidden="true" />
                {LABELS.taskStatus[status as keyof typeof LABELS.taskStatus]}
              </span>
              <span className="font-semibold tabular-nums">{n}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS_BAR: Record<string, string> = {
  a_faire: 'bg-[var(--c-line-strong)]',
  en_cours: 'bg-[var(--c-accent)]',
  en_attente: 'bg-[var(--c-warning)]',
  bloquee: 'bg-[var(--c-danger)]',
  en_revue: 'bg-[var(--c-ink-faint)]',
  terminee: 'bg-[var(--c-success)]',
};

// « Bonjour » jusqu'à 18 h, « Bonsoir » ensuite (heure de Paris).
function salutation(): string {
  const heure = Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hour12: false, timeZone: TIME_ZONE }).format(new Date()));
  return heure < 18 ? 'Bonjour' : 'Bonsoir';
}

export default async function TableauDeBordPage() {
  const session = await requireSession();
  const greeting = session.profile.full_name.split(' ')[0];
  const isBureau = session.viewer.isBureau;

  const member = await getMemberDashboard(session);
  const bureau = isBureau ? await getBureauDashboard() : null;
  const announcements = (await listAnnouncements(session.viewer.id)).slice(0, 3);

  return (
    <>
      <PageHeader
        title={`${salutation()} ${greeting}`}
        description={
          isBureau
            ? 'Vue globale de l’association : ce qui avance, ce qui bloque et ce qui attend une décision.'
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

          {bureau ? (
            <Card>
              <CardTitle>Vue du bureau</CardTitle>
              <StatusBar counts={bureau.statusCounts} />
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
