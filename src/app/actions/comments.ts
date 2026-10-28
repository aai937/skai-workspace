'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { dbErrorMessage, fail, ok, zodFieldErrors, type ActionResult } from '@/lib/result';
import { createClient } from '@/lib/supabase/server';
import { commentSchema } from '@/lib/domain/schemas';
import { z } from 'zod';

const PATHS: Record<string, string> = {
  task: '/taches',
  project: '/projets',
  idea: '/idees',
  event: '/evenements',
};

// Commentaire contextuel. Les mentions déclenchent des notifications côté base (trigger comments_notify_mentions).
export async function addCommentAction(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = commentSchema.safeParse({
    targetType: formData.get('targetType'),
    targetId: formData.get('targetId'),
    body: formData.get('body'),
    mentions: formData.getAll('mentions'),
  });
  if (!parsed.success) {
    return fail('Votre commentaire est vide ou invalide.', zodFieldErrors(parsed.error.issues));
  }

  const supabase = await createClient();
  const { error } = await supabase.from('comments').insert({
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    author_id: session.viewer.id,
    body: parsed.data.body,
    mentions: parsed.data.mentions,
  });
  if (error) {
    return fail(dbErrorMessage(error));
  }

  revalidatePath(`${PATHS[parsed.data.targetType]}/${parsed.data.targetId}`);
  return ok(undefined, 'Commentaire publié.');
}

// Un auteur supprime son commentaire (le bureau peut modérer ; RLS vérifie les deux cas).
export async function deleteCommentAction(commentId: string, targetType: string, targetId: string): Promise<ActionResult> {
  await requireSession();
  const parsed = z.object({ commentId: z.uuid(), targetType: z.enum(['task', 'project', 'idea', 'event']), targetId: z.uuid() })
    .safeParse({ commentId, targetType, targetId });
  if (!parsed.success) {
    return fail('Données invalides.');
  }
  const supabase = await createClient();
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath(`${PATHS[parsed.data.targetType]}/${parsed.data.targetId}`);
  return ok(undefined);
}
