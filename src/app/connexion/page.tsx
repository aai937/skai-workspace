import type { Metadata } from 'next';
import Link from 'next/link';
import { signInAction } from '@/app/actions/auth';
import { ActionForm, SubmitButton, TextField } from '@/components/forms';
import { Logo } from '@/components/brand/Logo';
import { Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Connexion' };

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ suite?: string; erreur?: string }> }) {
  const params = await searchParams;
  const next = params.suite && /^\/(?!\/)[\w\-/]*$/.test(params.suite) ? params.suite : undefined;

  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center bg-[radial-gradient(60%_50%_at_50%_0%,var(--c-accent-soft),transparent)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card>
          <h1 className="text-xl font-semibold tracking-tight">Connexion</h1>
          <p className="mt-1 text-sm text-[var(--c-ink-soft)]">
            L’accès est réservé aux membres invités par le bureau. Pas encore de compte ? Demandez une invitation au bureau.
          </p>
          {params.erreur === 'lien' ? (
            <p role="alert" className="mt-4 rounded-lg bg-[var(--c-danger-soft)] px-3 py-2 text-sm text-[var(--c-danger)]">
              Ce lien n’est plus valide. Demandez un nouveau lien.
            </p>
          ) : null}
          <ActionForm action={signInAction} className="mt-6 flex flex-col gap-4">
            <input type="hidden" name="next" value={next ?? ''} />
            <TextField name="email" label="Adresse e-mail" type="email" autoComplete="email" required />
            <TextField name="password" label="Mot de passe" type="password" autoComplete="current-password" required />
            <SubmitButton>Se connecter</SubmitButton>
          </ActionForm>
          <p className="mt-4 text-center text-sm text-[var(--c-ink-soft)]">
            Pas encore membre ?{' '}
            <Link href="/inscription" className="font-medium text-[var(--c-accent)] underline-offset-4 hover:underline">
              Demander à rejoindre
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
