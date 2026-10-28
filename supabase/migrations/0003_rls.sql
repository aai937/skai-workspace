-- Row Level Security : toutes les tables exposées sont protégées.
-- Principe : refus par défaut (RLS activé sans politique = aucun accès).
-- Un compte non activé (pas encore validé par le bureau) ne voit rien.

-- Les rôles Supabase existent déjà ; ce bloc permet de rejouer la migration sur un Postgres vierge (tests).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Le client anonyme (non connecté) n'accède à aucune table.
revoke all on all tables in schema public from anon;

-- Les fonctions de notification et de triggers ne doivent pas être appelables directement par les clients.
revoke execute on function public.notify(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.comment_target_exists(public.comment_target, uuid) from public, anon;

alter table public.poles enable row level security;
alter table public.profiles enable row level security;
alter table public.member_contacts enable row level security;
alter table public.pole_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.projects enable row level security;
alter table public.project_poles enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.events enable row level security;
alter table public.event_poles enable row level security;
alter table public.event_guests enable row level security;
alter table public.tasks enable row level security;
alter table public.task_collaborators enable row level security;
alter table public.comments enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;

-- poles
create policy poles_select on public.poles for select to authenticated
  using (public.is_active_member());
create policy poles_write on public.poles for all to authenticated
  using (public.is_bureau()) with check (public.is_bureau());

-- profiles : un membre actif voit les profils actifs ; chacun modifie son profil, le bureau modifie tout.
-- Le trigger profiles_guard_privileges empêche de modifier son propre rôle ou son statut actif.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_member());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_bureau())
  with check (id = auth.uid() or public.is_bureau());

-- coordonnées : seulement le membre et le bureau.
create policy member_contacts_select on public.member_contacts for select to authenticated
  using (profile_id = auth.uid() or public.is_bureau());
create policy member_contacts_insert on public.member_contacts for insert to authenticated
  with check (profile_id = auth.uid() or public.is_bureau());
create policy member_contacts_update on public.member_contacts for update to authenticated
  using (profile_id = auth.uid() or public.is_bureau())
  with check (profile_id = auth.uid() or public.is_bureau());
create policy member_contacts_delete on public.member_contacts for delete to authenticated
  using (public.is_bureau());

-- pole_memberships : un responsable ne peut ajouter ou retirer que des membres simples de son pôle.
create policy pole_memberships_select on public.pole_memberships for select to authenticated
  using (public.is_active_member());
create policy pole_memberships_insert on public.pole_memberships for insert to authenticated
  with check (
    public.is_bureau()
    or (public.is_pole_responsable(pole_id) and role = 'membre')
  );
create policy pole_memberships_update on public.pole_memberships for update to authenticated
  using (public.is_bureau()) with check (public.is_bureau());
create policy pole_memberships_delete on public.pole_memberships for delete to authenticated
  using (
    public.is_bureau()
    or (public.is_pole_responsable(pole_id) and role = 'membre')
  );

-- invitations : réservé au bureau (les invitations sont aussi envoyées par le serveur avec la clé service).
create policy invitations_bureau on public.invitations for all to authenticated
  using (public.is_bureau()) with check (public.is_bureau());

-- projets
create policy projects_select on public.projects for select to authenticated
  using (public.is_active_member());
create policy projects_insert on public.projects for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.is_bureau() or public.is_any_pole_responsable())
  );
create policy projects_update on public.projects for update to authenticated
  using (public.can_manage_project(id))
  with check (public.can_manage_project(id));
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_bureau());

create policy project_poles_select on public.project_poles for select to authenticated
  using (public.is_active_member());
create policy project_poles_write on public.project_poles for all to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

create policy project_members_select on public.project_members for select to authenticated
  using (public.is_active_member());
create policy project_members_write on public.project_members for all to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

create policy milestones_select on public.milestones for select to authenticated
  using (public.is_active_member());
create policy milestones_write on public.milestones for all to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

-- événements
create policy events_select on public.events for select to authenticated
  using (public.is_active_member());
create policy events_insert on public.events for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.is_bureau() or public.is_any_pole_responsable())
  );
create policy events_update on public.events for update to authenticated
  using (public.can_manage_event(id))
  with check (public.can_manage_event(id));
create policy events_delete on public.events for delete to authenticated
  using (public.is_bureau());

create policy event_poles_select on public.event_poles for select to authenticated
  using (public.is_active_member());
create policy event_poles_write on public.event_poles for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

create policy event_guests_select on public.event_guests for select to authenticated
  using (public.is_active_member());
create policy event_guests_write on public.event_guests for all to authenticated
  using (public.can_manage_event(event_id))
  with check (public.can_manage_event(event_id));

-- tâches
-- Lecture : tous les membres actifs (transparence interne).
-- Création : bureau ou responsable du pôle, en tant que créateur.
-- Modification : bureau, responsable du pôle, ou assigné (le trigger tasks_guard_update limite l'assigné
-- aux colonnes statut, blocage et mise à jour).
create policy tasks_select on public.tasks for select to authenticated
  using (public.is_active_member());
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    creator_id = auth.uid()
    and (public.is_bureau() or public.is_pole_responsable(pole_id))
  );
create policy tasks_update on public.tasks for update to authenticated
  using (
    public.is_bureau()
    or public.is_pole_responsable(pole_id)
    or assignee_id = auth.uid()
  )
  with check (
    public.is_bureau()
    or public.is_pole_responsable(pole_id)
    or assignee_id = auth.uid()
  );
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_bureau());

create policy task_collaborators_select on public.task_collaborators for select to authenticated
  using (public.is_active_member());
create policy task_collaborators_write on public.task_collaborators for all to authenticated
  using (public.can_manage_task(task_id))
  with check (public.can_manage_task(task_id));

-- commentaires : tout membre actif peut commenter ; on modifie ou supprime les siens (le bureau peut modérer).
create policy comments_select on public.comments for select to authenticated
  using (public.is_active_member());
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_active_member()
    and public.comment_target_exists(target_type, target_id)
  );
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid() or public.is_bureau())
  with check (author_id = auth.uid() or public.is_bureau());
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_bureau());

-- idées
-- Un membre propose ; seul le bureau décide (le trigger ideas_guard_update protège le statut).
create policy ideas_select on public.ideas for select to authenticated
  using (public.is_active_member());
create policy ideas_insert on public.ideas for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_member() and status = 'nouvelle');
create policy ideas_update on public.ideas for update to authenticated
  using (public.is_bureau() or (author_id = auth.uid() and status = 'nouvelle'))
  with check (public.is_bureau() or (author_id = auth.uid() and status = 'nouvelle'));
create policy ideas_delete on public.ideas for delete to authenticated
  using (public.is_bureau());

create policy idea_votes_select on public.idea_votes for select to authenticated
  using (public.is_active_member());
create policy idea_votes_insert on public.idea_votes for insert to authenticated
  with check (voter_id = auth.uid() and public.is_active_member());
-- Retirer son propre vote est possible ; en changer ne l'est pas (un vote par membre et par idée).
create policy idea_votes_delete on public.idea_votes for delete to authenticated
  using (voter_id = auth.uid());

-- documents
create policy documents_select on public.documents for select to authenticated
  using (public.can_read_document(id));
create policy documents_insert on public.documents for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.is_active_member()
    and (visibility <> 'bureau' or public.is_bureau())
  );
create policy documents_update on public.documents for update to authenticated
  using (public.is_bureau() or uploaded_by = auth.uid())
  with check (public.is_bureau() or (uploaded_by = auth.uid() and visibility <> 'bureau'));
create policy documents_delete on public.documents for delete to authenticated
  using (public.is_bureau() or uploaded_by = auth.uid());

-- notifications : chacun ne lit que les siennes ; elles sont créées par la base uniquement.
create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (recipient_id = auth.uid());

-- journal d'activité : lecture pour les membres actifs, écriture par les triggers uniquement.
create policy activity_log_select on public.activity_log for select to authenticated
  using (public.is_active_member());
