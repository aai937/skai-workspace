'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { dbErrorMessage, fail, ok, type ActionResult } from '@/lib/result';
import { createClient } from '@/lib/supabase/server';

// Les notifications sont créées par la base ; le destinataire ne peut que marquer comme lues (RLS + trigger).
export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  await requireSession();
  const parsed = z.uuid().safeParse(notificationId);
  if (!parsed.success) {
    return fail('Notification introuvable.');
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/notifications');
  return ok(undefined);
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', session.viewer.id)
    .is('read_at', null);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/notifications');
  return ok(undefined, 'Toutes les notifications sont lues.');
}
