import type { Metadata } from 'next';
import { uploadDocumentAction } from '@/app/actions/documents';
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listPoles } from '@/lib/data/people';
import { DOCUMENT_CATEGORIES, DOCUMENT_VISIBILITIES, LABELS } from '@/lib/domain/constants';

export const metadata: Metadata = { title: 'Ajouter un document' };

export default async function NouveauDocumentPage() {
  const session = await requireSession();
  const poles = await listPoles();
  const visibilities = DOCUMENT_VISIBILITIES.filter((v) => v !== 'bureau' || session.viewer.isBureau);

  return (
    <>
      <PageHeader title="Ajouter un document" description="Fichiers de 25 Mo maximum : PDF, Word, PowerPoint, Excel, PNG, JPEG ou texte. Stockage privé." />
      <div className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)] p-5">
        <ActionForm action={uploadDocumentAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <TextField name="title" label="Titre" required minLength={2} maxLength={200} />
          </div>
          <label className="md:col-span-2 block">
            <span className="text-sm font-medium">Fichier</span>
            <input name="file" type="file" required className="mt-1 block w-full text-sm" />
          </label>
          <SelectField name="category" label="Catégorie" options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: LABELS.documentCategory[c] }))} defaultValue="autre" />
          <SelectField name="visibility" label="Visibilité" options={visibilities.map((v) => ({ value: v, label: LABELS.documentVisibility[v] }))} defaultValue="membres" />
          <SelectField name="poleId" label="Pôle (si visibilité « Pôle »)" options={poles.map((p) => ({ value: p.id, label: p.name }))} placeholder="Aucun" />
          <TextField name="tags" label="Étiquettes" hint="Séparées par des virgules." />
          <div className="md:col-span-2">
            <TextAreaField name="description" label="Description" maxLength={2000} />
          </div>
          <div className="md:col-span-2">
            <SubmitButton>Envoyer le document</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
