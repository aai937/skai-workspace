-- Archivage : un projet ou un événement archivé ferme aussi son canal de discussion (et le rouvre s'il est réactivé).

create or replace function public.channel_sync_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    update public.channels
    set archived_at = new.archived_at
    where (tg_table_name = 'projects' and project_id = new.id)
       or (tg_table_name = 'events' and event_id = new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists projects_channel_archive on public.projects;
create trigger projects_channel_archive after update of archived_at on public.projects
  for each row execute function public.channel_sync_archive();

drop trigger if exists events_channel_archive on public.events;
create trigger events_channel_archive after update of archived_at on public.events
  for each row execute function public.channel_sync_archive();

-- Rattrapage : les projets et événements déjà archivés ferment leur canal.
update public.channels c set archived_at = p.archived_at
from public.projects p
where c.project_id = p.id and p.archived_at is not null and c.archived_at is null;

update public.channels c set archived_at = e.archived_at
from public.events e
where c.event_id = e.id and e.archived_at is not null and c.archived_at is null;
