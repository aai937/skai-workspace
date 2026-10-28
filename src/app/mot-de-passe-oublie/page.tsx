import type { Metadata } from 'next';
import Link from 'next/link';
import { requestPasswordResetAction } from '@/app/actions/auth';
import { ActionForm, SubmitButton, TextField } from '@/components/forms';
import { Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default function MotDePasseOubliePage() {
  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <h1 className="text-xl font-semibold tracking-tight">Mot de passe oublié</h1>
          <p className="mt-1 text-sm text-[var(--c-ink-soft)]">Nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
          <ActionForm action={requestPasswordResetAction} className="mt-6 flex flex-col gap-4">
            <TextField name="email" label="Adresse e-mail" type="email" autoComplete="email" required />
            <SubmitButton>Envoyer le lien</SubmitButton>
          </ActionForm>
          <p className="mt-4 text-center text-sm">
            <Link href="/connexion" className="text-[var(--c-accent)] underline-offset-4 hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
