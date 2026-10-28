// Calendrier personnel (.ics) : tâches à échéance et événements, pour Google Agenda, Outlook ou Apple Agenda.
// Le lien contient un jeton secret propre à chaque membre ; il peut être régénéré depuis le profil.
import { NextResponse, type NextRequest } from 'next/server';
import { buildIcs, type IcsEvent } from '@/lib/calendar/ics';
import { createAdminClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/site';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  if (!UUID.test(token)) {
    return new NextResponse('Introuvable.', { status: 404 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, is_active')
    .eq('calendar_token', token)
    .maybeSingle();
  if (!profile || !profile.is_active) {
    return new NextResponse('Introuvable.', { status: 404 });
  }

  const origin = await siteOrigin();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [tasks, events] = await Promise.all([
    admin
      .from('tasks')
      .select('id, title, due_date')
      .eq('assignee_id', profile.id)
      .neq('status', 'terminee')
      .is('archived_at', null)
      .not('due_date', 'is', null)
      .limit(500),
    admin
      .from('events')
      .select('id, title, description, starts_at, ends_at, location')
      .is('archived_at', null)
      .gte('starts_at', since)
      .limit(500),
  ]);

  const items: IcsEvent[] = [
    ...((tasks.data ?? []) as { id: string; title: string; due_date: string }[]).map((t) => ({
      uid: `task-${t.id}`,
      summary: `Échéance : ${t.title}`,
      allDay: true,
      start: t.due_date,
      url: `${origin}/taches/${t.id}`,
    })),
    ...((events.data ?? []) as { id: string; title: string; description: string; starts_at: string; ends_at: string | null; location: string }[]).map((e) => ({
      uid: `event-${e.id}`,
      summary: e.title,
      description: [e.description, e.location ? `Lieu : ${e.location}` : ''].filter(Boolean).join('\n'),
      allDay: false,
      start: e.starts_at,
      end: e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 2 * 3_600_000).toISOString(),
      url: `${origin}/evenements/${e.id}`,
    })),
  ];

  const body = buildIcs(`skAI · ${profile.full_name}`, items);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="skai.ics"',
      'Cache-Control': 'private, max-age=900',
    },
  });
}
