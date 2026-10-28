// Synthèse quotidienne (et hebdomadaire le lundi) par e-mail. Appelée par Vercel Cron, voir vercel.json.
import { NextResponse, type NextRequest } from 'next/server';
import { isCronAuthorized } from '@/lib/cron';
import { buildDigest } from '@/lib/mail/digest';
import { mailConfigured, sendMail } from '@/lib/mail/send';
import { createAdminClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/site';

const DAY_MS = 86_400_000;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return new NextResponse('Non autorisé.', { status: 401 });
  }
  if (!mailConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'mail non configuré' });
  }

  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Europe/Paris' });
  const isMonday = weekday === 'Mon';
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
  const nextWeek = new Date(now.getTime() + 7 * DAY_MS).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });

  const admin = createAdminClient();
  const origin = await siteOrigin();
  const periods = isMonday ? ['quotidien', 'hebdomadaire'] : ['quotidien'];

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, email, full_name, email_digest, last_digest_at, pole_memberships(pole_id)')
    .eq('is_active', true)
    .in('email_digest', periods);
  if (error) {
    return new NextResponse('Lecture des profils impossible.', { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  for (const p of (profiles ?? []) as {
    id: string;
    email: string;
    full_name: string;
    email_digest: 'quotidien' | 'hebdomadaire';
    last_digest_at: string | null;
    pole_memberships: { pole_id: string }[];
  }[]) {
    const windowDays = p.email_digest === 'hebdomadaire' ? 7 : 1;
    const since = p.last_digest_at ?? new Date(now.getTime() - windowDays * DAY_MS).toISOString();

    const [notifs, announcements, tasks] = await Promise.all([
      admin.from('notifications').select('title, body, link').eq('recipient_id', p.id).gte('created_at', since).order('created_at', { ascending: false }).limit(30),
      admin.from('announcements').select('id, title, body, audience, pole_id').gte('created_at', since).is('archived_at', null).order('created_at', { ascending: false }).limit(20),
      admin.from('tasks').select('id, title, due_date').eq('assignee_id', p.id).neq('status', 'terminee').is('archived_at', null).gte('due_date', today).lte('due_date', nextWeek).order('due_date').limit(20),
    ]);

    const poleIds = new Set(p.pole_memberships.map((m) => m.pole_id));
    const visibleAnnouncements = ((announcements.data ?? []) as { id: string; title: string; body: string; audience: string; pole_id: string | null }[])
      .filter((a) => a.audience === 'tous' || (a.pole_id !== null && poleIds.has(a.pole_id)));

    const digest = buildDigest({
      siteUrl: origin,
      name: p.full_name,
      period: p.email_digest,
      notifications: ((notifs.data ?? []) as { title: string; body: string; link: string }[]).map((n) => ({ title: n.title, body: n.body, link: n.link })),
      announcements: visibleAnnouncements.map((a) => ({ title: a.title, body: a.body.slice(0, 160), link: '/annonces' })),
      dueTasks: ((tasks.data ?? []) as { id: string; title: string; due_date: string }[]).map((t) => ({
        title: t.title,
        body: `Échéance le ${t.due_date}`,
        link: `/taches/${t.id}`,
      })),
    });

    if (digest) {
      const result = await sendMail({ to: p.email, ...digest });
      if (result.ok) sent += 1;
      else failed += 1;
      if (!result.ok) continue;
    }
    await admin.from('profiles').update({ last_digest_at: now.toISOString() }).eq('id', p.id);
  }

  return NextResponse.json({ sent, failed, periods });
}
