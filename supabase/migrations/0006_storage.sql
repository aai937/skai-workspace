-- Stockage des documents : bucket privé. Les fichiers ne sont jamais publics ;
-- l'accès passe par des URL signées générées côté serveur après vérification des droits.
-- Chemin d'un fichier : <id-de-l-auteur>/<uuid>-<nom-nettoyé>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png', 'image/jpeg', 'text/plain', 'text/markdown'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy skai_documents_select on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.storage_path = storage.objects.name
        and public.can_read_document(d.id)
    )
  );

create policy skai_documents_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_active_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy skai_documents_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (public.is_bureau() or (storage.foldername(name))[1] = auth.uid()::text)
  );
