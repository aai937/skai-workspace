'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { buildAnnouncementMail } from '@/lib/mail/digest';
import { mailConfigured, sendMail } from '@/lib/mail/send';
import { canPublishAnnouncement } from '@/lib/domain/messaging';
import { announcementSchema } from '@/lib/domain/messaging';
import { dbErrorMessage, fail, ok, zodFieldErrors, type ActionResult } from '@/lib/result';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/site';

// Envoi d'une annonce par e-mail à son audience. Les membres ayant désactivé les mails sont exclus.
async function mailAudience(
  audience: 'tous' | 'pole',
  poleId: string | null,
  title: string,
  body: string,
  author: string,
): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient();
  const query = admin
    .from('profiles')
    .select('id, email, pole_memberships(pole_id)')
    .eq('is_active', true)
    .neq('email_digest', 'desactive');
  const { data } = await query;
  const recipients = ((data ?? []) as { email: string; pole_memberships: { pole_id: string }[] }[]).filter(
    (p) => audience === 'tous' || p.pole_memberships.some((m) => m.pole_id === poleId),
  );

  const origin = await siteOrigin();
  const mail = buildAnnouncementMail({ siteUrl: origin, title, body, author });
  let sent = 0;
  let failed = 0;
  // Envois par petits lots pour rester sous les limites du fournisseur.
  for (let i = 0; i < recipients.length; i += 10) {
    const results = await Promise.all(recipients.slice(i, i + 10).map((r) => sendMail({ to: r.email, ...mail })));
    for (const r of results) {
      if (r.ok) sent += 1;
      else failed += 1;
    }
  }
  return { sent, failed };
}

export async function publishAnnouncementAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = announcementSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
    audience: formData.get('audience') ?? 'tous',
    poleId: formData.get('poleId') || null,
    pinned: formData.get('pinned') === 'on',
  });
  if (!parsed.success) {
    return fail('Vérifiez l’annonce.', zodFieldErrors(parsed.error.issues));
  }
  const input = parsed.data;
  if (!canPublishAnnouncement(session.viewer)) {
    return fail('Vous ne pouvez publier une annonce que pour le bureau, ou pour votre équipe.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('announcements').insert({
    title: input.title,
    body: input.body,
    audience: input.audience,
    pole_id: input.audience === 'pole' ? input.poleId : null,
    pinned: input.pinned,
    author_id: session.viewer.id,
  });
  if (error) {
    return fail(dbErrorMessage(error));
  }

  revalidatePath('/annonces');
  revalidatePath('/tableau-de-bord');
  return ok(undefined, 'Annonce publiée.');
}

export async function markAnnouncementReadAction(announcementId: string): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z.uuid().safeParse(announcementId);
  if (!parsed.success) {
    return fail('Annonce introuvable.');
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('announcement_reads')
    .insert({ announcement_id: announcementId, profile_id: session.viewer.id });
  if (error && error.code !== '23505') {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/annonces');
  revalidatePath('/tableau-de-bord');
  return ok(undefined);
}

export async function setAnnouncementPinnedAction(announcementId: string, pinned: boolean): Promise<ActionResult> {
  await requireSession();
  const parsed = z.object({ id: z.uuid(), pinned: z.boolean() }).safeParse({ id: announcementId, pinned });
  if (!parsed.success) {
    return fail('Données invalides.');
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('announcements')
    .update({ pinned })
    .eq('id', announcementId)
    .select('id');
  if (error) {
    return fail(dbErrorMessage(error));
  }
  if (!data || data.length === 0) {
    return fail('Vous ne pouvez pas épingler cette annonce.');
  }
  revalidatePath('/annonces');
  revalidatePath('/tableau-de-bord');
  return ok(undefined);
}

export async function archiveAnnouncementAction(announcementId: string): Promise<ActionResult> {
  await requireSession();
  const parsed = z.uuid().safeParse(announcementId);
  if (!parsed.success) {
    return fail('Annonce introuvable.');
  }
  const supabase = await createClient();
  // Pas de .select() ici : une annonce archivée n’est plus visible, donc RLS ne la renverrait pas.
  const { error } = await supabase
    .from('announcements')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', announcementId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/annonces');
  revalidatePath('/tableau-de-bord');
  return ok(undefined, 'Annonce archivée.');
}
