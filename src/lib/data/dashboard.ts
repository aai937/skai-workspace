// Tableau de bord : chaque indicateur est calculé à partir des données réelles, selon le rôle de l'utilisateur.
import type { Session } from '@/lib/auth';
import { TASK_STATUSES, type TaskStatus } from '@/lib/domain/constants';
import { createClient } from '@/lib/supabase/server';
import { listActivity, listNotifications, type ActivityRow, type NotificationItem } from './activity';
import { listEvents, type EventListItem } from './events';
import { listIdeas } from './ideas';
import { listProjects, type ProjectWithProgress } from './projects';
import { dayKey, isLate, listTasks, type TaskListItem } from './tasks';
import { progressPercent } from '@/lib/domain/format';

export type MemberDashboard = {
  priorities: TaskListItem[];
  teamTasks: TaskListItem[];
  late: TaskListItem[];
  upcoming: TaskListItem[];
  blocked: TaskListItem[];
  projects: ProjectWithProgress[];
  events: EventListItem[];
  notifications: NotificationItem[];
};

export type BureauDashboard = {
  statusCounts: Record<TaskStatus, number>;
  lateCount: number;
  activeProjects: number;
  eventsToPrepare: EventListItem[];
  ideasToReview: number;
  recentActivity: ActivityRow[];
  decisions: { label: string; href: string }[];
};

function emptyStatusCounts(): Record<TaskStatus, number> {
  return Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
}

function countByStatus(tasks: TaskListItem[]): Record<TaskStatus, number> {
  const counts = emptyStatusCounts();
  for (const t of tasks) {
    counts[t.status] += 1;
  }
  return counts;
}

function inDays(task: TaskListItem, from: number, to: number): boolean {
  if (!task.due_date || task.status === 'terminee') return false;
  const diff = Math.round((new Date(`${task.due_date}T12:00:00Z`).getTime() - new Date(`${dayKey()}T12:00:00Z`).getTime()) / 86_400_000);
  return diff >= from && diff <= to;
}

const PRIORITY_RANK: Record<string, number> = { urgente: 0, haute: 1, normale: 2, basse: 3 };

export async function getMemberDashboard(session: Session): Promise<MemberDashboard> {
  const id = session.viewer.id;
  const [mine, events, notifications, projects] = await Promise.all([
    listTasks({ mine: id }),
    listEvents({ upcomingOnly: true }),
    listNotifications(5),
    listProjects(),
  ]);
  const open = mine.filter((t) => t.status !== 'terminee');
  const teamOpen = (await listTasks()).filter((t) => t.status !== 'terminee' && t.assignee?.id !== id);

  const supabase = await createClient();
  const { data: memberships } = await supabase.from('project_members').select('project_id').eq('profile_id', id);
  const memberProjectIds = new Set((memberships ?? []).map((m) => m.project_id as string));

  return {
    priorities: open
      .filter((t) => t.priority === 'urgente' || t.priority === 'haute' || isLate(t))
      .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9))
      .slice(0, 6),
    teamTasks: teamOpen.slice(0, 8),
    late: open.filter(isLate),
    upcoming: open.filter((t) => inDays(t, 0, 14)).slice(0, 6),
    blocked: open.filter((t) => t.status === 'bloquee'),
    projects: projects.filter((p) => p.lead?.id === id || memberProjectIds.has(p.id)).filter((p) => p.status !== 'termine' && p.status !== 'archive').slice(0, 5),
    events: events.slice(0, 4),
    notifications,
  };
}

export async function getBureauDashboard(): Promise<BureauDashboard> {
  const [tasks, projects, events, ideas, activity] = await Promise.all([
    listTasks(),
    listProjects(),
    listEvents({ upcomingOnly: true }),
    listIdeas('00000000-0000-0000-0000-000000000000', 'nouvelle'),
    listActivity({ limit: 8 }),
  ]);
  const blocked = tasks.filter((t) => t.status === 'bloquee');
  const cutoff = Date.now() + 60 * 86_400_000;

  return {
    statusCounts: countByStatus(tasks),
    lateCount: tasks.filter(isLate).length,
    activeProjects: projects.filter((p) => p.status === 'en_cours' || p.status === 'a_lancer').length,
    eventsToPrepare: events.filter((e) => e.status === 'preparation' && new Date(e.starts_at).getTime() < cutoff),
    ideasToReview: ideas.length,
    recentActivity: activity,
    decisions: [
      ...(ideas.length > 0 ? [{ label: `${ideas.length} idée(s) à examiner`, href: '/idees?statut=nouvelle' }] : []),
      ...blocked.map((t) => ({ label: `Blocage : ${t.title}`, href: `/taches/${t.id}` })),
    ],
  };
}
