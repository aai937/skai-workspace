// Lecture de la messagerie et des annonces (RLS appliquée).
import { createClient } from '@/lib/supabase/server';

export type ChannelRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: 'general' | 'pole' | 'projet' | 'evenement' | 'libre';
  created_by: string | null;
};

export async function listChannels(): Promise<ChannelRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('channels')
    .select('id, slug, name, description, kind, created_by')
    .is('archived_at', null)
    .order('kind')
    .order('name');
  if (error) {
    throw new Error(`Lecture des canaux impossible : ${error.message}`);
  }
  return (data ?? []) as ChannelRow[];
}

export async function getChannel(id: string): Promise<ChannelRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('channels')
    .select('id, slug, name, description, kind, created_by')
    .eq('id', id)
    .maybeSingle();
  return (data as ChannelRow | null) ?? null;
}

export type ReactionSummary = { emoji: string; count: number; mine: boolean };

export type MessageItem = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  author: { id: string; full_name: string } | null;
  reactions: ReactionSummary[];
  replyCount: number;
};

// Messages d'un canal (racines et réponses). Les réactions sont regroupées par emoji.
export async function listMessages(channelId: string, viewerId: string): Promise<{ roots: MessageItem[]; replies: Record<string, MessageItem[]> }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('messages')
    .select(
      'id, parent_id, body, created_at, edited_at, deleted_at, author:profiles!author_id(id, full_name), message_reactions(emoji, profile_id)',
    )
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) {
    throw new Error(`Lecture des messages impossible : ${error.message}`);
  }

  type Raw = Omit<MessageItem, 'reactions' | 'replyCount'> & {
    message_reactions: { emoji: string; profile_id: string }[];
  };
  const all = ((data ?? []) as unknown as Raw[]).map((m): MessageItem => {
    const counts = new Map<string, ReactionSummary>();
    for (const r of m.message_reactions) {
      const entry = counts.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
      entry.count += 1;
      entry.mine ||= r.profile_id === viewerId;
      counts.set(r.emoji, entry);
    }
    return {
      id: m.id,
      parent_id: m.parent_id,
      body: m.body,
      created_at: m.created_at,
      edited_at: m.edited_at,
      deleted_at: m.deleted_at,
      author: m.author,
      reactions: [...counts.values()],
      replyCount: 0,
    };
  });

  const replies: Record<string, MessageItem[]> = {};
  for (const m of all) {
    if (m.parent_id) {
      replies[m.parent_id] = [...(replies[m.parent_id] ?? []), m];
    }
  }
  const roots = all
    .filter((m) => !m.parent_id)
    .map((m) => ({ ...m, replyCount: replies[m.id]?.length ?? 0 }));
  return { roots, replies };
}

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  audience: 'tous' | 'pole';
  pole: { id: string; name: string } | null;
  pinned: boolean;
  created_at: string;
  author: { id: string; full_name: string } | null;
  read: boolean;
};

export async function listAnnouncements(viewerId: string): Promise<AnnouncementItem[]> {
  const supabase = await createClient();
  const [{ data, error }, { data: reads }] = await Promise.all([
    supabase
      .from('announcements')
      .select('id, title, body, audience, pinned, created_at, pole:poles!pole_id(id, name), author:profiles!author_id(id, full_name)')
      .is('archived_at', null)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('announcement_reads').select('announcement_id').eq('profile_id', viewerId),
  ]);
  if (error) {
    throw new Error(`Lecture des annonces impossible : ${error.message}`);
  }
  const readIds = new Set((reads ?? []).map((r) => r.announcement_id as string));
  return ((data ?? []) as unknown as Omit<AnnouncementItem, 'read'>[]).map((a) => ({ ...a, read: readIds.has(a.id) }));
}

export async function countUnreadAnnouncements(viewerId: string): Promise<number> {
  const all = await listAnnouncements(viewerId);
  return all.filter((a) => !a.read).length;
}
