'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession, requireSiteAdmin } from '@/lib/auth';
import { canAssignPoleRole, canManagePoleMembers, canManagePoles } from '@/lib/domain/permissions';
import { memberInviteSchema, poleSchema, profileSchema } from '@/lib/domain/schemas';
import { dbErrorMessage, fail, ok, zodFieldErrors, type ActionResult } from '@/lib/result';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/site';
import { POLE_ROLES, type PoleRole } from '@/lib/domain/constants';

// Invitation par le bureau : enregistre l'adresse puis envoie le lien d'activation (clé service, côté serveur).
// Sans invitation, un compte créé reste inactif et ne voit aucune donnée.
export async function inviteMemberAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSiteAdmin();
  const parsed = memberInviteSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role') ?? 'membre',
    poleId: formData.get('poleId') ?? '',
    poleRole: formData.get('poleRole') ?? 'membre',
  });
  if (!parsed.success) {
    return fail('Adresse ou rôle invalide.', zodFieldErrors(parsed.error.issues));
  }
  const input = parsed.data;

  const supabase = await createClient();
  const { error: inviteError } = await supabase
    .from('invitations')
    .upsert({ email: input.email, role: input.role, invited_by: session.viewer.id, accepted_at: null }, { onConflict: 'email' });
  if (inviteError) {
    return fail(dbErrorMessage(inviteError));
  }

  // Lien d'invitation généré côté serveur : pas d'envoi de mail, le bureau le transmet lui-même.
  const admin = createAdminClient();
  const origin = await siteOrigin();
  const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: input.email,
    options: { redirectTo: `${origin}/definir-mot-de-passe` },
  });
  const hashed = generated?.properties?.hashed_token;
  if (linkError || !hashed) {
    return fail("Le lien d’invitation n’a pas pu être créé. Réessayez dans quelques minutes.");
  }
  const link = `${origin}/auth/confirm?token_hash=${hashed}&type=invite&next=/definir-mot-de-passe`;

  if (input.poleId && input.poleRole) {
    const { data: invited } = await admin.from('profiles').select('id').eq('email', input.email).maybeSingle();
    if (invited) {
      await supabase
        .from('pole_memberships')
        .upsert({ profile_id: invited.id, pole_id: input.poleId, role: input.poleRole }, { onConflict: 'profile_id,pole_id' });
    }
  }

  revalidatePath('/parametres/membres');
  return ok(undefined, `Lien d’invitation pour ${input.email} (à copier et envoyer vous-même, valable 1 heure) : ${link}`);
}

// Activation ou désactivation d'un compte (bureau).
export async function setMemberActiveAction(profileId: string, active: boolean): Promise<ActionResult> {
  await requireSiteAdmin();
  const parsed = z.object({ profileId: z.uuid(), active: z.boolean() }).safeParse({ profileId, active });
  if (!parsed.success) {
    return fail('Données invalides.');
  }
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ is_active: active }).eq('id', profileId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/parametres/membres');
  return ok(undefined, active ? 'Compte validé.' : 'Compte désactivé.');
}

export async function setMemberGlobalRoleAction(profileId: string, role: 'bureau' | 'membre'): Promise<ActionResult> {
  const session = await requireSiteAdmin();
  if (profileId === session.viewer.id && role !== 'bureau') {
    return fail('Vous ne pouvez pas retirer votre propre rôle de bureau.');
  }
  const parsed = z.object({ profileId: z.uuid(), role: z.enum(['bureau', 'membre']) }).safeParse({ profileId, role });
  if (!parsed.success) {
    return fail('Données invalides.');
  }
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/parametres/membres');
  return ok(undefined, 'Rôle mis à jour.');
}

// Affectation à une équipe : le bureau attribue tout ; un responsable ajoute des membres simples à son équipe.
export async function setPoleMembershipAction(
  profileId: string,
  poleId: string,
  role: PoleRole | 'retirer',
): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z
    .object({ profileId: z.uuid(), poleId: z.uuid(), role: z.enum([...POLE_ROLES, 'retirer']) })
    .safeParse({ profileId, poleId, role });
  if (!parsed.success) {
    return fail('Données invalides.');
  }
  if (!canManagePoleMembers(session.viewer)) {
    return fail("Vous ne gérez pas cette équipe.");
  }
  if (parsed.data.role !== 'retirer' && !canAssignPoleRole(session.viewer)) {
    return fail('Seul le bureau peut nommer un responsable d'équipe.');
  }
  const supabase = await createClient();
  const { error } =
    parsed.data.role === 'retirer'
      ? await supabase.from('pole_memberships').delete().eq('profile_id', profileId).eq('pole_id', poleId)
      : await supabase
          .from('pole_memberships')
          .upsert({ profile_id: profileId, pole_id: poleId, role: parsed.data.role }, { onConflict: 'profile_id,pole_id' });
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/parametres/membres');
  revalidatePath('/poles');
  return ok(undefined, 'Affectation enregistrée.');
}

// Formulaire d’affectation à une équipe (une ligne par membre dans l’interface du bureau).
export async function assignPoleFormAction(formData: FormData): Promise<ActionResult> {
  const role = formData.get('role');
  return setPoleMembershipAction(
    String(formData.get('profileId') ?? ''),
    String(formData.get('poleId') ?? ''),
    (role === 'responsable' || role === 'membre' || role === 'retirer' ? role : 'retirer') as PoleRole | 'retirer',
  );
}

// Chaque membre modifie son profil et ses coordonnées (les coordonnées ne sont visibles que de lui et du bureau).
export async function updateOwnProfileAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = profileSchema.safeParse({
    fullName: formData.get('fullName'),
    bio: formData.get('bio') ?? '',
    professionalEmail: formData.get('professionalEmail') ?? '',
    phone: formData.get('phone') ?? '',
  });
  if (!parsed.success) {
    return fail('Vérifiez les champs du profil.', zodFieldErrors(parsed.error.issues));
  }
  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName, bio: parsed.data.bio })
    .eq('id', session.viewer.id);
  if (profileError) {
    return fail(dbErrorMessage(profileError));
  }
  const { error: contactError } = await supabase.from('member_contacts').upsert({
    profile_id: session.viewer.id,
    professional_email: parsed.data.professionalEmail,
    phone: parsed.data.phone,
    updated_at: new Date().toISOString(),
  });
  if (contactError) {
    return fail(dbErrorMessage(contactError));
  }
  revalidatePath('/profil');
  revalidatePath('/membres');
  return ok(undefined, 'Profil enregistré.');
}

// Équipes : création et modification par le bureau, sans toucher au code.
export async function savePoleAction(poleId: string | null, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  if (!canManagePoles(session.viewer)) {
    return fail('Seul le bureau gère les équipes.');
  }
  const parsed = poleSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    slug: formData.get('slug'),
  });
  if (!parsed.success) {
    return fail('Vérifiez les champs de l'équipe.', zodFieldErrors(parsed.error.issues));
  }
  const supabase = await createClient();
  const { error } = poleId
    ? await supabase.from('poles').update({ name: parsed.data.name, description: parsed.data.description }).eq('id', poleId)
    : await supabase.from('poles').insert({ name: parsed.data.name, description: parsed.data.description, slug: parsed.data.slug });
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/poles');
  revalidatePath('/parametres/membres');
  return ok(undefined, 'Équipe enregistré.');
}

// Fréquence des mails de synthèse : chaque membre choisit la sienne.
export async function updateMailPreferenceAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z.object({ digest: z.enum(['quotidien', 'hebdomadaire', 'desactive']) }).safeParse({
    digest: formData.get('digest'),
  });
  if (!parsed.success) {
    return fail('Choisissez une fréquence valide.');
  }
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ email_digest: parsed.data.digest }).eq('id', session.viewer.id);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/profil');
  return ok(undefined, 'Préférence enregistrée.');
}

// Nouveau lien de calendrier : l'ancien cesse immédiatement de fonctionner.
export async function regenerateCalendarTokenAction(): Promise<ActionResult> {
  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ calendar_token: crypto.randomUUID() })
    .eq('id', session.viewer.id);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/profil');
  return ok(undefined, 'Nouveau lien de calendrier généré.');
}

// Actions groupées sur plusieurs membres : valider, désactiver, ajouter à une équipe, retirer d'une équipe.
export async function bulkMembersAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSiteAdmin();
  const action = z.enum(['valider', 'desactiver', 'affecter', 'retirer']).safeParse(formData.get('action'));
  const ids = z.array(z.uuid()).min(1, 'Sélectionnez au moins un membre.').safeParse(formData.getAll('profileIds'));
  if (!action.success) {
    return fail('Choisissez une action.');
  }
  if (!ids.success) {
    return fail(ids.error.issues[0]?.message ?? 'Sélection invalide.');
  }
  // On ne désactive pas son propre compte depuis cette liste.
  const targets = action.data === 'desactiver' ? ids.data.filter((id) => id !== session.viewer.id) : ids.data;
  const supabase = await createClient();

  if (action.data === 'valider' || action.data === 'desactiver') {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active: action.data === 'valider' })
      .in('id', targets)
      .select('id');
    if (error) {
      return fail(dbErrorMessage(error));
    }
    revalidatePath('/parametres/membres');
    return ok(undefined, `${data?.length ?? 0} membre(s) mis à jour.`);
  }

  const team = z.uuid('Choisissez une équipe.').safeParse(formData.get('poleId'));
  if (!team.success) {
    return fail(team.error.issues[0]?.message ?? 'Choisissez une équipe.');
  }
  if (action.data === 'affecter') {
    const { error } = await supabase
      .from('pole_memberships')
      .upsert(targets.map((profile_id) => ({ profile_id, pole_id: team.data, role: 'membre' })), { onConflict: 'profile_id,pole_id' });
    if (error) {
      return fail(dbErrorMessage(error));
    }
    revalidatePath('/parametres/membres');
    return ok(undefined, `${targets.length} membre(s) ajouté(s) à l’équipe.`);
  }

  const { error } = await supabase.from('pole_memberships').delete().eq('pole_id', team.data).in('profile_id', targets);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/parametres/membres');
  return ok(undefined, `${targets.length} membre(s) retiré(s) de l’équipe.`);
}

// Archivage d'une équipe : elle disparaît des listes, son historique reste.
export async function setTeamArchivedAction(poleId: string, archived: boolean): Promise<ActionResult> {
  await requireSiteAdmin();
  const parsed = z.object({ id: z.uuid(), archived: z.boolean() }).safeParse({ id: poleId, archived });
  if (!parsed.success) {
    return fail('Équipe introuvable.');
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('poles')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', poleId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/parametres/membres');
  revalidatePath('/poles');
  return ok(undefined, archived ? 'Équipe archivée.' : 'Équipe réactivée.');
}

// Modification d'un membre : nom et équipes pour le bureau ; rôle réservé à l'administrateur du site.
export async function updateMemberAction(profileId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireSiteAdmin();
  const id = z.uuid().safeParse(profileId);
  const name = z.string().trim().min(2, 'Le nom doit compter au moins 2 caractères.').max(120).safeParse(formData.get('fullName'));
  if (!id.success || !name.success) {
    return fail(!name.success ? name.error.issues[0]?.message ?? 'Nom invalide.' : 'Membre introuvable.');
  }
  const role = formData.get('role');
  const wantsRole = role === 'bureau' || role === 'membre';
  if (wantsRole && !session.profile.is_site_admin) {
    return fail('Seul l’administrateur du site nomme ou retire les membres du bureau.');
  }
  if (wantsRole && id.data === session.viewer.id && role !== 'bureau') {
    return fail('Vous ne pouvez pas retirer votre propre rôle.');
  }

  const supabase = await createClient();
  const update: { full_name: string; role?: 'bureau' | 'membre' } = { full_name: name.data };
  if (wantsRole) {
    update.role = role;
  }
  const { error: profileError } = await supabase.from('profiles').update(update).eq('id', id.data);
  if (profileError) {
    return fail(dbErrorMessage(profileError));
  }

  // Équipes : seules les équipes actives sont synchronisées ; les archivées restent telles quelles.
  const { data: activeTeams } = await supabase.from('poles').select('id').is('archived_at', null);
  const activeIds = ((activeTeams ?? []) as { id: string }[]).map((t) => t.id);
  const chosen = formData.getAll('poleIds').map(String).filter((v) => z.uuid().safeParse(v).success && activeIds.includes(v));
  const removed = activeIds.filter((teamId) => !chosen.includes(teamId));
  if (removed.length > 0) {
    const { error } = await supabase.from('pole_memberships').delete().eq('profile_id', id.data).in('pole_id', removed);
    if (error) {
      return fail(dbErrorMessage(error));
    }
  }
  if (chosen.length > 0) {
    const { error } = await supabase
      .from('pole_memberships')
      .upsert(chosen.map((pole_id) => ({ profile_id: id.data, pole_id, role: 'membre' })), { onConflict: 'profile_id,pole_id' });
    if (error) {
      return fail(dbErrorMessage(error));
    }
  }

  revalidatePath('/parametres/membres');
  revalidatePath('/poles');
  return ok(undefined, 'Membre mis à jour.');
}

// Suppression définitive d'un compte : réservée à l'administrateur du site, jamais sur soi-même.
export async function deleteMemberAction(profileId: string): Promise<ActionResult> {
  const session = await requireSiteAdmin();
  if (!session.profile.is_site_admin) {
    return fail('Seul l’administrateur du site peut supprimer un compte.');
  }
  const id = z.uuid().safeParse(profileId);
  if (!id.success) {
    return fail('Membre introuvable.');
  }
  if (id.data === session.viewer.id) {
    return fail('Vous ne pouvez pas supprimer votre propre compte.');
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id.data);
  if (error) {
    return fail('Le compte n’a pas pu être supprimé. Réessayez.');
  }
  revalidatePath('/parametres/membres');
  revalidatePath('/poles');
  return ok(undefined, 'Compte supprimé.');
}
