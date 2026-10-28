-- Nom affiché : à défaut de nom saisi, on le déduit de l'adresse (anis.aniche@… -> « Anis Aniche »).

create or replace function public.display_name_from_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(initcap(part), ' ')
  from regexp_split_to_table(split_part(p_email, '@', 1), '[._-]+') as part
  where part <> '';
$$;

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

  v_name := left(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(public.display_name_from_email(v_email), ''),
    'Membre'
  ), 120);
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

-- Correction du compte existant, sans toucher au reste du profil.
update public.profiles
set full_name = public.display_name_from_email(email)
where full_name = split_part(email, '@', 1);
