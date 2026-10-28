// Membres, équipes et invitations. Les coordonnées ne sont lues que pour le membre lui-même et le bureau (RLS).
import { createClient } from '@/lib/supabase/server';
import type { GlobalRole, PoleRole } from '@/lib/domain/constants';
import type { TaskListItem } from './tasks';

export type MemberRow = {
  id: string;
  email: string;
  full_name: string;
  bio: string;
  role: GlobalRole;
  is_active: boolean;
  is_site_admin: boolean;
  pole_memberships: { role: PoleRole; pole: { id: string; slug: string; name: string; archived_at: string | null } | null }[];
};

export async function listMembers(): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, bio, role, is_active, is_site_admin, pole_memberships(role, pole:poles!pole_id(id, slug, name, archived_at))')
    .order('full_name');
  if (error) {
    throw new Error(`Lecture des membres impossible : ${error.message}`);
  }
  return (data ?? []) as unknown as MemberRow[];
}

export type PoleSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  archived_at: string | null;
  pole_memberships: { role: PoleRole; profile: { id: string; full_name: string } | null }[];
};

export async function listPoles(): Promise<PoleSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('poles')
    .select('id, slug, name, description, archived_at, pole_memberships(role, profile:profiles!profile_id(id, full_name))')
    .is('archived_at', null)
    .order('position');
  if (error) {
    throw new Error(`Lecture des équipes impossible : ${error.message}`);
  }
  return (data ?? []) as unknown as PoleSummary[];
}

export async function getPoleTasks(poleId: string): Promise<TaskListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tasks')
    .select('id, title, status, priority, due_date, labels, blocked_reason, checklist_category, parent_id, creator_id, created_at, completed_at, pole:poles!pole_id(id, slug, name), assignee:profiles!assignee_id(id, full_name), project:projects!project_id(id, title), event:events!event_id(id, title)')
    .eq('pole_id', poleId)
    .is('archived_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(200);
  return (data ?? []) as unknown as TaskListItem[];
}

export async function getProfileContacts(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('member_contacts').select('professional_email, phone').eq('profile_id', profileId).maybeSingle();
  return data as { professional_email: string | null; phone: string | null } | null;
}

export async function listPendingInvitations() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('invitations')
    .select('email, role, created_at, accepted_at')
    .is('accepted_at', null)
    .order('created_at', { ascending: false });
  return (data ?? []) as { email: string; role: GlobalRole; created_at: string; accepted_at: string | null }[];
}
