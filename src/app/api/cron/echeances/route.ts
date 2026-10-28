// Rappel quotidien des échéances proches (appelé par Vercel Cron, voir vercel.json).
// Protégé par un secret partagé : sans l'en-tête Authorization exact, la route ne fait rien.
import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

function isAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) {
    return false;
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function dayKeyFromNow(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request.headers.get('authorization'))) {
    return new NextResponse('Non autorisé.', { status: 401 });
  }

  const admin = createAdminClient();
  const tomorrow = dayKeyFromNow(1);
  const today = dayKeyFromNow(0);

  const { data: tasks, error } = await admin
    .from('tasks')
    .select('id, title, assignee_id, due_date')
    .in('due_date', [today, tomorrow])
    .neq('status', 'terminee')
    .not('assignee_id', 'is', null)
    .is('archived_at', null);
  if (error) {
    return new NextResponse('Lecture impossible.', { status: 500 });
  }

  let created = 0;
  for (const task of (tasks ?? []) as { id: string; title: string; assignee_id: string; due_date: string }[]) {
    const link = `/taches/${task.id}`;
    const { data: existing } = await admin
      .from('notifications')
      .select('id')
      .eq('recipient_id', task.assignee_id)
      .eq('kind', 'due_soon')
      .eq('link', link)
      .gte('created_at', new Date(Date.now() - 20 * 3_600_000).toISOString())
      .limit(1);
    if (existing && existing.length > 0) {
      continue;
    }
    const when = task.due_date === today ? "aujourd'hui" : 'demain';
    const { error: insertError } = await admin.from('notifications').insert({
      recipient_id: task.assignee_id,
      kind: 'due_soon',
      title: `Échéance ${when} : ${task.title}`.slice(0, 200),
      body: 'Pensez à mettre à jour l’avancement de cette tâche.',
      link,
    });
    if (!insertError) {
      created += 1;
    }
  }

  return NextResponse.json({ checked: tasks?.length ?? 0, created });
}
