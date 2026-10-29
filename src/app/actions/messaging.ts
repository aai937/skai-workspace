'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { canCreateChannel, canDeleteMessage, messageSchema, channelSchema, REACTION_EMOJIS } from '@/lib/domain/messaging';
import { dbErrorMessage, fail, ok, zodFieldErrors, type ActionResult } from '@/lib/result';
import { createClient } from '@/lib/supabase/server';

const ids = z.uuid();

// Publication d'un message ou d'une réponse. Les mentions notifient les membres cochés (trigger en base).
export async function postMessageAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = messageSchema.safeParse({
    channelId: formData.get('channelId'),
    parentId: formData.get('parentId') || null,
    body: formData.get('body') ?? '',
    mentions: formData.getAll('mentions'),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Message invalide.', zodFieldErrors(parsed.error.issues));
  }
  const supabase = await createClient();
  const { error } = await supabase.from('messages').insert({
    channel_id: parsed.data.channelId,
    parent_id: parsed.data.parentId,
    author_id: session.viewer.id,
    body: parsed.data.body,
    mentions: parsed.data.mentions,
  });
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/messages/${parsed.data.channelId}`);
  return ok(undefined);
}

// Réaction emoji : une par personne et par emoji (clé primaire en base).
export async function toggleReactionAction(messageId: string, emoji: string, add: boolean): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z.object({ messageId: ids, emoji: z.enum(REACTION_EMOJIS) }).safeParse({ messageId, emoji });
  if (!parsed.success) {
    return fail('Réaction non prise en charge.');
  }
  const supabase = await createClient();
  const { error } = add
    ? await supabase.from('message_reactions').insert({ message_id: messageId, profile_id: session.viewer.id, emoji })
    : await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('profile_id', session.viewer.id)
        .eq('emoji', emoji);
  if (error && error.code !== '23505') {
    return fail(dbErrorMessage(error));
  }
  const { data: message } = await supabase.from('messages').select('channel_id').eq('id', messageId).maybeSingle();
  if (message) {
    revalidatePath(`/messages/${message.channel_id}`);
  }
  return ok(undefined);
}

// Suppression : le texte est remplacé, le message reste visible comme « supprimé » pour garder le fil.
export async function deleteMessageAction(messageId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!ids.safeParse(messageId).success) {
    return fail('Message introuvable.');
  }
  const supabase = await createClient();
  const { data: message } = await supabase.from('messages').select('id, channel_id, author_id').eq('id', messageId).maybeSingle();
  if (!message) {
    return fail('Message introuvable.');
  }
  if (!canDeleteMessage(session.viewer, { authorId: message.author_id })) {
    return fail('Vous ne pouvez supprimer que vos propres messages.');
  }
  const { error } = await supabase
    .from('messages')
    .update({ body: 'Message supprimé', deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`/messages/${message.channel_id}`);
  return ok(undefined, 'Message supprimé.');
}

// Canal libre : bureau ou responsable d'équipe.
export async function createChannelAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  if (!canCreateChannel(session.viewer)) {
    return fail('Seul le bureau ou un responsable d'équipe peut créer un canal.');
  }
  const parsed = channelSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? '',
  });
  if (!parsed.success) {
    return fail('Vérifiez le nom du canal.', zodFieldErrors(parsed.error.issues));
  }
  const base = parsed.data.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'canal';
  const slug = `${base}-${crypto.randomUUID().slice(0, 6)}`;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('channels')
    .insert({ slug, name: parsed.data.name, description: parsed.data.description, kind: 'libre', created_by: session.viewer.id })
    .select('id')
    .single();
  if (error || !data) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/messages');
  redirect(`/messages/${data.id}`);
}
