// Lecture des projets, de leurs jalons et de leur avancement (calculé à partir des tâches et jalons réellement terminés).
import { createClient } from '@/lib/supabase/server';
import type { ProjectStatus, TaskPriority } from '@/lib/domain/constants';
import { progressPercent } from '@/lib/domain/format';
import type { CommentItem, TaskListItem } from './tasks';

export type ProjectListItem = {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  priority: TaskPriority;
  due_date: string | null;
  lead: { id: string; full_name: string } | null;
  project_poles: { pole: { id: string; slug: string; name: string } }[];
  tasks: { status: string }[];
  milestones: { completed_at: string | null }[];
  archived_at: string | null;
};

export type ProjectWithProgress = ProjectListItem & { progress: number; taskCount: number; doneCount: number };

export function withProgress(p: ProjectListItem): ProjectWithProgress {
  const total = p.tasks.length + p.milestones.length;
  const done = p.tasks.filter((t) => t.status === 'terminee').length + p.milestones.filter((m) => m.completed_at).length;
  return { ...p, progress: progressPercent(done, total), taskCount: p.tasks.length, doneCount: p.tasks.filter((t) => t.status === 'terminee').length };
}

const PROJECT_LIST = `
  id, title, description, status, priority, due_date, archived_at,
  lead:profiles!lead_id(id, full_name),
  project_poles(pole:poles!pole_id(id, slug, name)),
  tasks(status),
  milestones(completed_at)
`;

export async function listProjects(options: { includeArchived?: boolean } = {}): Promise<ProjectWithProgress[]> {
  const supabase = await createClient();
  let query = supabase.from('projects').select(PROJECT_LIST).order('created_at', { ascending: false });
  if (!options.includeArchived) {
    query = query.is('archived_at', null);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Lecture des projets impossible : ${error.message}`);
  }
  return ((data ?? []) as unknown as ProjectListItem[]).map(withProgress);
}

export type ProjectDetail = ProjectWithProgress & {
  objectives: string;
  deliverables: string;
  start_date: string | null;
  members: { id: string; full_name: string }[];
  milestonesDetail: { id: string; title: string; due_date: string; completed_at: string | null }[];
  taskItems: TaskListItem[];
  comments: CommentItem[];
  documents: { id: string; title: string; category: string }[];
};

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select(`${PROJECT_LIST}, objectives, deliverables, start_date`)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new Error(`Lecture du projet impossible : ${error.message}`);
  }
  if (!data) {
    return null;
  }
  const base = withProgress(data as unknown as ProjectListItem & { objectives: string; deliverables: string; start_date: string | null });

  const [members, milestones, tasks, comments, documents] = await Promise.all([
    supabase.from('project_members').select('profile:profiles!profile_id(id, full_name)').eq('project_id', id),
    supabase.from('milestones').select('id, title, due_date, completed_at').eq('project_id', id).order('due_date'),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, labels, blocked_reason, checklist_category, parent_id, creator_id, created_at, completed_at, pole:poles!pole_id(id, slug, name), assignee:profiles!assignee_id(id, full_name), project:projects!project_id(id, title), event:events!event_id(id, title)')
      .eq('project_id', id)
      .is('archived_at', null)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('comments')
      .select('id, body, created_at, edited_at, mentions, author:profiles!author_id(id, full_name)')
      .eq('target_type', 'project')
      .eq('target_id', id)
      .order('created_at'),
    supabase.from('documents').select('id, title, category').eq('project_id', id).is('archived_at', null),
  ]);

  return {
    ...base,
    objectives: (data as unknown as { objectives: string }).objectives,
    deliverables: (data as unknown as { deliverables: string }).deliverables,
    start_date: (data as unknown as { start_date: string | null }).start_date,
    members: ((members.data ?? []) as unknown as { profile: { id: string; full_name: string } }[]).map((m) => m.profile),
    milestonesDetail: (milestones.data ?? []) as ProjectDetail['milestonesDetail'],
    taskItems: (tasks.data ?? []) as unknown as TaskListItem[],
    comments: (comments.data ?? []) as unknown as CommentItem[],
    documents: (documents.data ?? []) as ProjectDetail['documents'],
  };
}
