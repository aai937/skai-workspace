// Session et identité de l'appelant. Vérifiée côté serveur à chaque rendu et à chaque action.
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Viewer } from '@/lib/domain/permissions';

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  bio: string;
  role: 'bureau' | 'membre';
  is_active: boolean;
};

export type Session = {
  profile: ProfileRow;
  viewer: Viewer;
  poles: { id: string; slug: string; name: string }[];
};

// Lit la session une seule fois par requête (React cache).
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return null;
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, email, full_name, bio, role, is_active')
    .eq('id', user.id)
    .maybeSingle();
  const profile = profileData as ProfileRow | null;
  if (!profile) {
    return null;
  }

  const { data: membershipData } = await supabase
    .from('pole_memberships')
    .select('pole:poles!pole_id(id, slug, name, archived_at)')
    .eq('profile_id', user.id);

  type MembershipRow = { pole: { id: string; slug: string; name: string; archived_at: string | null } | null };
  const poles = ((membershipData ?? []) as unknown as MembershipRow[])
    .filter((m) => m.pole && !m.pole.archived_at)
    .map((m) => ({ id: m.pole!.id, slug: m.pole!.slug, name: m.pole!.name }));

  return {
    profile,
    poles,
    viewer: { id: profile.id, isBureau: profile.role === 'bureau' && profile.is_active, poleIds: poles.map((p) => p.id) },
  };
});

// Pour les pages privées : redirige si personne n'est connecté, ou si le compte n'est pas validé.
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect('/connexion');
  }
  if (!session.profile.is_active) {
    redirect('/en-attente');
  }
  return session;
}

// Pour les pages réservées au bureau.
export async function requireBureau(): Promise<Session> {
  const session = await requireSession();
  if (!session.viewer.isBureau) {
    redirect('/acces-refuse');
  }
  return session;
}
