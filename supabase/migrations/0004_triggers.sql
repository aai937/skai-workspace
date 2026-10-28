-- Triggers : création des profils, garde-fous contre l'élévation de privilèges,
-- notifications persistantes et journal d'activité.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();
create trigger ideas_touch before update on public.ideas
  for each row execute function public.touch_updated_at();

-- 1. Création du profil à l'inscription. Sans invitation, le compte reste inactif :
--    il ne voit aucune donnée tant qu'un membre du bureau ne l'a pas validé.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(new.email);
  v_invite public.invitations%rowtype;
  v_invited boolean;
  v_name text;
begin
  select * into v_invite
  from public.invitations
  where email = v_email and accepted_at is null;
  v_invited := found;

  v_name := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(v_email, '@', 1)), 120);
  if char_length(v_name) < 2 then
    v_name := 'Membre';
  end if;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (new.id, v_email, v_name, case when v_invited then v_invite.role else 'membre' end, v_invited);

  if v_invited then
    update public.invitations set accepted_at = now() where email = v_email;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Un membre ne peut jamais modifier son rôle ni son statut actif (sauf le bureau).
create or replace function public.profiles_guard_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new; -- opérations serveur avec la clé service (scripts d'administration)
  end if;
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and not public.is_bureau() then
    raise exception 'Seul le bureau peut modifier le rôle ou le statut d''un membre'
      using errcode = '42501';
  end if;
  if new.email is distinct from old.email then
    raise exception 'L''adresse e-mail ne peut pas être modifiée ici' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard_privileges();

-- 3. Tâches : garde-fou des colonnes et horodatage de fin.
-- Les responsables du pôle (et le bureau) modifient tout. L'assigné ne modifie que le statut,
-- le motif de blocage et la date de mise à jour.
create or replace function public.tasks_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager boolean;
begin
  new.updated_at := now();

  if new.status = 'terminee' and old.status is distinct from 'terminee' then
    new.completed_at := now();
  elsif new.status <> 'terminee' then
    new.completed_at := null;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  v_manager := public.is_bureau()
    or (public.is_pole_responsable(old.pole_id)
        and (new.pole_id = old.pole_id or public.is_pole_responsable(new.pole_id)));

  if not v_manager then
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.priority is distinct from old.priority
      or new.pole_id is distinct from old.pole_id
      or new.project_id is distinct from old.project_id
      or new.event_id is distinct from old.event_id
      or new.parent_id is distinct from old.parent_id
      or new.creator_id is distinct from old.creator_id
      or new.assignee_id is distinct from old.assignee_id
      or new.due_date is distinct from old.due_date
      or new.labels is distinct from old.labels
      or new.checklist_category is distinct from old.checklist_category
      or new.archived_at is distinct from old.archived_at then
      raise exception 'Vous pouvez seulement mettre à jour le statut et le blocage de cette tâche'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_before_update
  before update on public.tasks
  for each row execute function public.tasks_before_update();

-- 4. Tâches : notifications d'attribution et de blocage.
create or replace function public.tasks_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform public.notify(
      new.assignee_id, 'task_assigned', 'Nouvelle tâche : ' || new.title,
      'Une tâche vous a été attribuée.', '/taches/' || new.id, auth.uid()
    );
  end if;

  if new.status = 'bloquee' and (tg_op = 'INSERT' or old.status is distinct from 'bloquee') then
    for r in
      select pm.profile_id
      from public.pole_memberships pm
      where pm.pole_id = new.pole_id and pm.role = 'responsable'
      union
      select new.creator_id
    loop
      perform public.notify(
        r.profile_id, 'task_blocked', 'Tâche bloquée : ' || new.title,
        coalesce(new.blocked_reason, ''), '/taches/' || new.id, auth.uid()
      );
    end loop;
  end if;

  return null;
end;
$$;

create trigger tasks_after_change
  after insert or update on public.tasks
  for each row execute function public.tasks_after_change();

-- 5. Projets : ajout d'un membre.
create or replace function public.project_members_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  select title into v_title from public.projects where id = new.project_id;
  perform public.notify(
    new.profile_id, 'project_added', 'Ajouté à un projet : ' || coalesce(v_title, 'Projet'),
    'Vous participez désormais à ce projet.', '/projets/' || new.project_id, auth.uid()
  );
  return null;
end;
$$;

create trigger project_members_notify
  after insert on public.project_members
  for each row execute function public.project_members_notify();

-- 6. Commentaires : mentions. Seuls les membres actifs reçoivent une notification.
create or replace function public.comments_notify_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_path text;
begin
  v_path := case new.target_type
    when 'task' then '/taches/'
    when 'project' then '/projets/'
    when 'idea' then '/idees/'
    when 'event' then '/evenements/'
  end || new.target_id;

  for v_uid in
    select distinct m from unnest(new.mentions) as m
    where m is not null and m <> coalesce(new.author_id, '00000000-0000-0000-0000-000000000000'::uuid)
  loop
    if exists (select 1 from public.profiles p where p.id = v_uid and p.is_active) then
      perform public.notify(v_uid, 'mention', 'Vous avez été mentionné', left(new.body, 200), v_path, new.author_id);
    end if;
  end loop;
  return null;
end;
$$;

create trigger comments_notify_mentions
  after insert on public.comments
  for each row execute function public.comments_notify_mentions();

-- 7. Idées : garde-fou du statut (réservé au bureau) et notifications de revue et de décision.
create or replace function public.ideas_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_bureau() then
    if new.status is distinct from old.status then
      new.decided_by := auth.uid();
      new.decided_at := now();
    end if;
    return new;
  end if;

  -- L'auteur ne modifie son idée que tant qu'elle est nouvelle, sans toucher aux décisions.
  if old.status <> 'nouvelle'
     or new.status is distinct from old.status
     or new.decision_note is distinct from old.decision_note
     or new.decided_by is distinct from old.decided_by
     or new.decided_at is distinct from old.decided_at
     or new.project_id is distinct from old.project_id
     or new.task_id is distinct from old.task_id
     or new.author_id is distinct from old.author_id then
    raise exception 'Seul le bureau peut décider du sort d''une idée' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger ideas_before_update
  before update on public.ideas
  for each row execute function public.ideas_before_update();

create or replace function public.ideas_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if tg_op = 'INSERT' then
    for r in select p.id from public.profiles p where p.is_active and p.role = 'bureau' loop
      perform public.notify(
        r.id, 'idea_review', 'Nouvelle idée à examiner : ' || new.title,
        'Une idée vient d''être proposée.', '/idees/' || new.id, auth.uid()
      );
    end loop;
  elsif new.status is distinct from old.status and new.status <> 'nouvelle' then
    perform public.notify(
      new.author_id, 'idea_decision', 'Décision sur votre idée : ' || new.title,
      coalesce(nullif(new.decision_note, ''), 'Le statut de votre idée a changé.'),
      '/idees/' || new.id, auth.uid()
    );
  end if;
  return null;
end;
$$;

create trigger ideas_after_change
  after insert or update on public.ideas
  for each row execute function public.ideas_after_change();

-- 8. Notifications : seul le champ read_at peut être modifié par le destinataire.
create or replace function public.notifications_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recipient_id is distinct from old.recipient_id
     or new.kind is distinct from old.kind
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.link is distinct from old.link
     or new.actor_id is distinct from old.actor_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Seul l''état de lecture d''une notification peut changer' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notifications_guard
  before update on public.notifications
  for each row execute function public.notifications_guard();

-- 9. Journal d'activité : chaque changement important, avec son auteur et sa date.
-- Le journal ne reprend ni le contenu des commentaires, ni les données personnelles : seuls les noms de colonnes
-- modifiés et, pour le statut, l'ancienne et la nouvelle valeur sont conservés.
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_changed text[] := '{}';
  v_label text;
  v_verb text;
  v_title text;
  v_metadata jsonb := '{}'::jsonb;
  v_entity uuid := nullif(v_row ->> 'id', '')::uuid;
  v_summary text;
begin
  v_label := case tg_table_name
    when 'tasks' then 'Tâche'
    when 'projects' then 'Projet'
    when 'events' then 'Événement'
    when 'ideas' then 'Idée'
    when 'documents' then 'Document'
    when 'comments' then 'Commentaire'
    when 'pole_memberships' then 'Appartenance à un pôle'
    when 'profiles' then 'Profil'
    else tg_table_name
  end;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}')
    into v_changed
    from jsonb_each(to_jsonb(new)) as n
    join jsonb_each(to_jsonb(old)) as o on o.key = n.key
    where n.value is distinct from o.value
      and n.key not in ('updated_at', 'edited_at', 'completed_at');

    if cardinality(v_changed) = 0 then
      return new;
    end if;

    if 'status' = any (v_changed) then
      v_metadata := jsonb_build_object('from', to_jsonb(old) ->> 'status', 'to', to_jsonb(new) ->> 'status');
    end if;
  end if;

  -- Formulation « Type — action « titre » (champs) » : pas d'accord à gérer selon le genre du type.
  v_verb := case tg_op when 'INSERT' then 'création' when 'UPDATE' then 'modification' else 'suppression' end;
  v_title := coalesce(v_row ->> 'title', '');
  if tg_table_name = 'comments' then
    v_title := '';
  end if;

  v_summary := v_label || ' — ' || v_verb
    || case when v_title <> '' then ' « ' || left(v_title, 120) || ' »' else '' end
    || case when cardinality(v_changed) > 0 then ' (' || array_to_string(v_changed, ', ') || ')' else '' end;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, metadata)
  values (
    auth.uid(), lower(tg_op), tg_table_name, v_entity, left(v_summary, 300),
    v_metadata || jsonb_build_object('changed', to_jsonb(v_changed))
  );

  return coalesce(new, old);
end;
$$;

create trigger tasks_log after insert or update or delete on public.tasks
  for each row execute function public.log_activity();
create trigger projects_log after insert or update or delete on public.projects
  for each row execute function public.log_activity();
create trigger events_log after insert or update or delete on public.events
  for each row execute function public.log_activity();
create trigger ideas_log after insert or update or delete on public.ideas
  for each row execute function public.log_activity();
create trigger documents_log after insert or update or delete on public.documents
  for each row execute function public.log_activity();
create trigger comments_log after insert or update or delete on public.comments
  for each row execute function public.log_activity();
create trigger pole_memberships_log after insert or update or delete on public.pole_memberships
  for each row execute function public.log_activity();
create trigger profiles_log after update on public.profiles
  for each row execute function public.log_activity();
