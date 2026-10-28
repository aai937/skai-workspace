// Lecture des tâches. Les filtres sont appliqués en base ; la sécurité reste assurée par RLS.
import { createClient } from '@/lib/supabase/server';
import type { ChecklistCategory, TaskPriority, TaskStatus } from '@/lib/domain/constants';
import { parseDateOnly } from '@/lib/domain/format';
import { TIME_ZONE } from '@/lib/domain/format';

export type TaskListItem = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  labels: string[];
  blocked_reason: string | null;
  checklist_category: ChecklistCategory | null;
  parent_id: string | null;
  pole: { id: string; slug: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
  project: { id: string; title: string } | null;
  event: { id: string; title: string } | null;
  creator_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type TaskFilters = {
  poleId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  due?: 'overdue' | 'week' | 'none';
  mine?: string;
  search?: string;
};

const LIST_COLUMNS = `
  id, title, status, priority, due_date, labels, blocked_reason, checklist_category, parent_id,
  creator_id, created_at, completed_at,
  pole:poles!pole_id(id, slug, name),
  assignee:profiles!assignee_id(id, full_name),
  project:projects!project_id(id, title),
  event:events!event_id(id, title)
`;

// Date du jour et de la semaine à venir, au fuseau de l'association (clés AAAA-MM-JJ).
export function dayKey(offsetDays = 0, now = new Date()): string {
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  return shifted.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
}

export async function listTasks(filters: TaskFilters = {}): Promise<TaskListItem[]> {
  const supabase = await createClient();
  let query = supabase.from('tasks').select(LIST_COLUMNS).is('archived_at', null).order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).limit(500);

  if (filters.poleId) query = query.eq('pole_id', filters.poleId);
  if (filters.assigneeId) query = query.eq('assignee_id', filters.assigneeId);
  if (filters.mine) query = query.eq('assignee_id', filters.mine);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.projectId) query = query.eq('project_id', filters.projectId);
  if (filters.due === 'overdue') query = query.lt('due_date', dayKey()).neq('status', 'terminee');
  if (filters.due === 'week') query = query.gte('due_date', dayKey()).lte('due_date', dayKey(7));
  if (filters.due === 'none') query = query.is('due_date', null);
  if (filters.search) {
    const term = filters.search.replace(/[%_,()]/g, ' ').trim();
    if (term) query = query.ilike('title', `%${term}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Lecture des tâches impossible : ${error.message}`);
  }
  return (data ?? []) as unknown as TaskListItem[];
}

export type TaskDetail = TaskListItem & {
  description: string;
  updated_at: string;
  creator: { id: string; full_name: string } | null;
  subtasks: TaskListItem[];
  collaborators: { id: string; full_name: string }[];
  comments: CommentItem[];
  history: ActivityItem[];
};

export type CommentItem = {
  id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author: { id: string; full_name: string } | null;
  mentions: string[];
};

export type ActivityItem = {
  id: number;
  action: string;
  summary: string;
  created_at: string;
  actor: { id: string; full_name: string } | null;
};

export async function getTask(id: string): Promise<TaskDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select(
      `${LIST_COLUMNS}, description, updated_at,
       creator:profiles!creator_id(id, full_name)`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new Error(`Lecture de la tâche impossible : ${error.message}`);
  }
  if (!data) {
    return null;
  }
  const task = data as unknown as TaskDetail;

  const [subtasks, collaborators, comments, history] = await Promise.all([
    supabase.from('tasks').select(LIST_COLUMNS).eq('parent_id', id).is('archived_at', null).order('created_at'),
    supabase.from('task_collaborators').select('profile:profiles!profile_id(id, full_name)').eq('task_id', id),
    supabase
      .from('comments')
      .select('id, body, created_at, edited_at, mentions, author:profiles!author_id(id, full_name)')
      .eq('target_type', 'task')
      .eq('target_id', id)
      .order('created_at'),
    supabase
      .from('activity_log')
      .select('id, action, summary, created_at, actor:profiles!actor_id(id, full_name)')
      .eq('entity_type', 'tasks')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  task.subtasks = (subtasks.data ?? []) as unknown as TaskListItem[];
  task.collaborators = ((collaborators.data ?? []) as unknown as { profile: { id: string; full_name: string } }[]).map(
    (c) => c.profile,
  );
  task.comments = (comments.data ?? []) as unknown as CommentItem[];
  task.history = (history.data ?? []) as unknown as ActivityItem[];
  return task;
}

// Éléments de checklist d'un événement (tâches liées à l'événement avec une catégorie).
export async function listChecklist(eventId: string): Promise<TaskListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select(LIST_COLUMNS)
    .eq('event_id', eventId)
    .not('checklist_category', 'is', null)
    .is('archived_at', null)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) {
    throw new Error(`Lecture de la checklist impossible : ${error.message}`);
  }
  return (data ?? []) as unknown as TaskListItem[];
}

export function isLate(task: Pick<TaskListItem, 'due_date' | 'status'>): boolean {
  return !!task.due_date && task.status !== 'terminee' && parseDateOnly(task.due_date).getTime() < parseDateOnly(dayKey()).getTime();
}
