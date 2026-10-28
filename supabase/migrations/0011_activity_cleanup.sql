-- Le journal d'activité n'enregistre plus les modifications de profils : ce sont des données personnelles
-- et des réglages techniques, pas des événements de l'association.
drop trigger if exists profiles_log on public.profiles;
-- Les entrées déjà écrites pour les profils sont retirées.
delete from public.activity_log where entity_type = 'profiles';
