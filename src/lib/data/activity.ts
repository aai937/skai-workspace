// Notifications, journal d'activité, documents et recherche globale.
import { createClient } from '@/lib/supabase/server';
import type { DocumentCategory, DocumentVisibility } from '@/lib/domain/constants';

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
  actor: { id: string; full_name: string } | null;
};

export async function listNotifications(limit = 50): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('id, kind, title, body, link, read_at, created_at, actor:profiles!actor_id(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as NotificationItem[];
}

export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  return count ?? 0;
}

export type ActivityRow = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
  actor: { id: string; full_name: string } | null;
};

export async function listActivity(options: { entityType?: string; limit?: number } = {}): Promise<ActivityRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('activity_log')
    .select('id, action, entity_type, entity_id, summary, created_at, actor:profiles!actor_id(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 80);
  if (options.entityType) {
    query = query.eq('entity_type', options.entityType);
  }
  const { data } = await query;
  return (data ?? []) as unknown as ActivityRow[];
}

export type DocumentRow = {
  id: string;
  title: string;
  description: string;
  category: DocumentCategory;
  visibility: DocumentVisibility;
  tags: string[];
  mime_type: string;
  size_bytes: number;
  created_at: string;
  pole: { id: string; slug: string; name: string } | null;
  project: { id: string; title: string } | null;
  uploader: { id: string; full_name: string } | null;
};

export async function listDocuments(filters: { category?: string; poleId?: string; q?: string } = {}): Promise<DocumentRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('documents')
    .select('id, title, description, category, visibility, tags, mime_type, size_bytes, created_at, pole:poles!pole_id(id, slug, name), project:projects!project_id(id, title), uploader:profiles!uploaded_by(id, full_name)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.poleId) query = query.eq('pole_id', filters.poleId);
  if (filters.q) {
    const term = filters.q.replace(/[%_,()]/g, ' ').trim();
    if (term) query = query.ilike('title', `%${term}%`);
  }
  const { data } = await query;
  return (data ?? []) as unknown as DocumentRow[];
}

export async function getDocumentForDownload(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('documents').select('id, title, storage_path').eq('id', id).maybeSingle();
  return data as { id: string; title: string; storage_path: string } | null;
}

// Recherche globale : tâches, projets, idées, événements et documents accessibles.
export async function searchAll(term: string) {
  const supabase = await createClient();
  const q = term.replace(/[%_,()]/g, ' ').trim();
  if (q.length < 2) {
    return { tasks: [], projects: [], ideas: [], events: [], documents: [] };
  }
  const pattern = `%${q}%`;
  const [tasks, projects, ideas, events, documents] = await Promise.all([
    supabase.from('tasks').select('id, title, status').is('archived_at', null).ilike('title', pattern).limit(8),
    supabase.from('projects').select('id, title, status').is('archived_at', null).ilike('title', pattern).limit(8),
    supabase.from('ideas').select('id, title, status').ilike('title', pattern).limit(8),
    supabase.from('events').select('id, title, starts_at').is('archived_at', null).ilike('title', pattern).limit(8),
    supabase.from('documents').select('id, title, category').is('archived_at', null).ilike('title', pattern).limit(8),
  ]);
  return {
    tasks: tasks.data ?? [],
    projects: projects.data ?? [],
    ideas: ideas.data ?? [],
    events: events.data ?? [],
    documents: documents.data ?? [],
  };
}
