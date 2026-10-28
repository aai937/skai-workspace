'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES } from '@/lib/domain/constants';
import { canManageDocument, canUploadDocument } from '@/lib/domain/permissions';
import { documentMetaSchema } from '@/lib/domain/schemas';
import { dbErrorMessage, fail, ok, zodFieldErrors, type ActionResult } from '@/lib/result';
import { createClient } from '@/lib/supabase/server';

// Nom de fichier nettoyé : pas de chemin, pas de caractères spéciaux, longueur bornée.
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'fichier';
  const cleaned = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
  return cleaned.slice(-120) || 'fichier';
}

export async function uploadDocumentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();

  const parsed = documentMetaSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    category: formData.get('category') ?? 'autre',
    visibility: formData.get('visibility') ?? 'membres',
    poleId: formData.get('poleId') ?? '',
    projectId: formData.get('projectId') ?? '',
    eventId: formData.get('eventId') ?? '',
    tags: formData.get('tags') ?? '',
  });
  if (!parsed.success) {
    return fail('Vérifiez les champs du formulaire.', zodFieldErrors(parsed.error.issues));
  }
  const meta = parsed.data;
  if (!canUploadDocument(session.viewer, meta.visibility, meta.poleId)) {
    return fail("Vous ne pouvez pas publier de document à ce niveau de visibilité.");
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return fail('Choisissez un fichier.', { file: 'Fichier manquant.' });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail('Le fichier dépasse 25 Mo.', { file: 'Fichier trop volumineux.' });
  }
  if (!(ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
    return fail('Type de fichier non autorisé (PDF, Word, PowerPoint, Excel, PNG, JPEG, texte).', { file: 'Type non autorisé.' });
  }

  const supabase = await createClient();
  // Chemin : <id de l'auteur>/<uuid>-<nom>. La politique de stockage vérifie le préfixe.
  const storagePath = `${session.viewer.id}/${randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    return fail("Le fichier n'a pas pu être envoyé. Réessayez.");
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      title: meta.title,
      description: meta.description,
      category: meta.category,
      visibility: meta.visibility,
      pole_id: meta.visibility === 'pole' ? meta.poleId : null,
      project_id: meta.projectId,
      event_id: meta.eventId,
      tags: meta.tags,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: session.viewer.id,
    })
    .select('id')
    .single();
  if (error || !data) {
    // Pas de fichier orphelin : on retire l'objet si la ligne n'a pas pu être créée.
    await supabase.storage.from('documents').remove([storagePath]);
    return fail(dbErrorMessage(error));
  }

  revalidatePath('/documents');
  return ok({ id: data.id }, 'Document ajouté.');
}

export async function archiveDocumentAction(documentId: string): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z.uuid().safeParse(documentId);
  if (!parsed.success) {
    return fail('Document introuvable.');
  }
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('documents')
    .select('id, uploaded_by, visibility, pole_id')
    .eq('id', documentId)
    .maybeSingle();
  if (!doc || !canManageDocument(session.viewer, { visibility: doc.visibility, poleId: doc.pole_id, uploadedBy: doc.uploaded_by })) {
    return fail("Vous ne pouvez pas archiver ce document.");
  }
  const { error } = await supabase.from('documents').update({ archived_at: new Date().toISOString() }).eq('id', documentId);
  if (error) {
    return fail(dbErrorMessage(error));
  }
  revalidatePath('/documents');
  return ok(undefined, 'Document archivé.');
}
