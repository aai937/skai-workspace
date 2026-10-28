import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, LateBadge, LinkButton, PageHeader, PriorityBadge, TaskStatusBadge } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { LABELS, TASK_PRIORITIES, TASK_STATUSES, type TaskStatus } from '@/lib/domain/constants';
import { canCreateTask } from '@/lib/domain/permissions';
import { formatDate } from '@/lib/domain/format';
import { listPoles } from '@/lib/data/people';
import { listProjects } from '@/lib/data/projects';
import { isLate, listTasks, type TaskListItem } from '@/lib/data/tasks';

export const metadata: Metadata = { title: 'Tâches' };

const VIEWS = [
  { key: 'liste', label: 'Liste' },
  { key: 'kanban', label: 'Kanban' },
  { key: 'calendrier', label: 'Calendrier' },
  { key: 'mes-taches', label: 'Mes tâches' },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function filterHref(params: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const merged = { ...params, ...patch };
  const qs = Object.entries(merged)
    .filter(([, v]) => v)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&');
  return qs ? `/taches?${qs}` : '/taches';
}

function TaskCard({ task }: { task: TaskListItem }) {
  return (
    <li className="rounded-xl border border-[var(--c-line)] bg-[var(--c-surface)] p-3">
      <Link href={`/taches/${task.id}`} className="font-medium leading-snug hover:underline">
        {task.title}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        {isLate(task) ? <LateBadge /> : null}
      </div>
      <p className="mt-2 text-xs text-[var(--c-ink-faint)]">
        {task.assignee?.full_name ?? 'Non attribuée'}
        {task.due_date ? ` · ${formatDate(task.due_date)}` : ''}
      </p>
    </li>
  );
}

export default async function TachesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession();
  const raw = await searchParams;
  const view = one(raw.vue) ?? 'liste';
  const params: Record<string, string | undefined> = {
    vue: view === 'liste' ? undefined : view,
    pole: one(raw.pole),
    statut: one(raw.statut),
    priorite: one(raw.priorite),
    echeance: one(raw.echeance),
    projet: one(raw.projet),
    q: one(raw.q),
  };

  const [tasks, poles, projects] = await Promise.all([
    listTasks({
      poleId: params.pole,
      status: params.statut as TaskStatus | undefined,
      priority: params.priorite as (typeof TASK_PRIORITIES)[number] | undefined,
      projectId: params.projet,
      due: params.echeance === 'retard' ? 'overdue' : params.echeance === 'semaine' ? 'week' : params.echeance === 'aucune' ? 'none' : undefined,
      mine: view === 'mes-taches' ? session.viewer.id : undefined,
      search: params.q,
    }),
    listPoles(),
    listProjects(),
  ]);

  const creatablePoles = session.poles.filter((p) => canCreateTask(session.viewer));
  const canCreate = session.viewer.isBureau || creatablePoles.length > 0;
  const selectClass = 'min-h-9 rounded-lg border border-[var(--c-line)] bg-[var(--c-surface)] px-2 text-sm';

  return (
    <>
      <PageHeader
        title={view === 'mes-taches' || !session.viewer.isBureau ? 'Mes tâches' : 'Toutes les tâches'}
        description={session.viewer.isBureau
          ? 'Toutes les tâches de l’association. Filtrez par équipe, statut, priorité, projet ou échéance.'
          : 'Les tâches qui vous sont attribuées, et celles de vos équipes. Mettez à jour votre avancement en un clic.'}
        actions={canCreate ? <LinkButton href="/taches/nouvelle">Nouvelle tâche</LinkButton> : null}
      />

      <nav aria-label="Vues" className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={filterHref(params, { vue: v.key === 'liste' ? undefined : v.key })}
            aria-current={view === v.key ? 'page' : undefined}
            className={`rounded-full px-3 py-1.5 text-sm ${view === v.key ? 'bg-[var(--c-ink)] text-[var(--c-canvas)]' : 'border border-[var(--c-line)] text-[var(--c-ink-soft)]'}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <form className="mb-6 flex flex-wrap items-end gap-2" action="/taches" method="get">
        {view !== 'liste' ? <input type="hidden" name="vue" value={view} /> : null}
        <label className="flex flex-col text-xs text-[var(--c-ink-soft)]">
          Recherche
          <input name="q" defaultValue={params.q} className={`${selectClass} w-44`} placeholder="Titre de la tâche" />
        </label>
        <label className="flex flex-col text-xs text-[var(--c-ink-soft)]">
          Équipe
          <select name="pole" defaultValue={params.pole ?? ''} className={selectClass}>
            <option value="">Tous</option>
            {poles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-[var(--c-ink-soft)]">
          Statut
          <select name="statut" defaultValue={params.statut ?? ''} className={selectClass}>
            <option value="">Tous</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{LABELS.taskStatus[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-[var(--c-ink-soft)]">
          Priorité
          <select name="priorite" defaultValue={params.priorite ?? ''} className={selectClass}>
            <option value="">Toutes</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>{LABELS.taskPriority[p]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-[var(--c-ink-soft)]">
          Projet
          <select name="projet" defaultValue={params.projet ?? ''} className={selectClass}>
            <option value="">Tous</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-[var(--c-ink-soft)]">
          Échéance
          <select name="echeance" defaultValue={params.echeance ?? ''} className={selectClass}>
            <option value="">Toutes</option>
            <option value="retard">En retard</option>
            <option value="semaine">Sous 7 jours</option>
            <option value="aucune">Sans échéance</option>
          </select>
        </label>
        <button type="submit" className="min-h-9 rounded-lg bg-[var(--c-accent)] px-4 text-sm font-medium text-[var(--c-accent-ink)]">
          Filtrer
        </button>
        <Link href={filterHref({ vue: params.vue }, {})} className="min-h-9 self-center text-sm text-[var(--c-accent)]">
          Réinitialiser
        </Link>
      </form>

      {tasks.length === 0 ? (
        <EmptyState
          title="Aucune tâche ne correspond"
          text={canCreate ? 'Créez une tâche ou modifiez les filtres.' : 'Modifiez les filtres pour élargir la recherche.'}
          action={canCreate ? <LinkButton href="/taches/nouvelle">Créer une tâche</LinkButton> : undefined}
        />
      ) : view === 'kanban' ? (
        <div className="grid gap-3 overflow-x-auto md:grid-cols-3 xl:grid-cols-6">
          {TASK_STATUSES.map((status) => {
            const column = tasks.filter((t) => t.status === status);
            return (
              <section key={status} aria-label={LABELS.taskStatus[status]} className="min-w-56 rounded-2xl bg-[var(--c-surface-muted)] p-3">
                <h2 className="mb-3 flex items-center justify-between text-sm font-semibold">
                  {LABELS.taskStatus[status]}
                  <span className="text-xs text-[var(--c-ink-faint)]">{column.length}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {column.map((t) => (
                    <TaskCard key={t.id} task={t} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : view === 'calendrier' ? (
        <CalendarView tasks={tasks} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)]">
          <ul className="divide-y divide-[var(--c-line)]">
            {tasks.map((t) => (
              <li key={t.id} className="grid gap-2 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <Link href={`/taches/${t.id}`} className="font-medium hover:underline">
                    {t.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-[var(--c-ink-faint)]">
                    {t.pole?.name ?? 'Sans équipe'} · {t.assignee?.full_name ?? 'Non attribuée'}
                    {t.project ? ` · ${t.project.title}` : ''}
                    {t.due_date ? ` · échéance ${formatDate(t.due_date)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <PriorityBadge priority={t.priority} />
                  <TaskStatusBadge status={t.status} />
                  {isLate(t) ? <LateBadge /> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

// Vue calendrier : tâches groupées par échéance (une section par jour, sans échéance en fin de liste).
function CalendarView({ tasks }: { tasks: TaskListItem[] }) {
  const dated = tasks.filter((t) => t.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const undated = tasks.filter((t) => !t.due_date);
  const groups = new Map<string, TaskListItem[]>();
  for (const t of dated) {
    groups.set(t.due_date!, [...(groups.get(t.due_date!) ?? []), t]);
  }
  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([day, list]) => (
        <section key={day} aria-label={formatDate(day)} className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold capitalize">{formatDate(day)}</h2>
          <ul className="flex flex-col gap-2">
            {list.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link href={`/taches/${t.id}`} className="hover:underline">{t.title}</Link>
                <span className="flex items-center gap-1.5">
                  <TaskStatusBadge status={t.status} />
                  {isLate(t) ? <LateBadge /> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {undated.length > 0 ? (
        <section className="rounded-2xl border border-dashed border-[var(--c-line)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Sans échéance</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {undated.map((t) => (
              <li key={t.id}>
                <Link href={`/taches/${t.id}`} className="hover:underline">{t.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
