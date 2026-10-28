import type { Metadata } from 'next';
import { submitIdeaAction } from '@/app/actions/ideas';
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms';
import { PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { getFormOptions } from '@/lib/data/options';
import { IDEA_EFFORTS, LABELS } from '@/lib/domain/constants';

export const metadata: Metadata = { title: 'Proposer une idée' };

export default async function NouvelleIdeePage() {
  await requireSession();
  const options = await getFormOptions();

  return (
    <>
      <PageHeader title="Proposer une idée" description="Décrivez le problème avant la solution : c'est ce qui permet au bureau de décider vite." />
      <div className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-surface)] p-5">
        <ActionForm action={submitIdeaAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <TextField name="title" label="Titre" required minLength={2} maxLength={160} />
          </div>
          <div className="md:col-span-2">
            <TextAreaField name="problem" label="Problème identifié" required minLength={10} maxLength={3000} />
          </div>
          <div className="md:col-span-2">
            <TextAreaField name="solution" label="Solution proposée" required minLength={10} maxLength={3000} />
          </div>
          <div className="md:col-span-2">
            <TextAreaField name="benefits" label="Bénéfices attendus" maxLength={3000} />
          </div>
          <SelectField name="poleId" label="Pôle concerné" options={options.poles} placeholder="Aucun en particulier" />
          <SelectField
            name="effort"
            label="Effort estimé"
            options={IDEA_EFFORTS.map((e) => ({ value: e, label: LABELS.ideaEffort[e] }))}
            defaultValue="moyen"
          />
          <div className="md:col-span-2">
            <SubmitButton>Soumettre l’idée</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
