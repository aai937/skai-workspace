-- skAI Workspace : schéma principal.
-- Les règles d'accès sont dans 0002 (fonctions), 0003 (RLS) et 0004 (triggers).

create type public.global_role as enum ('bureau', 'membre');
create type public.pole_role as enum ('responsable', 'membre');
create type public.task_status as enum ('a_faire', 'en_cours', 'en_attente', 'bloquee', 'en_revue', 'terminee');
create type public.task_priority as enum ('basse', 'normale', 'haute', 'urgente');
create type public.project_status as enum ('a_lancer', 'en_cours', 'en_pause', 'termine', 'archive');
create type public.event_status as enum ('preparation', 'pret', 'en_cours', 'termine', 'annule');
create type public.event_guest_kind as enum ('intervenant', 'partenaire');
create type public.idea_status as enum ('nouvelle', 'a_etudier', 'en_discussion', 'approuvee', 'refusee', 'en_pause', 'convertie');
create type public.idea_effort as enum ('faible', 'moyen', 'eleve');
create type public.document_visibility as enum ('bureau', 'pole', 'membres');
create type public.comment_target as enum ('task', 'project', 'idea', 'event');

-- Pôles de l'association (modifiables par le bureau sans toucher au code).
create table public.poles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- Profil public d'un membre. Créé automatiquement à la création du compte (trigger 0004).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (email = lower(email)),
  full_name text not null check (char_length(full_name) between 2 and 120),
  bio text not null default '' check (char_length(bio) <= 500),
  role public.global_role not null default 'membre',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Coordonnées professionnelles : visibles uniquement par le membre lui-même et le bureau.
create table public.member_contacts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  professional_email text check (professional_email is null or char_length(professional_email) <= 254),
  phone text check (phone is null or char_length(phone) <= 30),
  updated_at timestamptz not null default now()
);

create table public.pole_memberships (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  pole_id uuid not null references public.poles (id) on delete cascade,
  role public.pole_role not null default 'membre',
  created_at timestamptz not null default now(),
  primary key (profile_id, pole_id)
);
create index pole_memberships_pole_idx on public.pole_memberships (pole_id, role);

-- Invitations : seules les adresses invitées par le bureau obtiennent un accès actif.
create table public.invitations (
  email text primary key check (email = lower(email)),
  role public.global_role not null default 'membre',
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  objectives text not null default '' check (char_length(objectives) <= 3000),
  deliverables text not null default '' check (char_length(deliverables) <= 3000),
  status public.project_status not null default 'a_lancer',
  priority public.task_priority not null default 'normale',
  lead_id uuid references public.profiles (id) on delete set null,
  start_date date,
  due_date date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (start_date is null or due_date is null or due_date >= start_date)
);
create index projects_status_idx on public.projects (status) where archived_at is null;

create table public.project_poles (
  project_id uuid not null references public.projects (id) on delete cascade,
  pole_id uuid not null references public.poles (id) on delete cascade,
  primary key (project_id, pole_id)
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  due_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index milestones_project_idx on public.milestones (project_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null default '' check (char_length(location) <= 200),
  lead_id uuid references public.profiles (id) on delete set null,
  status public.event_status not null default 'preparation',
  budget_cents integer check (budget_cents is null or budget_cents >= 0),
  logistics_notes text not null default '' check (char_length(logistics_notes) <= 5000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (ends_at is null or ends_at >= starts_at)
);
create index events_starts_idx on public.events (starts_at) where archived_at is null;

create table public.event_poles (
  event_id uuid not null references public.events (id) on delete cascade,
  pole_id uuid not null references public.poles (id) on delete cascade,
  primary key (event_id, pole_id)
);

create table public.event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind public.event_guest_kind not null,
  name text not null check (char_length(name) between 2 and 120),
  organization text not null default '' check (char_length(organization) <= 120),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  status public.task_status not null default 'a_faire',
  priority public.task_priority not null default 'normale',
  pole_id uuid not null references public.poles (id),
  project_id uuid references public.projects (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  parent_id uuid references public.tasks (id) on delete cascade,
  creator_id uuid references public.profiles (id) on delete set null,
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  labels text[] not null default '{}',
  -- Liste logistique d'un événement : ces tâches vivent dans le module tâches (pas de doublon).
  checklist_category text check (checklist_category in (
    'reservation_salle', 'materiel', 'videoprojecteur', 'sonorisation', 'disposition_salle',
    'accueil_intervenants', 'communication', 'inscriptions', 'restauration', 'benevoles', 'remerciements'
  )),
  blocked_reason text check (blocked_reason is null or char_length(blocked_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz,
  check (parent_id is null or parent_id <> id),
  check (checklist_category is null or event_id is not null),
  check (status <> 'bloquee' or char_length(btrim(coalesce(blocked_reason, ''))) > 0),
  check (cardinality(labels) <= 10)
);
create index tasks_assignee_idx on public.tasks (assignee_id, status) where archived_at is null;
create index tasks_pole_idx on public.tasks (pole_id, status) where archived_at is null;
create index tasks_project_idx on public.tasks (project_id);
create index tasks_event_idx on public.tasks (event_id);
create index tasks_due_idx on public.tasks (due_date) where archived_at is null;

create table public.task_collaborators (
  task_id uuid not null references public.tasks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (task_id, profile_id)
);

-- Commentaires contextuels (tâches, projets, idées, événements).
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type public.comment_target not null,
  target_id uuid not null,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index comments_target_idx on public.comments (target_type, target_id, created_at);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  problem text not null check (char_length(problem) between 10 and 3000),
  solution text not null check (char_length(solution) between 10 and 3000),
  benefits text not null default '' check (char_length(benefits) <= 3000),
  pole_id uuid references public.poles (id) on delete set null,
  effort public.idea_effort not null default 'moyen',
  author_id uuid references public.profiles (id) on delete set null,
  status public.idea_status not null default 'nouvelle',
  decision_note text not null default '' check (char_length(decision_note) <= 2000),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  project_id uuid references public.projects (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'convertie' or project_id is not null or task_id is not null)
);
create index ideas_status_idx on public.ideas (status, created_at desc);

-- Un vote par membre et par idée (clé primaire) ; pas de modification de vote.
create table public.idea_votes (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, voter_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null default 'autre' check (category in (
    'compte_rendu', 'procedure', 'partenariat', 'presentation', 'formation', 'projet', 'evenement', 'autre'
  )),
  visibility public.document_visibility not null default 'membres',
  pole_id uuid references public.poles (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  tags text[] not null default '{}',
  storage_path text not null unique,
  mime_type text not null check (char_length(mime_type) <= 100),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (visibility <> 'pole' or pole_id is not null),
  check (cardinality(tags) <= 10)
);
create index documents_category_idx on public.documents (category) where archived_at is null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (char_length(kind) <= 60),
  title text not null check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 500),
  link text not null default '/tableau-de-bord' check (link ~ '^/[^/]'),
  actor_id uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, read_at, created_at desc);

-- Journal d'activité : écrit uniquement par les triggers, sans données sensibles.
create table public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) <= 40),
  entity_type text not null check (char_length(entity_type) <= 40),
  entity_id uuid,
  summary text not null check (char_length(summary) <= 300),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id, created_at desc);
