import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { setPasswordAction } from '@/app/actions/auth';
import { ActionForm, SubmitButton, TextField } from '@/components/forms';
import { Card } from '@/components/ui';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = { title: 'Choisir un mot de passe' };

export default async function DefinirMotDePassePage() {
  const session = await getSession();
  if (!session) {
    redirect('/connexion?erreur=lien');
  }

  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <h1 className="text-xl font-semibold tracking-tight">Bienvenue dans skAI Workspace</h1>
          <p className="mt-1 text-sm text-[var(--c-ink-soft)]">Choisissez un mot de passe d’au moins 12 caractères.</p>
          <ActionForm action={setPasswordAction} className="mt-6 flex flex-col gap-4">
            <TextField name="password" label="Nouveau mot de passe" type="password" autoComplete="new-password" minLength={12} required />
            <TextField name="confirmation" label="Confirmer le mot de passe" type="password" autoComplete="new-password" minLength={12} required />
            <SubmitButton>Enregistrer et continuer</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </main>
  );
}
