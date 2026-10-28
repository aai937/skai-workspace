import type { Metadata } from 'next';
import Link from 'next/link';
import { signUpAction } from '@/app/actions/auth';
import { Logo } from '@/components/brand/Logo';
import { ActionForm, SubmitButton, TextField } from '@/components/forms';
import { Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Demander à rejoindre' };

export default function InscriptionPage() {
  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center bg-[radial-gradient(60%_50%_at_50%_0%,var(--c-accent-soft),transparent)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card>
          <h1 className="text-xl font-semibold tracking-tight">Demander à rejoindre</h1>
          <p className="mt-1 text-sm text-[var(--c-ink-soft)]">
            Votre accès sera activé par le bureau, qui vous affectera à un pôle. Vous ne verrez les contenus qu’après validation.
          </p>
          <ActionForm action={signUpAction} resetOnSuccess className="mt-6 flex flex-col gap-4">
            <TextField name="fullName" label="Nom complet" autoComplete="name" required minLength={2} maxLength={120} />
            <TextField name="email" label="Adresse e-mail" type="email" autoComplete="email" required />
            <TextField name="password" label="Mot de passe" type="password" autoComplete="new-password" minLength={12} required hint="12 caractères minimum." />
            <SubmitButton>Envoyer ma demande</SubmitButton>
          </ActionForm>
          <p className="mt-4 text-center text-sm text-[var(--c-ink-soft)]">
            Déjà membre ?{' '}
            <Link href="/connexion" className="font-medium text-[var(--c-accent)] underline-offset-4 hover:underline">
              Se connecter
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
