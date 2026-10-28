// Lecture des événements, de leurs intervenants, de leur checklist et de leur préparation.
import { createClient } from '@/lib/supabase/server';
import type { EventStatus } from '@/lib/domain/constants';
import { progressPercent } from '@/lib/domain/format';
import { listChecklist, type CommentItem, type TaskListItem } from './tasks';

export type EventListItem = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  status: EventStatus;
  lead: { id: string; full_name: string } | null;
  event_poles: { pole: { id: string; slug: string; name: string } }[];
  archived_at: string | null;
};

const EVENT_COLUMNS = `
  id, title, starts_at, ends_at, location, status, archived_at,
  lead:profiles!lead_id(id, full_name),
  event_poles(pole:poles!pole_id(id, slug, name))
`;

export async function listEvents(options: { upcomingOnly?: boolean } = {}): Promise<EventListItem[]> {
  const supabase = await createClient();
  let query = supabase.from('events').select(EVENT_COLUMNS).is('archived_at', null).order('starts_at', { ascending: true });
  if (options.upcomingOnly) {
    query = query.gte('starts_at', new Date(Date.now() - 86_400_000).toISOString());
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Lecture des événements impossible : ${error.message}`);
  }
  return (data ?? []) as unknown as EventListItem[];
}

export type EventDetail = EventListItem & {
  description: string;
  budget_cents: number | null;
  logistics_notes: string;
  guests: { id: string; kind: 'intervenant' | 'partenaire'; name: string; organization: string }[];
  checklist: TaskListItem[];
  checklistProgress: number;
  comments: CommentItem[];
};

export async function getEvent(id: string): Promise<EventDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select(`${EVENT_COLUMNS}, description, budget_cents, logistics_notes`)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new Error(`Lecture de l'événement impossible : ${error.message}`);
  }
  if (!data) {
    return null;
  }
  const [guests, checklist, comments] = await Promise.all([
    supabase.from('event_guests').select('id, kind, name, organization').eq('event_id', id).order('name'),
    listChecklist(id),
    supabase
      .from('comments')
      .select('id, body, created_at, edited_at, mentions, author:profiles!author_id(id, full_name)')
      .eq('target_type', 'event')
      .eq('target_id', id)
      .order('created_at'),
  ]);
  const done = checklist.filter((c) => c.status === 'terminee').length;

  return {
    ...(data as unknown as EventDetail),
    guests: (guests.data ?? []) as EventDetail['guests'],
    checklist,
    checklistProgress: progressPercent(done, checklist.length),
    comments: (comments.data ?? []) as unknown as CommentItem[],
  };
}
