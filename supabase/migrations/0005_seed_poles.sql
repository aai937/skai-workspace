-- Les quatre pôles de l'association. Le bureau peut les renommer ou en ajouter depuis l'interface.
insert into public.poles (slug, name, description, position) values
  ('evenementiel-partenariats', 'Événementiel & Partenariats', 'Conférences, ateliers, rencontres avec des entreprises, certifications et partenariats.', 1),
  ('projets-innovation', 'Projets, Innovation & Entrepreneuriat', 'Projets techniques, recherche, idées innovantes et entrepreneuriat.', 2),
  ('communication-marketing', 'Communication & Marketing', 'Image de l''association, réseaux sociaux, supports et promotion.', 3),
  ('women-in-tech', 'Women in Tech', 'Promotion de la place des femmes dans la tech et l''IA.', 4)
on conflict (slug) do nothing;
