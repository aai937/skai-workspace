// Lecture des idées : liste, votes, décisions et commentaires.
import { createClient } from '@/lib/supabase/server';
import type { IdeaEffort, IdeaStatus } from '@/lib/domain/constants';
import type { CommentItem } from './tasks';

export type IdeaListItem = {
  id: string;
  title: string;
  problem: string;
  status: IdeaStatus;
  effort: IdeaEffort;
  created_at: string;
  decision_note: string;
  author: { id: string; full_name: string } | null;
  pole: { id: string; slug: string; name: string } | null;
  idea_votes: { voter_id: string }[];
};

export type IdeaWithVotes = IdeaListItem & { votes: number; hasVoted: boolean };

const IDEA_COLUMNS = `
  id, title, problem, status, effort, created_at, decision_note,
  author:profiles!author_id(id, full_name),
  pole:poles!pole_id(id, slug, name),
  idea_votes(voter_id)
`;

export async function listIdeas(viewerId: string, status?: IdeaStatus): Promise<IdeaWithVotes[]> {
  const supabase = await createClient();
  let query = supabase.from('ideas').select(IDEA_COLUMNS).order('created_at', { ascending: false }).limit(200);
  if (status) {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Lecture des idées impossible : ${error.message}`);
  }
  return ((data ?? []) as unknown as IdeaListItem[]).map((idea) => ({
    ...idea,
    votes: idea.idea_votes.length,
    hasVoted: idea.idea_votes.some((v) => v.voter_id === viewerId),
  }));
}

export type IdeaDetail = IdeaWithVotes & {
  benefits: string;
  solution: string;
  decided_at: string | null;
  decider: { id: string; full_name: string } | null;
  comments: CommentItem[];
  project_id: string | null;
  task_id: string | null;
};

export async function getIdea(id: string, viewerId: string): Promise<IdeaDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ideas')
    .select(`${IDEA_COLUMNS}, benefits, solution, decided_at, project_id, task_id, decider:profiles!decided_by(id, full_name)`)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new Error(`Lecture de l'idée impossible : ${error.message}`);
  }
  if (!data) {
    return null;
  }
  const idea = data as unknown as IdeaListItem & Omit<IdeaDetail, keyof IdeaWithVotes>;
  const { data: comments } = await supabase
    .from('comments')
    .select('id, body, created_at, edited_at, mentions, author:profiles!author_id(id, full_name)')
    .eq('target_type', 'idea')
    .eq('target_id', id)
    .order('created_at');

  return {
    ...idea,
    votes: idea.idea_votes.length,
    hasVoted: idea.idea_votes.some((v) => v.voter_id === viewerId),
    comments: (comments ?? []) as unknown as CommentItem[],
  };
}
