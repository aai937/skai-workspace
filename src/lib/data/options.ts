// Listes déroulantes partagées par les formulaires (pôles, projets, événements, membres actifs).
import { createClient } from '@/lib/supabase/server';
import { listEvents } from './events';
import { listPoles } from './people';
import { listProjects } from './projects';

export type SelectOption = { value: string; label: string };

export async function getFormOptions() {
  const supabase = await createClient();
  const [poles, projects, events, members] = await Promise.all([
    listPoles(),
    listProjects(),
    listEvents(),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ]);
  return {
    poles: poles.map((p) => ({ value: p.id, label: p.name })) as SelectOption[],
    projects: projects.map((p) => ({ value: p.id, label: p.title })) as SelectOption[],
    events: events.map((e) => ({ value: e.id, label: e.title })) as SelectOption[],
    members: ((members.data ?? []) as { id: string; full_name: string }[]).map((m) => ({ value: m.id, label: m.full_name })),
    memberRows: ((members.data ?? []) as { id: string; full_name: string }[]),
  };
}
