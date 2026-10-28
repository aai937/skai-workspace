-- Messagerie par canaux, annonces, préférences de mail et calendrier personnel.
-- Mêmes principes que le reste : RLS sur chaque table, garde-fous dans les triggers.

-- 1. Préférences de mail et calendrier personnel (le membre contrôle ses propres réglages).
alter table public.profiles
  add column if not exists email_digest text not null default 'quotidien'
    check (email_digest in ('desactive', 'quotidien', 'hebdomadaire')),
  add column if not exists calendar_token uuid not null default gen_random_uuid() unique,
  add column if not exists last_digest_at timestamptz;

create type public.channel_kind as enum ('general', 'pole', 'projet', 'evenement', 'libre');
create type public.announcement_audience as enum ('tous', 'pole');

-- 2. Canaux : un canal général, un canal par pôle, par projet et par événement, et des canaux libres.
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '' check (char_length(description) <= 500),
  kind public.channel_kind not null default 'libre',
  pole_id uuid references public.poles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index channels_kind_idx on public.channels (kind) where archived_at is null;

-- 3. Messages et fils de discussion (parent_id), réactions.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  parent_id uuid references public.messages (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  check (parent_id is null or parent_id <> id),
  check (cardinality(mentions) <= 20)
);
create index messages_channel_idx on public.messages (channel_id, created_at);
create index messages_parent_idx on public.messages (parent_id);

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id, emoji)
);

-- 4. Annonces du bureau (tous les membres, ou un pôle) avec suivi de lecture.
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  audience public.announcement_audience not null default 'tous',
  pole_id uuid references public.poles (id) on delete cascade,
  pinned boolean not null default false,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  archived_at timestamptz,
  check (audience <> 'pole' or pole_id is not null)
);
create index announcements_recent_idx on public.announcements (pinned desc, created_at desc) where archived_at is null;

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);

-- 5. Fonctions d'autorisation supplémentaires.
create or replace function public.can_publish_announcement(p_audience public.announcement_audience, p_pole_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_bureau() or (p_audience = 'pole' and public.is_pole_responsable(p_pole_id));
$$;

create or replace function public.can_see_announcement(p_audience public.announcement_audience, p_pole_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_bureau()
    or (public.is_active_member() and (p_audience = 'tous' or public.is_pole_member(p_pole_id)));
$$;

create or replace function public.channel_is_open(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.channels c
    where c.id = p_channel_id and c.archived_at is null
  );
$$;

-- 6. Canaux créés automatiquement avec les pôles, projets et événements.
create or replace function public.channel_for_pole()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.channels (slug, name, description, kind, pole_id)
  values (new.slug, new.name, new.description, 'pole', new.id)
  on conflict (slug) do nothing;
  return null;
end;
$$;

create trigger poles_channel after insert on public.poles
  for each row execute function public.channel_for_pole();

create or replace function public.channel_sync_pole_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.channels set name = new.name where pole_id = new.id;
  return null;
end;
$$;

create trigger poles_channel_name after update of name on public.poles
  for each row execute function public.channel_sync_pole_name();

create or replace function public.channel_for_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.channels (slug, name, kind, project_id)
  values ('projet-' || left(replace(new.id::text, '-', ''), 12), new.title, 'projet', new.id);
  return null;
end;
$$;

create trigger projects_channel after insert on public.projects
  for each row execute function public.channel_for_project();

create or replace function public.channel_for_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.channels (slug, name, kind, event_id)
  values ('evenement-' || left(replace(new.id::text, '-', ''), 12), new.title, 'evenement', new.id);
  return null;
end;
$$;

create trigger events_channel after insert on public.events
  for each row execute function public.channel_for_event();

-- Canaux existants (pôles déjà créés par 0005) et canal général.
insert into public.channels (slug, name, description, kind, pole_id)
select p.slug, p.name, p.description, 'pole', p.id
from public.poles p
on conflict (slug) do nothing;

insert into public.channels (slug, name, description, kind)
values ('general', 'Général', 'Les échanges de toute l’association.', 'general')
on conflict (slug) do nothing;

-- 7. Messages : contrôle du canal, des fils et des champs modifiables.
create or replace function public.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_channel uuid;
begin
  if not public.channel_is_open(new.channel_id) then
    raise exception 'Ce canal est archivé' using errcode = '42501';
  end if;
  if new.parent_id is not null then
    select channel_id into v_parent_channel from public.messages where id = new.parent_id;
    if v_parent_channel is distinct from new.channel_id then
      raise exception 'La réponse doit être dans le même canal que le message d''origine' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_parent_author uuid;
  v_link text := '/messages/' || new.channel_id;
begin
  for v_uid in
    select distinct m from unnest(new.mentions) as m
    where m is not null and m <> coalesce(new.author_id, '00000000-0000-0000-0000-000000000000'::uuid)
  loop
    if exists (select 1 from public.profiles p where p.id = v_uid and p.is_active) then
      perform public.notify(v_uid, 'mention', 'Vous avez été mentionné dans la messagerie', left(new.body, 200), v_link, new.author_id);
    end if;
  end loop;

  if new.parent_id is not null then
    select author_id into v_parent_author from public.messages where id = new.parent_id;
    perform public.notify(v_parent_author, 'reply', 'Nouvelle réponse à votre message', left(new.body, 200), v_link, new.author_id);
  end if;
  return null;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

create or replace function public.messages_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_bureau() then
    if new.body is distinct from old.body then new.edited_at := now(); end if;
    return new;
  end if;
  if new.channel_id is distinct from old.channel_id
     or new.author_id is distinct from old.author_id
     or new.parent_id is distinct from old.parent_id
     or new.created_at is distinct from old.created_at
     or new.mentions is distinct from old.mentions then
    raise exception 'Seuls le texte et la suppression d''un message peuvent changer' using errcode = '42501';
  end if;
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger messages_before_update before update on public.messages
  for each row execute function public.messages_before_update();

-- 8. Annonces : notification de toute l'audience à la publication.
create or replace function public.announcements_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select p.id from public.profiles p
    where p.is_active
      and (new.audience = 'tous'
           or exists (
             select 1 from public.pole_memberships pm
             where pm.profile_id = p.id and pm.pole_id = new.pole_id
           ))
  loop
    perform public.notify(r.id, 'announcement', 'Annonce : ' || new.title, left(new.body, 200), '/annonces', new.author_id);
  end loop;
  return null;
end;
$$;

create trigger announcements_after_insert after insert on public.announcements
  for each row execute function public.announcements_after_insert();

create trigger announcements_touch before update on public.announcements
  for each row execute function public.touch_updated_at();

create trigger announcements_log after insert or update or delete on public.announcements
  for each row execute function public.log_activity();
create trigger channels_log after insert or update or delete on public.channels
  for each row execute function public.log_activity();

-- 9. Sécurité des tables (RLS).
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- Canaux : lecture pour les membres actifs ; création de canaux libres par le bureau ou un responsable.
create policy channels_select on public.channels for select to authenticated
  using (public.is_active_member());
create policy channels_insert on public.channels for insert to authenticated
  with check (
    kind = 'libre'
    and created_by = auth.uid()
    and (public.is_bureau() or public.is_any_pole_responsable())
  );
create policy channels_update on public.channels for update to authenticated
  using (public.is_bureau() or (kind = 'libre' and created_by = auth.uid()))
  with check (public.is_bureau() or (kind = 'libre' and created_by = auth.uid()));
create policy channels_delete on public.channels for delete to authenticated
  using (public.is_bureau());

-- Messages : tout membre actif écrit dans un canal ouvert ; on modifie les siens (le bureau modère).
create policy messages_select on public.messages for select to authenticated
  using (public.is_active_member());
create policy messages_insert on public.messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_member());
create policy messages_update on public.messages for update to authenticated
  using (author_id = auth.uid() or public.is_bureau())
  with check (author_id = auth.uid() or public.is_bureau());
create policy messages_delete on public.messages for delete to authenticated
  using (public.is_bureau());

create policy message_reactions_select on public.message_reactions for select to authenticated
  using (public.is_active_member());
create policy message_reactions_insert on public.message_reactions for insert to authenticated
  with check (profile_id = auth.uid() and public.is_active_member());
create policy message_reactions_delete on public.message_reactions for delete to authenticated
  using (profile_id = auth.uid());

-- Annonces : visibles selon l'audience ; publiées par le bureau ou le responsable du pôle concerné.
create policy announcements_select on public.announcements for select to authenticated
  using (public.can_see_announcement(audience, pole_id) and archived_at is null);
create policy announcements_insert on public.announcements for insert to authenticated
  with check (author_id = auth.uid() and public.can_publish_announcement(audience, pole_id));
create policy announcements_update on public.announcements for update to authenticated
  using (public.can_publish_announcement(audience, pole_id))
  with check (public.can_publish_announcement(audience, pole_id));
create policy announcements_delete on public.announcements for delete to authenticated
  using (public.is_bureau());

create policy announcement_reads_select on public.announcement_reads for select to authenticated
  using (profile_id = auth.uid() or public.is_bureau());
create policy announcement_reads_insert on public.announcement_reads for insert to authenticated
  with check (profile_id = auth.uid() and public.is_active_member());

revoke execute on function public.channel_for_pole() from public, anon, authenticated;
revoke execute on function public.channel_for_project() from public, anon, authenticated;
revoke execute on function public.channel_for_event() from public, anon, authenticated;
revoke execute on function public.channel_sync_pole_name() from public, anon, authenticated;

-- Droits de base pour les nouvelles tables (comme les migrations précédentes).
grant select, insert, update, delete on all tables in schema public to authenticated;

-- 10. Temps réel : les messages et réactions sont diffusés aux clients connectés (RLS appliquée).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end;
$$;
